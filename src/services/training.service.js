const { randomUUID } = require('node:crypto');
const db = require('../db');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function cents(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) fail('Montant invalide : deux décimales maximum.');
  return Math.round(Number(raw) * 100);
}
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Date invalide.');
  return value;
}
function text(value, max = 255) {
  if (value != null && typeof value !== 'string') fail('Texte invalide.');
  const result = String(value || '').trim();
  if (result.length > max) fail(`Texte trop long (${max} caractères maximum).`);
  return result;
}
function uuid(value) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) fail('Dossier introuvable.',404); return value; }
function fields(input) {
  const f = {};
  for (const name of ['client_name','client_address','client_email','client_phone','dog_name','dog_breed','dog_chip','service_label','tax_note','terms','notes']) f[name] = text(input[name], ['terms','notes'].includes(name) ? 12000 : name === 'client_address' || name === 'tax_note' ? 2000 : 255);
  if (!f.client_name || !f.dog_name || !f.service_label) fail('Client, chien et prestation obligatoires.');
  if(input.next==='print' && ['client_address','client_phone','dog_breed','dog_chip','terms'].some(name=>!f[name])) fail('Complétez l’adresse, le téléphone, la race, l’identification et les conditions avant d’imprimer le devis.');
  f.quote_date = input.quote_date ? date(input.quote_date) : new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
  f.valid_until = input.valid_until ? date(input.valid_until) : null;
  if(f.valid_until && f.valid_until < f.quote_date) fail('La validité du devis doit suivre sa date d’émission.');
  const details={};
  for(const name of ['client_first_name','dog_lof','veterinarian','health_notes','feeding_notes','training_objectives','accommodation','included_services','payment_terms','handover_location']) details[name]=text(input[name],name.endsWith('_notes')||name.endsWith('_services')||name==='training_objectives'||name==='payment_terms'?4000:255);
  details.dog_sex=text(input.dog_sex,10);
  if(details.dog_sex && !['M','F'].includes(details.dog_sex)) fail('Sexe du chien invalide.');
  details.dog_birth_date=input.dog_birth_date?date(input.dog_birth_date):null;
  if(details.dog_birth_date && details.dog_birth_date>f.quote_date) fail('La naissance du chien ne peut pas être future.');
  f.details=details;
  f.start_date = date(input.start_date); f.end_date = date(input.end_date);
  if (f.end_date < f.start_date || (Date.parse(f.end_date)-Date.parse(f.start_date))/86400000 > 365) fail('Période invalide (maximum un an).');
  for (const name of ['start_time','end_time']) { f[name] = text(input[name]); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f[name])) fail('Horaire invalide.'); }
  if (f.end_time <= f.start_time) fail('La fin doit suivre le début.');
  const days = Array.isArray(input.weekdays) ? input.weekdays : input.weekdays == null ? [] : [input.weekdays];
  if (days.some(d => !/^[0-6]$/.test(String(d))) || !days.length) fail('Choisissez les jours de séance.');
  f.weekdays = [...new Set(days.map(Number))];
  f.price_cents = cents(input.price); f.deposit_cents = cents(input.deposit);
  if (!f.price_cents || f.deposit_cents > f.price_cents) fail('Prix ou acompte invalide.');
  const rate = String(input.vat_rate ?? '0').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(rate) || Number(rate)>100) fail('Taux de TVA invalide.');
  f.vat_rate = Number(rate);
  if (f.vat_rate === 0 && !f.tax_note) fail('Renseignez la mention fiscale applicable lorsque la TVA est à zéro.');
  const sessions = sessionDates(f);
  if (!sessions.length) fail('Aucune séance dans cette période pour les jours choisis.');
  return f;
}
function sessionDates(job) {
  const normalize = v => v instanceof Date ? v.toISOString().slice(0,10) : String(v).slice(0,10);
  const dates = [];
  for (let d = new Date(normalize(job.start_date)); d <= new Date(normalize(job.end_date)); d.setUTCDate(d.getUTCDate()+1)) {
    if (job.weekdays.includes(d.getUTCDay())) dates.push(d.toISOString().slice(0,10));
  }
  return dates;
}
async function transaction(work) {
  const client = await db.pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function get(breederId, id, client = db, lock = false) {
  const result = await client.query(`SELECT * FROM training_jobs WHERE breeder_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`, [breederId,uuid(id)]);
  if (!result.rows[0]) fail('Dossier introuvable.',404);
  return result.rows[0];
}
async function totals(client, breederId, id) {
  return (await client.query(`SELECT COALESCE(SUM(CASE WHEN kind='refund' THEN -amount_cents ELSE amount_cents END),0)::int AS received,
    COALESCE(SUM(CASE WHEN kind='deposit' THEN amount_cents ELSE 0 END),0)::int AS deposits
    FROM training_payments WHERE breeder_id=$1 AND job_id=$2`,[breederId,id])).rows[0];
}
async function nextNumber(client, breederId, series) {
  const year = new Date().getUTCFullYear();
  const row = (await client.query(`INSERT INTO commercial_document_counters(breeder_id,series,year,value) VALUES($1,$2,$3,1)
    ON CONFLICT(breeder_id,series,year) DO UPDATE SET value=commercial_document_counters.value+1 RETURNING value`,[breederId,series,year])).rows[0];
  return `${series}-${year}-${String(row.value).padStart(5,'0')}`;
}
async function syncCalendar(client, breederId, job) {
  if (job.status !== 'accepted') return;
  const total = await totals(client,breederId,job.id);
  if (job.status === 'accepted' && total.deposits >= job.deposit_cents) {
    job = (await client.query("UPDATE training_jobs SET status='confirmed' WHERE breeder_id=$1 AND id=$2 RETURNING *",[breederId,job.id])).rows[0];
  }
  if (job.status !== 'confirmed') return;
  for (const day of sessionDates(job)) {
    await client.query(`INSERT INTO calendar_events(breeder_id,title,category,event_date,start_time,end_time,all_day,status,notes,training_job_id,reminder_days)
      VALUES($1,$2,'entrainement',$3,$4,$5,false,'confirme',$6,$7,ARRAY[1])
      ON CONFLICT(training_job_id,event_date) WHERE training_job_id IS NOT NULL DO NOTHING`,
    [breederId,`Dressage — ${job.dog_name}`,day,job.start_time,job.end_time,`Client : ${job.client_name} • ${job.service_label} • Devis ${job.quote_number}`,job.id]);
  }
}
async function create(breederId,input) {
  const f = fields(input);
  return transaction(async client => {
    const number = await nextNumber(client,breederId,'DEV-D');
    const keys = Object.keys(f);
    return (await client.query(`INSERT INTO training_jobs(breeder_id,quote_number,${keys.join(',')}) VALUES($1,$2,${keys.map((_,i)=>'$'+(i+3)).join(',')}) RETURNING *`,[breederId,number,...keys.map(k=>f[k])])).rows[0];
  });
}
async function accept(breederId,id,reference) {
  reference = text(reference,2000); if (!reference) fail('Indiquez la preuve d’accord du client (devis signé, référence du courriel).');
  return transaction(async client => {
    let job = await get(breederId,id,client,true);
    if (['cancelled','completed'].includes(job.status)) fail('Dossier clos.',409);
    if (job.status === 'draft') job = (await client.query("UPDATE training_jobs SET status='accepted',accepted_at=now(),acceptance_reference=$3 WHERE breeder_id=$1 AND id=$2 RETURNING *",[breederId,id,reference])).rows[0];
    await syncCalendar(client,breederId,job);
  });
}
async function update(breederId,id,input) {
  const f = fields(input);
  return transaction(async client=>{
    const job = await get(breederId,id,client,true);
    if(job.status!=='draft') fail('Le devis accepté est figé. Créez un nouveau dossier pour un nouvel accord.',409);
    const keys=Object.keys(f);
    await client.query(`UPDATE training_jobs SET ${keys.map((k,i)=>k+'=$'+(i+3)).join(',')} WHERE breeder_id=$1 AND id=$2`,[breederId,id,...keys.map(k=>f[k])]);
  });
}
async function payment(breederId,id,input) {
  const amount = cents(input.amount), kind = input.kind, key = uuid(input.idempotency_key);
  const paidOn = date(input.paid_on), method = text(input.method,80), reference = text(input.reference);
  if (!amount || !method || !reference || !['deposit','balance','refund'].includes(kind)) fail('Paiement incomplet.');
  if (paidOn > new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})) fail('La date d’encaissement ne peut pas être future.');
  return transaction(async client => {
    const job = await get(breederId,id,client,true);
    const previous = (await client.query('SELECT * FROM training_payments WHERE breeder_id=$1 AND idempotency_key=$2',[breederId,key])).rows[0];
    if (previous) {
      const previousDate = previous.paid_on instanceof Date ? previous.paid_on.toISOString().slice(0,10) : String(previous.paid_on).slice(0,10);
      if (previous.job_id !== id || previous.amount_cents !== amount || previous.kind !== kind || previousDate !== paidOn || previous.method !== method || previous.reference !== reference) fail('Ce paiement a déjà été utilisé avec d’autres données.',409);
      return previous;
    }
    const total = await totals(client,breederId,id);
    if (kind === 'refund') { if (job.status !== 'cancelled' || amount > total.received) fail('Remboursement impossible : annulez le dossier et vérifiez le montant.'); }
    else {
      if (!['accepted','confirmed','completed'].includes(job.status)) fail('Le devis doit être accepté avant l’encaissement.',409);
      if (amount > job.price_cents-total.received) fail('Le paiement dépasse le solde.');
      if (kind === 'deposit' && amount > job.deposit_cents-total.deposits) fail('L’acompte dépasse le montant prévu : utilisez le règlement du solde.');
      if (kind === 'balance' && job.status === 'accepted') fail('Enregistrez d’abord l’acompte requis.');
    }
    const row = (await client.query(`INSERT INTO training_payments(breeder_id,job_id,kind,amount_cents,paid_on,method,reference,idempotency_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[breederId,id,kind,amount,paidOn,method,reference,key])).rows[0];
    await syncCalendar(client,breederId,job);
    return row;
  });
}
async function close(breederId,id,action) {
  if (!['cancelled','completed'].includes(action)) fail('Action invalide.');
  return transaction(async client => {
    const job = await get(breederId,id,client,true);
    if (job.status === action) return;
    if (job.status === 'cancelled' || (action === 'completed' && job.status !== 'confirmed')) fail('Transition impossible.',409);
    await client.query('UPDATE training_jobs SET status=$3 WHERE breeder_id=$1 AND id=$2',[breederId,id,action]);
    await client.query(`UPDATE calendar_events SET status=$3,updated_at=now() WHERE breeder_id=$1 AND training_job_id=$2`,[breederId,id,action === 'cancelled' ? 'annule' : 'termine']);
  });
}
async function detail(breederId,id) {
  const job = await get(breederId,id);
  const payments = (await db.query('SELECT * FROM training_payments WHERE breeder_id=$1 AND job_id=$2 ORDER BY paid_on,created_at',[breederId,id])).rows;
  return { job,payments,total:await totals(db,breederId,id),paymentKey:randomUUID() };
}
async function documentData(breederId,id,kind,paymentId) {
  if (!['quote','contract','invoice','deposit-invoice','credit'].includes(kind)) fail('Document inconnu.');
  return transaction(async client => {
    const job = await get(breederId,id,client,true);
    const breeder = (await client.query('SELECT * FROM breeder WHERE id=$1',[breederId])).rows[0];
    const payments = (await client.query('SELECT * FROM training_payments WHERE breeder_id=$1 AND job_id=$2 ORDER BY paid_on,created_at',[breederId,id])).rows;
    const total = await totals(client,breederId,id);
    const creditPayment = kind==='credit' ? payments.find(p=>p.id===paymentId && p.kind==='refund') : null;
    if(kind==='credit' && !creditPayment) fail('Sélectionnez le remboursement correspondant à l’avoir.');
    const sourceKey = creditPayment?.id || 'job';
    const snapshot = {job,breeder,payments,total,kind,creditPayment,issued_on:new Date().toISOString().slice(0,10)};
    if (['quote','contract'].includes(kind)) return {...snapshot,number:job.quote_number};
    const existing = (await client.query('SELECT snapshot,number FROM training_documents WHERE breeder_id=$1 AND job_id=$2 AND kind=$3 AND source_key=$4',[breederId,id,kind,sourceKey])).rows[0];
    if (existing) return {...existing.snapshot,number:existing.number};
    if (kind === 'invoice' && job.status !== 'completed') fail('Terminez la prestation avant d’émettre la facture.');
    if (kind === 'deposit-invoice' && (!total.deposits || total.deposits < job.deposit_cents || job.status === 'cancelled')) fail('L’acompte doit être entièrement encaissé avant émission de sa facture.');
    if (kind === 'credit' && !payments.some(p=>p.kind==='refund')) fail('Aucun remboursement enregistré.');
    const number = await nextNumber(client,breederId,kind === 'credit' ? 'AV-D' : 'FAC-D');
    await client.query('INSERT INTO training_documents(breeder_id,job_id,kind,number,snapshot,source_key) VALUES($1,$2,$3,$4,$5,$6)',[breederId,id,kind,number,snapshot,sourceKey]);
    return {...snapshot,number};
  });
}
module.exports = {cents,fields,sessionDates,create,update,accept,payment,close,detail,documentData};
