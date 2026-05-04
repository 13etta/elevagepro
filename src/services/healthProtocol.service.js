const DEFAULT_PUPPY_PROTOCOL = [
  { code: 'puppy_worming_d15', type: 'vermifuge', label: 'Vermifuge chiot J15', offsetDays: 15 },
  { code: 'puppy_worming_d30', type: 'vermifuge', label: 'Vermifuge chiot J30', offsetDays: 30 },
  { code: 'puppy_worming_d45', type: 'vermifuge', label: 'Vermifuge chiot J45', offsetDays: 45 },
  { code: 'puppy_vaccine_d56', type: 'vaccin', label: 'Primo-vaccination chiot', offsetDays: 56 },
  { code: 'puppy_vet_certificate_d56', type: 'veterinaire', label: 'Certificat vétérinaire avant cession', offsetDays: 56 },
  { code: 'puppy_departure_documents_d60', type: 'document', label: 'Préparer documents de départ chiot', offsetDays: 60 },
];

const DEFAULT_LITTER_PROTOCOL = [
  { code: 'litter_worming_d15', type: 'vermifuge', label: 'Vermifuge collectif portée J15', offsetDays: 15 },
  { code: 'litter_worming_d30', type: 'vermifuge', label: 'Vermifuge collectif portée J30', offsetDays: 30 },
  { code: 'litter_worming_d45', type: 'vermifuge', label: 'Vermifuge collectif portée J45', offsetDays: 45 },
  { code: 'litter_vaccine_d56', type: 'vaccin', label: 'Primo-vaccination de la portée', offsetDays: 56 },
  { code: 'litter_departure_check_d60', type: 'document', label: 'Contrôle dossiers de départ portée', offsetDays: 60 },
];

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

async function ensureHealthAutomationSchema(client) {
  await client.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS source_key VARCHAR(255)');
  await client.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE');
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_breeder_source_key
    ON reminders(breeder_id, source_key)
    WHERE source_key IS NOT NULL
  `);
}

async function createReminder(client, { breederId, dogId = null, puppyId = null, litterId = null, type, title, dueDate, sourceKey }) {
  await client.query(
    `
      INSERT INTO reminders (breeder_id, dog_id, puppy_id, litter_id, type, title, due_date, is_completed, source_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)
      ON CONFLICT (breeder_id, source_key) WHERE source_key IS NOT NULL DO NOTHING
    `,
    [breederId, dogId, puppyId, litterId, type, title, dueDate, sourceKey],
  );
}

async function createLitterProtocolReminders(client, { breederId, litterId, motherId = null, birthDate, motherName = null }) {
  if (!breederId || !litterId || !birthDate) return;

  await ensureHealthAutomationSchema(client);

  for (const step of DEFAULT_LITTER_PROTOCOL) {
    const dueDate = addDays(birthDate, step.offsetDays);
    const title = motherName ? `${step.label} - portée de ${motherName}` : step.label;
    const sourceKey = `litter:${litterId}:${step.code}`;

    await createReminder(client, {
      breederId,
      dogId: motherId,
      litterId,
      type: step.type,
      title,
      dueDate,
      sourceKey,
    });
  }
}

async function createPuppyProtocolReminders(client, { breederId, puppyId, litterId, puppyName = null, birthDate }) {
  if (!breederId || !puppyId || !birthDate) return;

  await ensureHealthAutomationSchema(client);

  for (const step of DEFAULT_PUPPY_PROTOCOL) {
    const dueDate = addDays(birthDate, step.offsetDays);
    const title = puppyName ? `${step.label} - ${puppyName}` : step.label;
    const sourceKey = `puppy:${puppyId}:${step.code}`;

    await createReminder(client, {
      breederId,
      puppyId,
      litterId,
      type: step.type,
      title,
      dueDate,
      sourceKey,
    });
  }
}

module.exports = {
  DEFAULT_PUPPY_PROTOCOL,
  DEFAULT_LITTER_PROTOCOL,
  ensureHealthAutomationSchema,
  createLitterProtocolReminders,
  createPuppyProtocolReminders,
};
