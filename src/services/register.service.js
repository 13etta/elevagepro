const { pool } = require('../db');

function normalizeMovementType(type) {
  const value = String(type || '').trim().toUpperCase();
  return value === 'SORTIE' ? 'sortie' : 'entree';
}

function normalizeAnimalType(reason, breed) {
  const reasonValue = String(reason || '').toLowerCase();
  const breedValue = String(breed || '').toLowerCase();
  if (reasonValue.includes('naissance') || breedValue.includes('chiot')) return 'chiot';
  return 'adulte';
}

async function tableExists(dbClient, tableName) {
  const result = await dbClient.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

exports.logMovement = async (data, dbClient = pool) => {
  const animalName = String(data.animalName || '').trim();
  if (!data.breederId || !animalName) return false;

  const movementType = normalizeMovementType(data.type);
  const animalType = normalizeAnimalType(data.reason, data.breed);
  const movementDate = data.date || new Date();
  const reason = data.reason || (movementType === 'sortie' ? 'Sortie' : 'Acquisition');
  const chipNumber = data.identification || null;
  const thirdParty = data.thirdParty || null;

  try {
    if (await tableExists(dbClient, 'movements')) {
      await dbClient.query(
        `INSERT INTO movements
          (breeder_id, animal_type, animal_name, chip_number, movement_type, reason, movement_date, provenance_destination)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [data.breederId, animalType, animalName, chipNumber, movementType, reason, movementDate, thirdParty],
      );
      return true;
    }

    if (await tableExists(dbClient, 'animal_movements')) {
      await dbClient.query(
        `INSERT INTO animal_movements
          (breeder_id, animal_name, identification, breed, movement_type, movement_reason, movement_date, third_party_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [data.breederId, animalName, chipNumber, data.breed || null, String(data.type || 'ENTREE').toUpperCase(), reason, movementDate, thirdParty],
      );
      return true;
    }

    console.warn('Aucune table de registre légal disponible pour logMovement.');
    return false;
  } catch (error) {
    console.warn('Registre légal non mis à jour:', error.message);
    return false;
  }
};
