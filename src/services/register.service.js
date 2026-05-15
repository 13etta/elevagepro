const { pool } = require('../db');

function normalizeMovementType(type) {
  const value = String(type || '').trim().toUpperCase();
  return value === 'SORTIE' ? 'sortie' : 'entree';
}

function normalizeAnimalType(reason, breed, explicitType) {
  if (explicitType) return explicitType;
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

async function columnExists(dbClient, tableName, columnName) {
  const result = await dbClient.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

function normalizeDate(value) {
  if (!value) return new Date();
  return value;
}

async function logCanonicalMovement(data, dbClient) {
  const hasSourceType = await columnExists(dbClient, 'movements', 'movement_source_type');
  const hasSourceId = await columnExists(dbClient, 'movements', 'movement_source_id');
  const hasNotes = await columnExists(dbClient, 'movements', 'notes');

  const columns = [
    'breeder_id',
    'animal_type',
    'animal_name',
    'chip_number',
    'movement_type',
    'reason',
    'movement_date',
    'provenance_destination',
  ];
  const values = [
    data.breederId,
    data.animalType,
    data.animalName,
    data.identification || null,
    data.movementType,
    data.reason,
    data.movementDate,
    data.thirdParty || null,
  ];

  if (hasSourceType) {
    columns.push('movement_source_type');
    values.push(data.sourceType || null);
  }
  if (hasSourceId) {
    columns.push('movement_source_id');
    values.push(data.sourceId || null);
  }
  if (hasNotes) {
    columns.push('notes');
    values.push(data.notes || null);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

  if (data.sourceType && data.sourceId && hasSourceType && hasSourceId) {
    await dbClient.query(
      `INSERT INTO movements (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (breeder_id, movement_source_type, movement_source_id, movement_type, reason)
       WHERE movement_source_type IS NOT NULL AND movement_source_id IS NOT NULL
       DO NOTHING`,
      values,
    );
    return true;
  }

  await dbClient.query(
    `INSERT INTO movements (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  return true;
}

async function logLegacyMovement(data, dbClient) {
  const hasNotes = await columnExists(dbClient, 'animal_movements', 'notes');
  const columns = ['breeder_id', 'animal_name', 'identification', 'breed', 'movement_type', 'movement_reason', 'movement_date', 'third_party_info'];
  const values = [data.breederId, data.animalName, data.identification || null, data.breed || null, String(data.originalType || 'ENTREE').toUpperCase(), data.reason, data.movementDate, data.thirdParty || null];

  if (hasNotes) {
    columns.push('notes');
    values.push(data.notes || null);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  await dbClient.query(`INSERT INTO animal_movements (${columns.join(', ')}) VALUES (${placeholders})`, values);
  return true;
}

exports.logMovement = async (data, dbClient = pool) => {
  const animalName = String(data.animalName || '').trim();
  if (!data.breederId || !animalName) return false;

  const originalType = data.type || 'ENTREE';
  const movementType = normalizeMovementType(originalType);
  const reason = data.reason || (movementType === 'sortie' ? 'Sortie' : 'Acquisition');

  const payload = {
    ...data,
    animalName,
    originalType,
    movementType,
    animalType: normalizeAnimalType(reason, data.breed, data.animalType),
    movementDate: normalizeDate(data.date),
    reason,
  };

  try {
    if (await tableExists(dbClient, 'movements')) {
      return await logCanonicalMovement(payload, dbClient);
    }

    if (await tableExists(dbClient, 'animal_movements')) {
      return await logLegacyMovement(payload, dbClient);
    }

    console.warn('Aucune table de registre légal disponible pour logMovement.');
    return false;
  } catch (error) {
    console.warn('Registre légal non mis à jour:', error.message);
    return false;
  }
};

exports.logDogEntry = async ({ breederId, dog, sourceId, dbClient = pool }) => exports.logMovement({
  breederId,
  animalName: dog.name,
  identification: dog.chip_number,
  breed: dog.breed || 'Chien adulte',
  animalType: 'adulte',
  type: 'ENTREE',
  reason: 'Acquisition',
  date: dog.created_at || new Date(),
  sourceType: 'dog_creation',
  sourceId,
  notes: 'Entrée automatique à la création du chien adulte.',
}, dbClient);

exports.logPuppyBirth = async ({ breederId, puppy, birthDate, sourceId, dbClient = pool }) => exports.logMovement({
  breederId,
  animalName: puppy.name,
  identification: puppy.chip_number,
  breed: 'Chiot',
  animalType: 'chiot',
  type: 'ENTREE',
  reason: 'Naissance',
  date: birthDate || puppy.birth_date || new Date(),
  sourceType: 'puppy_birth',
  sourceId,
  notes: 'Entrée automatique à la création du chiot.',
}, dbClient);

exports.logSaleExit = async ({ breederId, sale, dbClient = pool }) => exports.logMovement({
  breederId,
  animalName: sale.animal_name,
  identification: sale.animal_chip_number,
  breed: sale.animal_type === 'puppy' ? 'Chiot' : 'Chien adulte',
  animalType: sale.animal_type === 'puppy' ? 'chiot' : 'adulte',
  type: 'SORTIE',
  reason: 'Vente',
  date: sale.sale_date || new Date(),
  thirdParty: sale.buyer_name,
  sourceType: 'sale',
  sourceId: sale.id,
  notes: 'Sortie automatique à la validation de la vente définitive.',
}, dbClient);

exports.logStatusExit = async ({ breederId, animal, status, sourceType, sourceId, dbClient = pool }) => {
  const normalized = String(status || '').trim().toLowerCase();
  const reason = ['décédé', 'decede', 'décédée', 'decedee', 'dead'].includes(normalized)
    ? 'Décès'
    : ['retraite', 'retiré', 'retire', 'retirée', 'reformé', 'reforme', 'réforme'].includes(normalized)
      ? 'Retraite / réforme'
      : null;

  if (!reason) return false;

  return exports.logMovement({
    breederId,
    animalName: animal.name,
    identification: animal.chip_number,
    breed: animal.breed || animal.animal_type || 'Chien',
    animalType: animal.animal_type || 'adulte',
    type: 'SORTIE',
    reason,
    date: new Date(),
    sourceType,
    sourceId,
    notes: `Sortie automatique liée au statut : ${status}.`,
  }, dbClient);
};
