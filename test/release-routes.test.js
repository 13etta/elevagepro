const test = require('node:test');
const assert = require('node:assert/strict');
const { database } = require('./helpers/database.cjs');
const { apply } = require('../sql/migrate');
process.env.NODE_ENV = 'test';
test('authenticated business pages and export run against the migrated schema', async t => {
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
  const training = require('../src/services/training.service');
  const trainingInput={client_name:'Client test',dog_name:'Chien confié',service_label:'Dressage',start_date:'2026-09-07',end_date:'2026-09-11',start_time:'09:00',end_time:'17:00',weekdays:['1','2','3','4','5'],price:'800',deposit:'240',vat_rate:'0',tax_note:'Régime fiscal renseigné',terms:'Conditions acceptées'};
  const job=await training.create(user.breeder_id,trainingInput);
  for(const route of ['/training','/training/new','/training/'+job.id,'/training/'+job.id+'/edit']) {
    const page=await fetch(base+route,{headers:{cookie}});
    assert.equal(page.status,200,route); assert.match(await page.text(),/Dressage|dressage/);
  }
  assert.equal((await fetch(base+'/training',{redirect:'manual'})).status,302);
  assert.equal((await fetch(base+'/training/'+job.id+'/accept',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:'acceptance_reference=test'})).status,403);
  for(const route of ['/dogs/'+dog.id,'/reproduction','/heats/new','/matings/new','/litters/new','/dashboard','/dogs','/dogs/new','/soins','/reminders','/health-tests','/heats','/matings','/pregnancies','/litters','/puppies','/sales','/sales/new','/profitability','/structure','/calendar','/settings','/settings?tab=vitrine','/billing','/account/export','/site/preview']) {
    const response = await fetch(base+route,{redirect:'manual',headers:{cookie}});
    const body = await response.text();
    assert.ok([200,302].includes(response.status),route+': '+response.status+' '+body.slice(0,150));
  }
  // The website editor must round-trip settings without publishing a draft or touching another breeder.
  const other = await require('../src/services/auth.service').createBreederWithAdmin({kennelName:'Other breeder',fullName:'Other',email:'other@example.test',password:'smoke-password-456',primaryBreed:'Test'});
  const originalOther = (await client.query('SELECT website_settings FROM breeder WHERE id=$1',[other.breeder_id])).rows[0].website_settings;
  const settingsPage = await fetch(base+'/settings?tab=vitrine',{headers:{cookie}});
  const csrf = (await settingsPage.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  const form = new FormData();
  Object.entries({_csrf:csrf,heroTitle:'Notre élevage personnalisé',heroLayout:'centered',headingFont:'sans',imagePosition:'right',publicEmail:'public@example.test',showIntro:'on',showContact:'on',breeder_id:other.breeder_id}).forEach(([key,value])=>form.append(key,value));
  const saved = await fetch(base+'/settings/website',{method:'POST',headers:{cookie},body:form,redirect:'manual'});
  assert.equal(saved.status,302);
  const stored = (await client.query('SELECT website_settings FROM breeder WHERE id=$1',[user.breeder_id])).rows[0].website_settings;
  assert.equal(stored.heroTitle,'Notre élevage personnalisé');
  assert.equal(stored.heroLayout,'centered');
  assert.equal(stored.publicEmail,'public@example.test');
  assert.equal(stored.isPublished,false);
  assert.deepEqual((await client.query('SELECT website_settings FROM breeder WHERE id=$1',[other.breeder_id])).rows[0].website_settings,originalOther);
  assert.equal((await fetch(base+'/site/'+user.breeder_id)).status,404);
  assert.equal((await fetch(base+'/site/'+other.breeder_id,{headers:{cookie}})).status,404);
  const preview = await fetch(base+'/site/preview',{headers:{cookie}});
  assert.equal(preview.status,200);
  assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(await preview.text(),/Notre élevage personnalisé/);
  assert.equal((await fetch(base+'/site/preview',{redirect:'manual'})).status,302);
  form.append('isPublished','on');
  assert.equal((await fetch(base+'/settings/website',{method:'POST',headers:{cookie},body:form,redirect:'manual'})).status,302);
  const published=await fetch(base+'/site/'+user.breeder_id);
  assert.equal(published.status,200);
  assert.match(await published.text(),/mailto:public@example.test/);
  assert.deepEqual(errors,[]);
});
