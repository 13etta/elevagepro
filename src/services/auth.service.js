const bcrypt = require('bcrypt');
const db = require('../db');

function buildSlug(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

async function createBreederWithAdmin({ kennelName, email, password, fullName }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rowCount > 0) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const baseSlug = buildSlug(kennelName) || `elevage-${Date.now()}`;

    const breederResult = await client.query(
      `INSERT INTO breeder (name, slug)
       VALUES ($1, $2)
       RETURNING id`,
      [kennelName.trim(), `${baseSlug}-${Date.now().toString().slice(-6)}`],
    );

    const hashedPassword = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users (breeder_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'owner')
       RETURNING id, breeder_id, email, full_name, role`,
      [breederResult.rows[0].id, normalizedEmail, hashedPassword, fullName.trim()],
    );

    await client.query('COMMIT');
    return userResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  const result = await db.query(
    `SELECT id, breeder_id, email, full_name, role, password_hash
     FROM users
     WHERE email = $1 AND is_active = true`,
    [email.toLowerCase().trim()],
  );

  const user = result.rows[0];
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    breeder_id: user.breeder_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  };
}

module.exports = {
  createBreederWithAdmin,
  login,
};
