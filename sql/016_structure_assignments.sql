CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS infrastructures (
  id SERIAL PRIMARY KEY,
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(80) DEFAULT 'box',
  description TEXT,
  capacity INTEGER DEFAULT 0,
  status VARCHAR(80) DEFAULT 'actif',
  image_url TEXT,
  zone_label VARCHAR(120),
  occupied_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS zone_label VARCHAR(120);
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS occupied_count INTEGER DEFAULT 0;
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE dogs ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER;
ALTER TABLE puppies ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER;
ALTER TABLE puppies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS infrastructure_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  infrastructure_id INTEGER REFERENCES infrastructures(id) ON DELETE SET NULL,
  previous_infrastructure_id INTEGER REFERENCES infrastructures(id) ON DELETE SET NULL,
  animal_type VARCHAR(20) NOT NULL CHECK (animal_type IN ('dog', 'puppy')),
  dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
  puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE,
  reason TEXT,
  sanitary_context VARCHAR(120),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (animal_type = 'dog' AND dog_id IS NOT NULL AND puppy_id IS NULL)
    OR
    (animal_type = 'puppy' AND puppy_id IS NOT NULL AND dog_id IS NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dogs_infrastructure_id_fkey') THEN
    ALTER TABLE dogs ADD CONSTRAINT dogs_infrastructure_id_fkey
      FOREIGN KEY (infrastructure_id) REFERENCES infrastructures(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'puppies_infrastructure_id_fkey') THEN
    ALTER TABLE puppies ADD CONSTRAINT puppies_infrastructure_id_fkey
      FOREIGN KEY (infrastructure_id) REFERENCES infrastructures(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_infrastructures_breeder_type ON infrastructures(breeder_id, type, name);
CREATE INDEX IF NOT EXISTS idx_dogs_infrastructure ON dogs(breeder_id, infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_puppies_infrastructure ON puppies(breeder_id, infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_assignments_breeder_date ON infrastructure_assignments(breeder_id, assigned_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_dog ON infrastructure_assignments(breeder_id, dog_id) WHERE ended_at IS NULL AND dog_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_puppy ON infrastructure_assignments(breeder_id, puppy_id) WHERE ended_at IS NULL AND puppy_id IS NOT NULL;

UPDATE infrastructures i
SET occupied_count =
  (
    SELECT COUNT(*)::int
    FROM dogs d
    WHERE d.breeder_id = i.breeder_id
      AND d.infrastructure_id = i.id
  ) +
  (
    SELECT COUNT(*)::int
    FROM puppies p
    WHERE p.breeder_id = i.breeder_id
      AND p.infrastructure_id = i.id
      AND COALESCE(p.is_sold, false) = false
  ),
  updated_at = CURRENT_TIMESTAMP;
