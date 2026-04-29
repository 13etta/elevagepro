const bcrypt = require('bcrypt');
const db = require('../db');

function buildSlug(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function ensureAuthSchema(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)
  `);

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS name VARCHAR(255)
  `);

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS slug VARCHAR(180)
  `);

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255)
  `);

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS siret VARCHAR(32)
  `);

  await client.query(`
    ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS address TEXT
  `);

  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
  `);

  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)
  `);

  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin'
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_breeder_slug_unique
    ON breeder(slug)
    WHERE slug IS NOT NULL
  `);
}

async function createUniqueSlug(client, kennelName) {
  const baseSlug = buildSlug(kennelName) || `elevage-${Date.now()}`;
  let candidate = baseSlug;
  let attempt = 0;

  while (attempt < 10) {
    const existing = await client.query('SELECT id FROM breeder WHERE slug = $1 LIMIT 1', [candidate]);
    if (!existing.rows.length) return candidate;

    attempt += 1;
    candidate = `${baseSlug}-${Date.now().toString().slice(-6)}-${attempt}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

async function createBreederWithAdmin({ kennelName, email, password, fullName }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await ensureAuthSchema(client);

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const cleanKennelName = String(kennelName || '').trim();
    const cleanFullName = String(fullName || '').trim();

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rowCount > 0) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const slug = await createUniqueSlug(client, cleanKennelName);

    const breederResult = await client.query(
      `
        INSERT INTO breeder (company_name, name, slug)
        VALUES ($1, $1, $2)
        RETURNING id
      `,
      [cleanKennelName, slug],
    );

    const hashedPassword = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `
        INSERT INTO users (breeder_id, email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, 'owner', TRUE)
        RETURNING id, breeder_id, email, full_name, role
      `,
      [breederResult.rows[0].id, normalizedEmail, hashedPassword, cleanFullName],
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
    `
      SELECT id, breeder_id, email, full_name, role, password_hash
      FROM users
      WHERE email = $1 AND COALESCE(is_active, TRUE) = TRUE
    `,
    [String(email || '').toLowerCase().trim()],
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
