const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../db');
const { configuration } = require('./billing.service');
const digest = value => createHash('sha256').update(value).digest('hex');
function validPassword(value) { return typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value, 'utf8') <= 72; }
async function requestReset(email, sendMail) {
  if (typeof email !== 'string' || email.length > 255) return;
  if (!sendMail && (!process.env.SMTP_URL || !process.env.MAIL_FROM)) throw Object.assign(new Error('La récupération par email est momentanément indisponible.'), { status: 503 });
  const user = (await db.query('SELECT id,breeder_id,email,session_version FROM users WHERE email=$1 AND COALESCE(is_active,true)=true', [email.trim().toLowerCase()])).rows[0];
  if (!user) return;
  const token = randomBytes(32).toString('hex');
  await db.query(`INSERT INTO app_private.account_tokens(token_hash,user_id,breeder_id,purpose,session_version,expires_at)
    VALUES($1,$2,$3,'reset',$4,now()+interval '1 hour')`, [digest(token), user.id, user.breeder_id, user.session_version]);
  const url = configuration().origin + '/auth/reset-password?token=' + token;
  const deliver = sendMail || (message => nodemailer.createTransport(process.env.SMTP_URL, { logger: false, debug: false }).sendMail(message));
  await deliver({ from: process.env.MAIL_FROM, to: user.email, subject: 'Réinitialiser votre mot de passe ElevagePro',
    text: `Pour choisir un nouveau mot de passe, ouvrez ce lien dans l’heure :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.` });
}
async function resetPassword(token, password) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) return false;
  const hash = await bcrypt.hash(password, 12);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT t.* FROM app_private.account_tokens t JOIN users u ON u.id=t.user_id AND u.breeder_id=t.breeder_id
      WHERE t.token_hash=$1 AND t.purpose='reset' AND t.used_at IS NULL AND t.expires_at>now()
      AND t.session_version=u.session_version AND COALESCE(u.is_active,true)=true FOR UPDATE OF t,u`, [digest(token)]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return false; }
    const entry = result.rows[0];
    await client.query('UPDATE users SET password_hash=$1,session_version=session_version+1 WHERE id=$2 AND breeder_id=$3', [hash, entry.user_id, entry.breeder_id]);
    await client.query('UPDATE app_private.account_tokens SET used_at=now() WHERE token_hash=$1 AND breeder_id=$2', [digest(token), entry.breeder_id]);
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { requestReset, resetPassword, validPassword };
