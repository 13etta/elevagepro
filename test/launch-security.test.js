const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const { databaseOptions } = require('../src/config/database');
const { localReturnPath, establishSession } = require('../src/services/login-session.service');
const { defaultWebsiteSettings, buildServices } = require('../src/services/website-settings.service');

test('TLS verifies certificates even when the URL asks for sslmode=require', () => {
  const options = databaseOptions({DATABASE_URL:'postgres://user:password@localhost/db?sslmode=require',DATABASE_CA_CERT:'line1\\nline2'});
  assert.equal(options.ssl.rejectUnauthorized,true);
  assert.equal(options.ssl.ca,'line1\nline2');
  assert.ok(!options.connectionString.includes('sslmode'));
  assert.throws(()=>databaseOptions({NODE_ENV:'production',DATABASE_SSL:'false'}));
  assert.equal(databaseOptions({DATABASE_SSL:'false'}).ssl,false);
});

test('authentication regenerates and saves a session without carrying the old CSRF token', async () => {
  const order=[]; const user={id:'user',breeder_id:'breeder'};
  const req={session:{csrfToken:'old',returnTo:'/dogs?x=1',preferences:{lang:'fr'},regenerate(cb){order.push('regenerate');req.session={save(cb){order.push('save');cb();}};cb();}}};
  assert.equal(await establishSession(req,user),'/dogs?x=1');
  assert.deepEqual(order,['regenerate','save']);assert.equal(req.session.csrfToken,undefined);assert.equal(req.session.user,user);
  for(const value of ['//evil.test','/\\evil.test','https://evil.test','/dogs\r\nLocation: bad',null]) assert.equal(localReturnPath(value),'/dashboard');
});

test('public website requires explicit address publication and never renders internal notes', async () => {
  const settings=defaultWebsiteSettings();
  const data={title:'Test',breeder:{company_name:'Élevage test',address:'ADRESSE PRIVEE TEST',email:'contact@example.test'},websiteSettings:settings,publicServices:buildServices(settings),dogsByBreed:{Test:[{name:'Test',sex:'male',breed:'Test',notes:'NOTE CONFIDENTIELLE TEST'}]},puppiesByBreed:{},littersByBreed:{},formatDate:()=>'-'};
  const template=path.resolve(__dirname,'../src/views/website/public-site.ejs');
  const html=await ejs.renderFile(template,data);
  assert.ok(!html.includes('ADRESSE PRIVEE TEST'));assert.ok(!html.includes('NOTE CONFIDENTIELLE TEST'));
  assert.ok(html.includes('mailto:contact@example.test'));assert.ok(!html.includes('Envoyer le message'));
  data.websiteSettings={...settings,showPublicAddress:true};
  assert.ok((await ejs.renderFile(template,data)).includes('ADRESSE PRIVEE TEST'));
});

