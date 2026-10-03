const test = require('node:test');
const assert = require('node:assert/strict');
const { database } = require('./helpers/database.cjs');
const { apply } = require('../sql/migrate');
process.env.NODE_ENV = 'test';
test('profile settings and bronze training variables round-trip through authenticated routes', async t => {
  const {engine,client} = await database();
  t.after(()=>engine.close());
  await apply(client);
  const db = require('../src/db');
  const errors = [];
  t.mock.method(db.pool,'connect',async()=>client);
  t.mock.method(db.pool,'query',async(sql,params)=>{
    try { return await client.query(sql,params); }
    catch(error) { errors.push({message:error.message,sql});throw error; }
  });
  const user = await require('../src/services/auth.service').createBreederWithAdmin({kennelName:'Smoke',fullName:'Smoke owner',email:'smoke@example.test',password:'smoke-password-123',primaryBreed:'Test'});
  await client.query('UPDATE billing_accounts SET beta_access=true WHERE breeder_id=$1',[user.breeder_id]);
  const dog = (await client.query("INSERT INTO dogs (breeder_id,name,sex,status) VALUES ($1,'Demo UX','F','actif') RETURNING id",[user.breeder_id])).rows[0];
  const session = require('express-session');
  const storePath = require.resolve('connect-pg-simple');require(storePath);require.cache[storePath].exports=()=>session.MemoryStore;
  const server = require('../src/app').listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const first = await fetch(base+'/auth/login');
  const token = (await first.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  const beforeCookie = first.headers.getSetCookie().find(c=>c.startsWith('sid=')).split(';')[0];
  const login = await fetch(base+'/auth/login',{redirect:'manual',method:'POST',headers:{cookie:beforeCookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,email:user.email,password:'smoke-password-123'})});
  assert.equal(login.status,302);
  const cookie = login.headers.getSetCookie().find(c=>c.startsWith('sid=')).split(';')[0];
  const profileRedirect = await fetch(base+'/profile',{redirect:'manual',headers:{cookie}});
  assert.equal(profileRedirect.status,302);
  assert.equal(profileRedirect.headers.get('location'),'/settings?tab=application#mon-profil');
  const profilePage = await fetch(base+'/settings',{headers:{cookie}});
  const profileCsrf = (await profilePage.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  assert.equal((await fetch(base+'/account/profile',{redirect:'manual',method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({first_name:'Jean',last_name:'Test'})})).status,403);
  const profileSaved = await fetch(base+'/account/profile',{redirect:'manual',method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:profileCsrf,first_name:'Jean',last_name:'Test'})});
  assert.equal(profileSaved.status,302);
  assert.equal(profileSaved.headers.get('location'),'/settings?tab=application#mon-profil');
  assert.match(await (await fetch(base+'/settings',{headers:{cookie}})).text(),/value="Jean"/);
  const trainingForm = await fetch(base+'/training/new',{headers:{cookie}});
  assert.equal(trainingForm.status,200);
  const trainingBody = await trainingForm.text();
  assert.match(trainingBody,/cgv_mediator_name/);
  assert.match(trainingBody,/Aucune décharge générale/);
  assert.match(trainingBody,/data-terms-preview/);
  assert.equal((await fetch(base+'/training/new',{redirect:'manual'})).status,302);
  const trainingCsrf = trainingBody.match(/name="_csrf" value="([^"]+)"/)[1];
  const trainingInput = {
    _csrf: trainingCsrf, client_name: 'Client test', dog_name: 'Chien confié', service_label: 'Dressage',
    start_date: '2026-10-05', end_date: '2026-10-09', start_time: '09:00', end_time: '17:00',
    weekdays: '1', price: '1200', deposit: '300', vat_rate: '20',
    terms: require('../src/services/training-terms.service').defaultTerms,
    cgv_insurance: 'Police 123 du dossier', cgv_mediator_name: 'Médiateur du dossier',
    cgv_emergency_limit: '250', cgv_deposit_due: '2026-10-04',
  };
  const trainingCreated = await fetch(base+'/training',{redirect:'manual',method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(trainingInput)});
  assert.equal(trainingCreated.status,302);
  const trainingLocation = trainingCreated.headers.get('location');
  const trainingId = trainingLocation.split('/')[2];
  const storedTraining = (await client.query('SELECT * FROM training_jobs WHERE id=$1 AND breeder_id=$2',[trainingId,user.breeder_id])).rows[0];
  assert.equal(storedTraining.details.quote_variables.insurance,'Police 123 du dossier');
  assert.equal(storedTraining.terms,trainingInput.terms);
  const editTraining = await fetch(base+trainingLocation+'/edit',{headers:{cookie}});
  assert.match(await editTraining.text(),/value="Police 123 du dossier"/);
  const trainingPdf = await fetch(base+trainingLocation+'/quote.pdf',{headers:{cookie}});
  assert.equal(trainingPdf.status,200);
  assert.match(trainingPdf.headers.get('content-type'),/application\/pdf/);
  assert.equal(Buffer.from(await trainingPdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  assert.deepEqual(errors,[]);
});

