const Stripe = require('stripe');
const { randomUUID } = require('node:crypto');
const db = require('../db');

function configuration(env = process.env) {
  const url = new URL(env.APP_BASE_URL || 'http://localhost:3000');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('APP_BASE_URL doit être une origine HTTPS.');
  return { origin: url.origin, price: env.STRIPE_PRICE_ID };
}
function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Le paiement sera disponible prochainement.'), { status: 503 });
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 2 });
}
function validPrice(price) {
  return price && price.active && price.currency === 'eur' && price.unit_amount === 700 &&
    price.recurring?.interval === 'month' && price.recurring.interval_count === 1;
}
async function account(breederId, client = db) {
  return (await client.query('SELECT * FROM billing_accounts WHERE breeder_id=$1', [breederId])).rows[0];
}
async function checkout(user, stripe = stripeClient()) {
  const config = configuration();
  if (!config.price || !validPrice(await stripe.prices.retrieve(config.price))) {
    throw Object.assign(new Error('Le tarif de 7 € par mois doit être configuré avant de souscrire.'), { status: 503 });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const billing = (await client.query('SELECT * FROM billing_accounts WHERE breeder_id=$1 FOR UPDATE', [user.breeder_id])).rows[0];
    if (!billing) throw new Error('Compte de facturation absent.');
    if (billing.beta_access) throw Object.assign(new Error('Votre accès de test est déjà actif.'), { status: 409 });
    if (billing.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(billing.status)) {
      throw Object.assign(new Error('Gérez votre abonnement existant depuis le portail de facturation.'), { status: 409 });
    }
    if (billing.checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(billing.checkout_session_id);
      if (existing.status === 'open' && existing.url) { await client.query('COMMIT'); return existing.url; }
      if (existing.status === 'complete') throw Object.assign(new Error('Votre paiement est en cours de confirmation. Actualisez dans quelques instants.'), { status: 409 });
      billing.checkout_attempt = randomUUID();
    }
    if (!billing.stripe_customer_id) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { breeder_id: user.breeder_id } }, { idempotencyKey: `breeder-customer-${user.breeder_id}` });
      billing.stripe_customer_id = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: billing.stripe_customer_id,
      client_reference_id: user.breeder_id,
      line_items: [{ price: config.price, quantity: 1 }],
      subscription_data: { metadata: { breeder_id: user.breeder_id } },
      metadata: { breeder_id: user.breeder_id },
      success_url: config.origin + '/billing?result=success', cancel_url: config.origin + '/billing?result=cancel',
      allow_promotion_codes: false,
    }, { idempotencyKey: `breeder-checkout-${user.breeder_id}-${billing.checkout_attempt}` });
    await client.query(`UPDATE billing_accounts SET stripe_customer_id=$2,checkout_session_id=$3,checkout_attempt=$4,updated_at=now() WHERE breeder_id=$1`,
      [user.breeder_id, billing.stripe_customer_id, session.id, billing.checkout_attempt]);
    await client.query('COMMIT');
    return session.url;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function portal(user, stripe = stripeClient()) {
  const billing = await account(user.breeder_id);
  if (!billing?.stripe_customer_id) throw Object.assign(new Error('Aucun abonnement à gérer pour le moment.'), { status: 409 });
  return (await stripe.billingPortal.sessions.create({ customer: billing.stripe_customer_id, return_url: configuration().origin + '/billing' })).url;
}
const relevantEvents = new Set(['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']);
async function processEvent(event, stripe = stripeClient()) {
  if (!relevantEvents.has(event.type)) return;
  const object = event.data.object;
  const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
  const subscriptionId = event.type === 'checkout.session.completed' ? object.subscription : object.id;
  if (!customerId || typeof subscriptionId !== 'string') return;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const billing = (await client.query('SELECT * FROM billing_accounts WHERE stripe_customer_id=$1 FOR UPDATE', [customerId])).rows[0];
    // A checkout can finish before the creation transaction commits. Ask Stripe to retry.
    if (!billing) throw new Error('Unknown billing customer');
    if ((await client.query('SELECT event_id FROM app_private.billing_events WHERE event_id=$1 AND breeder_id=$2', [event.id, billing.breeder_id])).rows.length) {
      await client.query('COMMIT'); return;
    }
    // Read the current provider state under the account lock, never trust a stale event snapshot.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.customer !== customerId || subscription.metadata?.breeder_id !== billing.breeder_id) throw new Error('Subscription ownership mismatch');
    const items = subscription.items?.data || [];
    const knownPrice = items.length === 1 && items[0].price.id === configuration().price && validPrice(items[0].price) && items[0].quantity === 1;
    // Old subscriptions must never overwrite a newer subscription on the same account.
    if (billing.stripe_subscription_id && billing.stripe_subscription_id !== subscriptionId &&
        !['canceled', 'incomplete_expired'].includes(billing.status)) {
      await client.query('COMMIT'); return;
    }
    if (billing.stripe_subscription_id && billing.stripe_subscription_id !== subscriptionId) {
      const previous = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
      if (subscription.created <= previous.created) { await client.query('COMMIT'); return; }
    }
    const periodEnd = items[0]?.current_period_end || subscription.current_period_end;
    await client.query(`UPDATE billing_accounts SET stripe_subscription_id=$2,status=$3,current_period_end=$4,
      cancel_at_period_end=$5,checkout_attempt=CASE WHEN checkout_session_id IS NOT NULL THEN gen_random_uuid() ELSE checkout_attempt END,
      checkout_session_id=NULL,updated_at=now() WHERE breeder_id=$1`, [billing.breeder_id, subscriptionId,
      knownPrice ? subscription.status : 'price_mismatch', periodEnd ? new Date(periodEnd * 1000) : null, subscription.cancel_at_period_end === true]);
    await client.query('INSERT INTO app_private.billing_events(event_id,breeder_id) VALUES($1,$2)', [event.id, billing.breeder_id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function webhook(req, res) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return res.sendStatus(503);
  const stripe = stripeClient();
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).send('Signature invalide.'); }
  try { await processEvent(event, stripe); return res.sendStatus(200); }
  catch { console.error('billing.webhook_failed', { eventId: event.id, type: event.type }); return res.sendStatus(500); }
}
module.exports = { account, checkout, portal, webhook, processEvent, validPrice, configuration };