test('real HTTP routes: private access, session rotation, CSRF and certificate tenant isolation', async t => {
  process.env.NODE_ENV='test';
  // Only the session persistence and business DB are replaced. Actual Express routes run.
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  const session=require('express-session');
  const storePath=require.resolve('connect-pg-simple');require(storePath);require.cache[storePath].exports=()=>session.MemoryStore;
  const db=require('../src/db');
  t.after(()=>db.pool.end());const auth=require('../src/services/auth.service');
  const user={id:'user-a',breeder_id:'breeder-a',full_name:'Test',role:'owner',session_version:0,is_active:true,beta_access:true};
  t.mock.method(auth,'login',async()=>user);
  let queries=0;
  t.mock.method(db.pool,'query',async(sql,values)=>{
    if (sql.includes('FROM users u')) return {rows:[user]};
    if (sql.includes('FROM dogs')) { assert.equal(values[0], 'breeder-a'); return {rows:[]}; }
    queries++;
    assert.match(sql,/WHERE breeder_id = \$1 AND certificate_url = \$2/);
    assert.equal(values[0],'breeder-a');
    return {rows: values[1]==='/uploads/health-tests/breeder-a-fixture.pdf' ? [{id:'owned'}] : []};
  });
  const app=require('../src/app');
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const request=(url,options={})=>fetch(base+url,{redirect:'manual',...options});
  const health=await request('/healthz');assert.equal(health.status,200);assert.equal(health.headers.get('set-cookie'),null);
  for(const url of ['/dashboard','/dogs','/sales','/health-tests','/settings','/site','/uploads/health-tests/breeder-a-fixture.pdf']){
    const res=await request(url);assert.equal(res.status,302,url);assert.equal(res.headers.get('location'),'/auth/login',url);
  }
  const login=await request('/auth/login');const html=await login.text();
  const oldCookie=login.headers.getSetCookie().find(c=>c.startsWith('sid=')).split(';')[0];
  const token=html.match(/name="_csrf" value="([^"]+)"/)[1];
  const invalid=await request('/auth/login',{method:'POST',headers:{cookie:oldCookie,'Content-Type':'application/x-www-form-urlencoded'},body:'email=test&password=test'});assert.equal(invalid.status,403);
  const logged=await request('/auth/login',{method:'POST',headers:{cookie:oldCookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,email:'test@example.test',password:'testpassword'})});
  assert.equal(logged.status,302);
  const cookie=logged.headers.getSetCookie().find(c=>c.startsWith('sid=')).split(';')[0];assert.notEqual(cookie,oldCookie);
  assert.equal((await request('/dogs',{headers:{cookie:oldCookie}})).status,302);
  const privateRoot=require('../src/services/certificates.service').privateRoot;
  const directory=path.join(privateRoot,'health-tests');await fs.mkdir(directory,{recursive:true});
  const fixture=path.join(directory,'breeder-a-fixture.pdf');await fs.writeFile(fixture,'%PDF-1.4 test');t.after(()=>fs.unlink(fixture));
  const owned=await request('/uploads/health-tests/breeder-a-fixture.pdf',{headers:{cookie}});assert.equal(owned.status,200);assert.match(owned.headers.get('cache-control'),/no-store/);assert.match(owned.headers.get('content-disposition'),/attachment/);assert.equal(await owned.text(),'%PDF-1.4 test');
  assert.equal((await request('/uploads/health-tests/breeder-b-fixture.pdf',{headers:{cookie}})).status,404);
  assert.equal((await request('/uploads/%68ealth-tests/breeder-a-fixture.pdf',{headers:{cookie}})).status,404);
  assert.equal((await request('/uploads/health-tests/nested/file.pdf',{headers:{cookie}})).status,404);
  assert.equal(queries,2);
  assert.equal(owned.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await request('/auth/login',{headers:{cookie:'lang=%ZZ'}})).status,200);
});

test('puppy ads keep sold/deceased status and avoid unsupported fallback claims', async t => {
  const old={AI_PROVIDER:process.env.AI_PROVIDER,OPENAI_API_KEY:process.env.OPENAI_API_KEY,GEMINI_API_KEY:process.env.GEMINI_API_KEY};
  delete process.env.OPENAI_API_KEY;delete process.env.GEMINI_API_KEY;delete process.env.AI_PROVIDER;
  t.after(()=>{for(const [key,value] of Object.entries(old)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  const {generatePuppyAd}=require('../src/services/puppy-ad-agent.service');
  for(const status of ['Vendu','Decede','Reserve']) {
    const ad=await generatePuppyAd({puppy:{name:'Test',status,chip_number:'250001234567890',notes:'Puce 250001234567890'},breeder:{company_name:'Test'}});
    assert.match(ad.long_ad,new RegExp('Statut actuel : '+status));
    assert.ok(!JSON.stringify(ad).includes('250001234567890'));
    assert.ok(!ad.social_post.includes('cherche sa future famille'));
    assert.ok(!ad.long_ad.includes('suivi sanitaire structuré'));
  }
  const ad=await generatePuppyAd({puppy:{name:'Test'}});assert.ok(ad.missing_information.includes('Statut du chiot'));assert.ok(!ad.short_ad.includes('disponible'));
});

test('the outgoing AI prompt omits the chip unless explicitly requested', async t => {
  const old={AI_PROVIDER:process.env.AI_PROVIDER,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
  process.env.AI_PROVIDER='openai';process.env.OPENAI_API_KEY='test-only';
  t.after(()=>{for(const [key,value] of Object.entries(old)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  const prompts=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{prompts.push(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"title":"Test"}'}}]})};});
  const {generatePuppyAd}=require('../src/services/puppy-ad-agent.service');
  const data={puppy:{name:'Test',chip_number:'250001234567890',notes:'Puce 250001234567890'}};
  await generatePuppyAd(data);await generatePuppyAd(data,{showChipNumber:true});
  assert.equal(prompts.length,2);assert.ok(!prompts[0].includes('250001234567890'));assert.ok(prompts[1].includes('250001234567890'));
});
