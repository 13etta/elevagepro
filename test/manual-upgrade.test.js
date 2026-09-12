const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database } = require('./helpers/database.cjs');
const { buildManualUpgrade } = require('../sql/build-manual-upgrade');
const { plan } = require('../sql/migrate');

test('manual Supabase SQL preserves every pre-existing value and can be run twice', async t => {
  const { engine, client } = await database();
  t.after(()=>engine.close());
  const a = (await client.query("INSERT INTO breeder(company_name) VALUES('Existing A') RETURNING id")).rows[0].id;
  const b = (await client.query("INSERT INTO breeder(company_name) VALUES('Existing B') RETURNING id")).rows[0].id;
  for (const breederId of [a,b]) {
    await client.query("INSERT INTO users(breeder_id,email,password_hash,full_name) VALUES($1,$2,'existing-hash','Existing owner')",[breederId,breederId+'@example.test']);
    const dog = (await client.query("INSERT INTO dogs(breeder_id,name,sex,notes) VALUES($1,'Existing dog','F','KEEP EXACTLY') RETURNING id",[breederId])).rows[0].id;
    const litter = (await client.query("INSERT INTO litters(breeder_id,mother_id,birth_date) VALUES($1,$2,'2026-08-01') RETURNING id",[breederId,dog])).rows[0].id;
    await client.query("INSERT INTO puppies(breeder_id,litter_id,name,notes) VALUES($1,$2,'Existing puppy','KEEP PUPPY')",[breederId,litter]);
  }
  const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const tables = [...new Set(columns.map(row=>row.table_name))];
  async function snapshot() {
    const result={};
    for(const table of tables) {
      const names=columns.filter(row=>row.table_name===table).map(row=>'"'+row.column_name.replaceAll('"','""')+'"').join(',');
      const rows=(await client.query('SELECT '+names+' FROM public."'+table+'"')).rows;
      result[table]=rows.map(row=>JSON.stringify(row)).sort();
    }
    return result;
  }
  const before=await snapshot();
  const script=buildManualUpgrade();
  assert.equal(fs.readFileSync(path.resolve(__dirname,'../sql/SUPABASE_MISE_A_NIVEAU_SANS_SUPPRESSION.sql'),'utf8'),script);
  await client.query(script);
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual(await plan(client),[]);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM billing_accounts WHERE beta_access=true')).rows[0].n,2);
  await client.query(script);
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual(await plan(client),[]);
});
