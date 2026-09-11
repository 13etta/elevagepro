'use strict';

const { pool } = require('../db');



async function logActivity(clientOrPool, { breederId, userId = null, action, entityType = null, entityId = null, label = null, metadata = {} }) {
  if (!breederId || !action) return;

  try {
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
  logActivity,
};
