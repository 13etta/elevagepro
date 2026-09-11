const express = require('express');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { pool } = require('../db');
const router = express.Router();
router.use(requireAuth, requireOwner);
router.get('/export', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const breederId = req.session.user.breeder_id;
    const tables = (await client.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='breeder_id'
      AND table_name NOT IN ('users','billing_accounts') ORDER BY table_name`)).rows;
    const data = { exported_at: new Date().toISOString(), breeder: (await client.query('SELECT * FROM breeder WHERE id=$1', [breederId])).rows[0], tables: {} };
    for (const { table_name: table } of tables) {
      if (!/^[a-z_]+$/.test(table)) throw new Error('Nom de table inattendu.');
      const result = await client.query(`SELECT * FROM public."${table}" WHERE breeder_id=$1 LIMIT 50001`, [breederId]);
      if (result.rows.length > 50000) throw Object.assign(new Error('Export volumineux : contactez le support pour obtenir votre archive complète.'), { status: 413 });
      data.tables[table] = result.rows;
    }
    await client.query('COMMIT');
    res.attachment('elevagepro-export-' + new Date().toISOString().slice(0,10) + '.json');
    return res.json(data);
  } catch (error) { if (client) await client.query('ROLLBACK'); if (error.status) return res.status(error.status).send(error.message); return next(error); }
  finally { client?.release(); }
});
router.post('/revoke-sessions', verifyCsrf, async (req, res, next) => {
  try {
    await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1 AND breeder_id=$2', [req.session.user.id,req.session.user.breeder_id]);
    req.session.destroy(error => { if (error) return next(error); res.clearCookie('sid'); return res.redirect('/auth/login'); });
  } catch (error) { return next(error); }
});
module.exports = router;
