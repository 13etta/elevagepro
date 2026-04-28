const DEFAULT_PUPPY_PROTOCOL = [
  { offsetDays: 15, type: 'vermifuge', title: 'Vermifuge chiots J15' },
  { offsetDays: 30, type: 'vermifuge', title: 'Vermifuge chiots J30' },
  { offsetDays: 45, type: 'vermifuge', title: 'Vermifuge chiots J45' },
  { offsetDays: 56, type: 'vaccin', title: 'Primo-vaccination chiots' },
  { offsetDays: 60, type: 'veterinaire', title: 'Certificat vétérinaire avant cession' },
  { offsetDays: 63, type: 'document', title: 'Préparer documents de départ chiots' },
];

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

async function ensureAutomationColumns(client) {
  await client.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE');
  await client.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
}

async function createPuppyProtocolReminders(client, { breederId, litterId, birthDate, motherName }) {
  await ensureAutomationColumns(client);

  for (const step of DEFAULT_PUPPY_PROTOCOL) {
    const dueDate = addDays(birthDate, step.offsetDays);
    const title = motherName ? `${step.title} - portée de ${motherName}` : step.title;

    const existing = await client.query(
      `
        SELECT id
        FROM reminders
        WHERE breeder_id = $1
          AND litter_id = $2
          AND type = $3
          AND title = $4
          AND due_date = $5
        LIMIT 1
      `,
      [breederId, litterId, step.type, title, dueDate],
    );

    if (!existing.rows.length) {
      await client.query(
        `
          INSERT INTO reminders (breeder_id, litter_id, type, title, due_date, is_completed)
          VALUES ($1, $2, $3, $4, $5, FALSE)
        `,
        [breederId, litterId, step.type, title, dueDate],
      );
    }
  }
}

module.exports = {
  DEFAULT_PUPPY_PROTOCOL,
  ensureAutomationColumns,
  createPuppyProtocolReminders,
};
