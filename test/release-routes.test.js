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
  for(const route of ['/dogs/'+dog.id,'/reproduction','/heats/new','/matings/new','/litters/new','/dashboard','/dogs','/dogs/new','/soins','/reminders','/health-tests','/heats','/matings','/pregnancies','/litters','/puppies','/sales','/sales/new','/profitability','/structure','/calendar','/settings','/billing','/account/export','/site/preview']) {
    const response = await fetch(base+route,{redirect:'manual',headers:{cookie}});
    const body = await response.text();
    assert.ok([200,302].includes(response.status),route+': '+response.status+' '+body.slice(0,150));
  }
  assert.deepEqual(errors,[]);
});
