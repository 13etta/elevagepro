const { createHmac } = require('node:crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const db = require('../db');

class PostgresRateStore {
  constructor(prefix) { this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  key(value) { return createHmac('sha256', process.env.SESSION_SECRET || 'local-rate-limit').update(this.prefix + value).digest('hex'); }
  async increment(value) {
    const result = await db.query(`INSERT INTO app_private.auth_rate_limits (key_hash, hits, reset_at)
      VALUES ($1,1,now()+($2 * interval '1 millisecond'))
      ON CONFLICT (key_hash) DO UPDATE SET
        hits = CASE WHEN auth_rate_limits.reset_at <= now() THEN 1 ELSE LEAST(auth_rate_limits.hits+1,1000000) END,
        reset_at = CASE WHEN auth_rate_limits.reset_at <= now() THEN now()+($2 * interval '1 millisecond') ELSE auth_rate_limits.reset_at END
      RETURNING hits, reset_at`, [this.key(value), this.windowMs]);
    return { totalHits: result.rows[0].hits, resetTime: new Date(result.rows[0].reset_at) };
  }
  async decrement(value) { await db.query('UPDATE app_private.auth_rate_limits SET hits=GREATEST(0,hits-1) WHERE key_hash=$1',[this.key(value)]); }
  async resetKey(value) { await db.query('UPDATE app_private.auth_rate_limits SET hits=0,reset_at=now() WHERE key_hash=$1',[this.key(value)]); }
}
function limiter(prefix, limit, windowMs, keyGenerator) {
  return rateLimit({limit,windowMs,keyGenerator,standardHeaders:'draft-7',legacyHeaders:false,
    ...(process.env.NODE_ENV === 'test' ? {} : {store:new PostgresRateStore(prefix)}),
    passOnStoreError:false,
    handler(req,res) { res.status(429).send('Trop de tentatives. Veuillez réessayer dans quelques minutes.'); },
  });
}
const ipKey = req => ipKeyGenerator(req.ip);
const accountKey = req => String(typeof req.body?.email === 'string' ? req.body.email : '').trim().toLowerCase();
module.exports = {
  PostgresRateStore,
  loginIpLimit: limiter('login-ip:',60,15*60*1000,ipKey),
  loginAccountLimit: limiter('login-account:',20,15*60*1000,accountKey),
  registrationLimit: limiter('register:',5,60*60*1000,ipKey),
  recoveryLimit: limiter('recovery:',8,60*60*1000,ipKey),
  aiLimit: limiter('ai:',20,60*60*1000,req=>String(req.session.user.breeder_id)),
};
