const test = require('node:test');
const assert = require('node:assert/strict');
const { database } = require('./helpers/database.cjs');
const { apply } = require('../sql/migrate');
process.env.NODE_ENV = 'test';

test('sales, password recovery, shared rate limiting and subscription events on isolated PostgreSQL', async t => {
  const { engine, client } = await database();
  t.after(() => engine.close());
  await apply(client);
  const db = require('../src/db');
  t.mock.method(db.pool, 'connect', async () => client);
  t.mock.method(db.pool, 'query', (sql, params) => client.query(sql, params));
  const auth = require('../src/services/auth.service');
  const user = await auth.createBreederWithAdmin({ kennelName:'A',fullName:'Owner A',email:'a@example.test',password:'test-password-123',primaryBreed:'Test' });
  const other = await auth.createBreederWithAdmin({ kennelName:'B',fullName:'Owner B',email:'b@example.test',password:'test-password-456',primaryBreed:'Test' });
  const a = user.breeder_id, b = other.breeder_id;
  const puppy = (await client.query("INSERT INTO puppies(breeder_id,name,status) VALUES($1,'Test','Disponible') RETURNING id", [a])).rows[0].id;
  const sales = require('../src/services/sales.service');
  const input = { animal_selection:'puppy|'+puppy,buyer_name:'Acheteur test',sale_date:'2026-09-08',price:'900,00',deposit_amount:'100',is_reservation:'true' };
  await assert.rejects(sales.create(b,input), error => error.status === 404);
  await assert.rejects(sales.create(a,{...input,deposit_amount:'901'}), /acompte/);
  await assert.rejects(sales.create(a,{...input,price:'12abc'}), /montant/);
  const sale = await sales.create(a,input);
  await assert.rejects(sales.create(a,input), error => error.status === 409);
  await assert.rejects(sales.update(b,sale.id,input), error => error.status === 404);
  await sales.update(a,sale.id,{...input,finalize_sale:'true'});
  assert.equal((await client.query('SELECT status,is_sold FROM puppies WHERE id=$1 AND breeder_id=$2',[puppy,a])).rows[0].is_sold,true);
  const count = async () => (await client.query("SELECT count(*)::int AS n FROM movements WHERE breeder_id=$1 AND movement_source_type='sale' AND movement_source_id=$2",[a,sale.id])).rows[0].n;
  assert.equal(await count(),1);
  await sales.update(a,sale.id,{...input,finalize_sale:'true'});
  assert.equal(await count(),1);
  const register = require('../src/services/register.service');
  const originalLog = register.logSaleExit;
  register.logSaleExit = async () => false;
  const dog = (await client.query("INSERT INTO dogs(breeder_id,name) VALUES($1,'Rollback') RETURNING id",[a])).rows[0].id;
  try { await assert.rejects(sales.create(a,{...input,animal_selection:'dog|'+dog,is_reservation:'false'})); }
  finally { register.logSaleExit = originalLog; }
  assert.equal((await client.query('SELECT count(*)::int AS n FROM sales WHERE breeder_id=$1 AND dog_id=$2',[a,dog])).rows[0].n,0);
  assert.equal((await client.query('SELECT status FROM dogs WHERE id=$1 AND breeder_id=$2',[dog,a])).rows[0].status,'actif');

  process.env.APP_BASE_URL = 'https://elevagepro.example';
  const recovery = require('../src/services/account-recovery.service');
  const emails = [];
  await recovery.requestReset(user.email, async message => emails.push(message));
  await recovery.requestReset('missing@example.test', async message => emails.push(message));
  assert.equal(emails.length,1);
  const token = emails[0].text.match(/token=([a-f0-9]{64})/)[1];
  assert.equal(await recovery.resetPassword('0'.repeat(64),'new-test-password'),false);
  assert.equal(await recovery.resetPassword(token,'new-test-password'),true);
  assert.equal(await recovery.resetPassword(token,'another-test-password'),false);
  assert.equal(await auth.login({email:user.email,password:'test-password-123'}),null);
  assert.equal((await auth.login({email:user.email,password:'new-test-password'})).session_version,1);
  assert.equal((await auth.login({email:other.email,password:'test-password-456'})).session_version,0);
  const { requireAuth } = require('../src/middleware/auth');
  const req = {session:{user,destroy(cb){this.destroyed=true;cb();}},method:'GET',originalUrl:'/dogs'};
  const res = {locals:{},set(){return this;},clearCookie(){},redirect(url){this.location=url;}};
  await requireAuth(req,res,error=>{throw error || new Error('revoked session accepted');});
  assert.equal(res.location,'/auth/login');

  const { PostgresRateStore } = require('../src/middleware/rate-limit');
  const limits = new PostgresRateStore('test:'); limits.init({windowMs:1000});
  assert.equal((await limits.increment('key')).totalHits,1);
  assert.equal((await limits.increment('key')).totalHits,2);
  await client.query("UPDATE app_private.auth_rate_limits SET reset_at=now()-interval '1 second' WHERE key_hash=$1",[limits.key('key')]);
  assert.equal((await limits.increment('key')).totalHits,1);

  const billing = require('../src/services/billing.service');
  process.env.STRIPE_PRICE_ID = 'price_monthly_7';
  const price = {id:process.env.STRIPE_PRICE_ID,active:true,currency:'eur',unit_amount:700,recurring:{interval:'month',interval_count:1}};
  let checkouts = 0;
  const subscription = {id:'sub_a',customer:'cus_a',metadata:{breeder_id:a},created:1,status:'active',cancel_at_period_end:false,items:{data:[{price,quantity:1,current_period_end:1800000000}]}};
  const stripe = {
    prices:{retrieve:async()=>price}, customers:{create:async()=>({id:'cus_a'})},
    checkout:{sessions:{create:async(params,options)=>{checkouts++;assert.equal(params.line_items[0].quantity,1);assert.match(options.idempotencyKey,/breeder-checkout/);return {id:'cs_a',url:'https://checkout.stripe.com/test'};},retrieve:async()=>({status:'open',url:'https://checkout.stripe.com/test'})}},
    subscriptions:{retrieve:async()=>subscription},billingPortal:{sessions:{create:async params=>{assert.equal(params.customer,'cus_a');return {url:'https://billing.stripe.com/test'};}}},
  };
  assert.equal(await billing.checkout(user,stripe),'https://checkout.stripe.com/test');
  await billing.checkout(user,stripe);assert.equal(checkouts,1);
  assert.equal((await billing.account(a)).status,'inactive'); // Browser return never grants access.
  const event = {id:'evt_1',type:'customer.subscription.updated',data:{object:{id:'sub_a',customer:'cus_a',status:'canceled'}}};
  await billing.processEvent(event,stripe);
  await billing.processEvent(event,stripe);
  assert.equal((await billing.account(a)).status,'active');
  assert.equal((await billing.account(b)).status,'inactive');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM app_private.billing_events WHERE breeder_id=$1',[a])).rows[0].n,1);
  await assert.rejects(billing.checkout(user,stripe),error=>error.status===409);
  assert.equal(await billing.portal(user,stripe),'https://billing.stripe.com/test');
  subscription.status='past_due';await billing.processEvent({...event,id:'evt_2'},stripe);
  assert.equal((await billing.account(a)).status,'past_due');
  subscription.metadata.breeder_id=b;
  await assert.rejects(billing.processEvent({...event,id:'evt_wrong'},stripe),/ownership/);
  assert.equal((await billing.account(a)).status,'past_due');
  assert.equal(billing.validPrice({...price,unit_amount:701}),false);
  assert.equal(billing.validPrice({...price,currency:'usd'}),false);
});

test('upload signatures reject renamed HTML and SVG', () => {
  const { validateUpload } = require('../src/services/uploads.service');
  for (const mimetype of ['image/png','image/jpeg','application/pdf']) assert.throws(()=>validateUpload({mimetype,buffer:Buffer.from('<script>alert(1)</script>')},true));
  assert.throws(()=>validateUpload({mimetype:'image/svg+xml',buffer:Buffer.from('<svg></svg>')}));
  assert.equal(validateUpload({mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')},true).extension,'pdf');
});
