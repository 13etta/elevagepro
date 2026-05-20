CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_breeder_created ON activity_logs(breeder_id, created_at DESC);

ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS soin_id UUID REFERENCES soins(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS puppy_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  weight_date DATE NOT NULL,
  weight_grams INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DELETE FROM soins a USING soins b
WHERE a.ctid < b.ctid
  AND a.breeder_id = b.breeder_id
  AND a.dog_id IS NOT DISTINCT FROM b.dog_id
  AND a.puppy_id IS NOT DISTINCT FROM b.puppy_id
  AND a.type IS NOT DISTINCT FROM b.type
  AND a.label IS NOT DISTINCT FROM b.label
  AND a.event_date IS NOT DISTINCT FROM b.event_date
  AND a.next_due IS NOT DISTINCT FROM b.next_due;

DELETE FROM reminders a USING reminders b
WHERE a.ctid < b.ctid
  AND a.breeder_id = b.breeder_id
  AND a.soin_id IS NOT NULL
  AND a.soin_id = b.soin_id;

DELETE FROM puppy_weights a USING puppy_weights b
WHERE a.ctid < b.ctid
  AND a.breeder_id = b.breeder_id
  AND a.puppy_id = b.puppy_id
  AND a.weight_date = b.weight_date;

DELETE FROM health_tests a USING health_tests b
WHERE a.ctid < b.ctid
  AND a.breeder_id = b.breeder_id
  AND a.dog_id = b.dog_id
  AND a.test_type IS NOT DISTINCT FROM b.test_type
  AND a.test_name IS NOT DISTINCT FROM b.test_name
  AND a.test_date IS NOT DISTINCT FROM b.test_date;

CREATE UNIQUE INDEX IF NOT EXISTS ux_soins_no_duplicate_dog ON soins (breeder_id, dog_id, type, label, event_date, COALESCE(next_due, DATE '1900-01-01')) WHERE dog_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_soins_no_duplicate_puppy ON soins (breeder_id, puppy_id, type, label, event_date, COALESCE(next_due, DATE '1900-01-01')) WHERE puppy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_reminders_linked_soin ON reminders (breeder_id, soin_id) WHERE soin_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_puppy_weights_daily ON puppy_weights (breeder_id, puppy_id, weight_date) WHERE puppy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_tests_no_duplicate ON health_tests (breeder_id, dog_id, test_type, test_name, COALESCE(test_date, DATE '1900-01-01'));
