'use strict';

const { pool } = require('../db');

async function ensureActivityLog(clientOrPool = pool) {
  await clientOrPool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80),
      entity_id UUID,
      label TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await clientOrPool.query(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_breeder_created
    ON activity_logs(breeder_id, created_at DESC)
  `);
}

async function logActivity(clientOrPool, { breederId, userId = null, action, entityType = null, entityId = null, label = null, metadata = {} }) {
  if (!breederId || !action) return;

  try {
    await ensureActivityLog(clientOrPool);
    await clientOrPool.query(
      `INSERT INTO activity_logs (breeder_id, user_id, action, entity_type, entity_id, label, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [breederId, userId, action, entityType, entityId, label, JSON.stringify(metadata || {})],
    );
  } catch (error) {
    console.warn('Journal activité non mis à jour:', error.message);
  }
}

module.exports = {
  ensureActivityLog,
  logActivity,
};
