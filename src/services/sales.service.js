const db = require('../db');
const register = require('./register.service');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function money(value) {
  const text = String(value ?? '0').trim().replace(',', '.') || '0';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text)) fail('Le montant doit être positif avec deux décimales maximum.');
  return Number(text);
}
function fields(input) {
  if (typeof input.buyer_name !== 'string' || !input.buyer_name.trim() || input.buyer_name.length > 255) fail('Le nom de l’acquéreur est obligatoire (255 caractères maximum).');
  if (typeof input.sale_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.sale_date) ||
      !Number.isFinite(Date.parse(input.sale_date)) || new Date(input.sale_date).toISOString().slice(0,10) !== input.sale_date) fail('Date de transaction invalide.');
  const price = money(input.price), deposit = money(input.deposit_amount);
  if (deposit > price) fail('L’acompte ne peut pas dépasser le prix de vente.');
  return { buyer: input.buyer_name.trim(), date: input.sale_date, price, deposit,
    payment: typeof input.payment_method === 'string' ? input.payment_method.slice(0,50) : null,
    notes: typeof input.notes === 'string' ? input.notes.slice(0,10000) : null };
}
async function transaction(work) {
  const client = await db.pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function animal(client, breederId, type, id) {
  const table = type === 'puppy' ? 'puppies' : 'dogs';
  const row = (await client.query(`SELECT * FROM ${table} WHERE id=$1 AND breeder_id=$2 FOR UPDATE`, [id, breederId])).rows[0];
  if (!row) fail('Animal introuvable pour cet élevage.', 404);
  return row;
}
async function finalize(client, breederId, sale, row) {
  const type = sale.puppy_id ? 'puppy' : 'dog';
  if (type === 'puppy') await client.query('UPDATE puppies SET status=$1,is_sold=$2 WHERE id=$3 AND breeder_id=$4', ['Vendu', true, row.id, breederId]);
  else await client.query('UPDATE dogs SET status=$1 WHERE id=$2 AND breeder_id=$3', ['Vendu', row.id, breederId]);
  const logged = await register.logSaleExit({ breederId, dbClient: client, sale: { ...sale, animal_name: row.name, animal_chip_number: row.chip_number, animal_type: type } });
  if (!logged) throw new Error('La vente et le registre doivent être enregistrés ensemble.');
}
async function create(breederId, input) {
  const data = fields(input);
  const match = typeof input.animal_selection === 'string' && /^(puppy|dog)\|([a-f0-9-]{36})$/i.exec(input.animal_selection);
  if (!match) fail('Sélection animal invalide.');
  const [, type, id] = match;
  const reservation = input.is_reservation === 'true';
  return transaction(async client => {
    const row = await animal(client, breederId, type, id);
    const status = String(row.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (['vendu','vendue','sold','decede','decedee','dead','sorti','sortie'].includes(status) || row.is_sold) fail('Cet animal n’est plus disponible pour une vente.', 409);
    const reference = type === 'puppy' ? 'puppy_id' : 'dog_id';
    if ((await client.query(`SELECT id FROM sales WHERE breeder_id=$1 AND ${reference}=$2 LIMIT 1`, [breederId, id])).rows.length) fail('Une transaction existe déjà. Ouvrez-la pour la modifier ou finaliser la réservation.', 409);
    const sale = (await client.query(`INSERT INTO sales(breeder_id,puppy_id,dog_id,buyer_name,sale_date,price,payment_method,notes,is_reservation,deposit_amount)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [breederId, type==='puppy'?id:null, type==='dog'?id:null, data.buyer,data.date,data.price,data.payment,data.notes,reservation,data.deposit])).rows[0];
    if (reservation) {
      if (type === 'puppy') await client.query('UPDATE puppies SET status=$1,is_sold=false WHERE id=$2 AND breeder_id=$3', ['Réservé',id,breederId]);
      else await client.query('UPDATE dogs SET status=$1 WHERE id=$2 AND breeder_id=$3', ['Réservé',id,breederId]);
    } else await finalize(client, breederId, sale, row);
    return sale;
  });
}
async function update(breederId, saleId, input) {
  const data = fields(input);
  return transaction(async client => {
    const sale = (await client.query('SELECT * FROM sales WHERE id=$1 AND breeder_id=$2 FOR UPDATE', [saleId,breederId])).rows[0];
    if (!sale) fail('Vente introuvable.',404);
    const row = await animal(client,breederId,sale.puppy_id?'puppy':'dog',sale.puppy_id||sale.dog_id);
    const completing = sale.is_reservation && input.finalize_sale === 'true';
    if (completing && /^(décédé|decede|décédée|decedee|dead|sorti|sortie)$/i.test(row.status || '')) fail('Le statut de cet animal ne permet pas de finaliser la vente.',409);
    const updated = (await client.query(`UPDATE sales SET buyer_name=$1,sale_date=$2,price=$3,payment_method=$4,notes=$5,deposit_amount=$6,is_reservation=$7
      WHERE id=$8 AND breeder_id=$9 RETURNING *`, [data.buyer,data.date,data.price,data.payment,data.notes,data.deposit,completing?false:sale.is_reservation,saleId,breederId])).rows[0];
    if (completing) await finalize(client,breederId,updated,row);
    return updated;
  });
}
module.exports = { create, update, money, fields };
