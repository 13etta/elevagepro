-- Additive replacement for former request-time schema modifications.
-- No table, column or business record is removed or rewritten.
-- These legacy tables exist on Supabase but were absent from the historical runner.
CREATE TABLE IF NOT EXISTS staff (
  id serial PRIMARY KEY, breeder_id uuid REFERENCES breeder(id),
  first_name varchar(255) NOT NULL, last_name varchar(255) NOT NULL,
  role varchar(255) NOT NULL, contract_type varchar(255), hire_date date,
  status varchar(80) DEFAULT 'actif', created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sanitary_records (
  id serial PRIMARY KEY, breeder_id uuid REFERENCES breeder(id),
  event_date date NOT NULL, event_type varchar(255) NOT NULL, description text NOT NULL,
  animals_concerned text, vet_name varchar(255), created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cleaning_logs (
  id serial PRIMARY KEY, breeder_id uuid REFERENCES breeder(id),
  cleaning_date date NOT NULL, zone_type varchar(255) NOT NULL,
  protocol_used varchar(255) NOT NULL, done_by varchar(255), notes text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cynognostic_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      breed VARCHAR(255),
      objective VARCHAR(255),
      discipline VARCHAR(255),
      source_url TEXT,
      pedigree_text TEXT,
      announcement_text TEXT,
      observations TEXT,
      image_notes TEXT,
      video_notes TEXT,
      score_global INTEGER DEFAULT 0,
      score_work INTEGER DEFAULT 0,
      score_beauty INTEGER DEFAULT 0,
      score_health INTEGER DEFAULT 0,
      score_pedigree INTEGER DEFAULT 0,
      score_strategic INTEGER DEFAULT 0,
      confidence_score INTEGER DEFAULT 0,
      verdict TEXT,
      alerts JSONB DEFAULT '[]'::jsonb,
      findings JSONB DEFAULT '{}'::jsonb,
      raw_input JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cynognostic_reports_breeder_created
      ON cynognostic_reports(breeder_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_cynognostic_reports_breed
      ON cynognostic_reports(breeder_id, breed);

    CREATE TABLE IF NOT EXISTS cynognostic_watch_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      breed VARCHAR(255),
      objective VARCHAR(255),
      discipline VARCHAR(255),
      zone VARCHAR(255),
      sex_preference VARCHAR(100),
      budget_max NUMERIC(10,2),
      non_negotiables TEXT,
      search_queries JSONB DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT TRUE,
      last_run_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cynognostic_watch_breeder_active
      ON cynognostic_watch_profiles(breeder_id, is_active);

CREATE TABLE IF NOT EXISTS dog_movements (
      id BIGSERIAL PRIMARY KEY,
      breeder_id TEXT NULL,
      dog_id TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTREE', 'SORTIE')),
      movement_date DATE NOT NULL,
      reason VARCHAR(255) NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS health_tests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
      test_type VARCHAR(80) NOT NULL,
      test_name VARCHAR(160) NOT NULL,
      result VARCHAR(120),
      test_date DATE,
      laboratory VARCHAR(160),
      certificate_url TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      litter_id UUID REFERENCES litters(id) ON DELETE SET NULL,
      dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
      puppy_id UUID REFERENCES puppies(id) ON DELETE SET NULL,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category VARCHAR(80) NOT NULL DEFAULT 'autre',
      label TEXT NOT NULL DEFAULT '',
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

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

CREATE TABLE IF NOT EXISTS infrastructure_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      CHECK ((animal_type = 'dog' AND dog_id IS NOT NULL AND puppy_id IS NULL) OR (animal_type = 'puppy' AND puppy_id IS NOT NULL AND dog_id IS NULL))
    );

CREATE TABLE IF NOT EXISTS puppy_weights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
      weight_date DATE NOT NULL,
      weight_grams INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80),
      entity_id UUID,
      label TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS breeder_id TEXT NULL;

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS dog_id TEXT;

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS movement_type TEXT;

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS movement_date DATE;

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS reason VARCHAR(255);

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS notes TEXT NULL;

ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_dog_movements_breeder_id ON dog_movements (breeder_id);

CREATE INDEX IF NOT EXISTS idx_dog_movements_dog_id ON dog_movements (dog_id);

CREATE INDEX IF NOT EXISTS idx_dog_movements_type ON dog_movements (movement_type);

CREATE INDEX IF NOT EXISTS idx_dog_movements_date ON dog_movements (movement_date);

ALTER TABLE dogs ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE dogs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'actif';

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS puppy_id UUID;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dog_id UUID;

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS is_sold BOOLEAN DEFAULT FALSE;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_reservation BOOLEAN DEFAULT FALSE;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0;

ALTER TABLE litters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE litters ADD COLUMN IF NOT EXISTS puppies_count_total INTEGER;

ALTER TABLE litters ADD COLUMN IF NOT EXISTS puppies_count INTEGER;

ALTER TABLE litters ADD COLUMN IF NOT EXISTS nb_puppies INTEGER;

CREATE INDEX IF NOT EXISTS idx_expenses_breeder_date ON expenses(breeder_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_litter ON expenses(breeder_id, litter_id);

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS email VARCHAR(255);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS producer_number VARCHAR(100);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS slug VARCHAR(180);

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE breeder ADD COLUMN IF NOT EXISTS website_settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS soin_id UUID REFERENCES soins(id) ON DELETE CASCADE;

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS zone_label VARCHAR(120);

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS occupied_count INTEGER DEFAULT 0;

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE dogs ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER;

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER;

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_infrastructures_breeder_type ON infrastructures(breeder_id, type, name);

CREATE INDEX IF NOT EXISTS idx_dogs_infrastructure ON dogs(breeder_id, infrastructure_id);

CREATE INDEX IF NOT EXISTS idx_puppies_infrastructure ON puppies(breeder_id, infrastructure_id);

CREATE INDEX IF NOT EXISTS idx_infrastructure_assignments_breeder_date ON infrastructure_assignments(breeder_id, assigned_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_dog ON infrastructure_assignments(breeder_id, dog_id) WHERE ended_at IS NULL AND dog_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_puppy ON infrastructure_assignments(breeder_id, puppy_id) WHERE ended_at IS NULL AND puppy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_puppy_weights_breeder_puppy_date ON puppy_weights(breeder_id, puppy_id, weight_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_breeder_created
    ON activity_logs(breeder_id, created_at DESC);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS slug VARCHAR(180);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS siret VARCHAR(32);

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE breeder
    ADD COLUMN IF NOT EXISTS primary_breed VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';

CREATE UNIQUE INDEX IF NOT EXISTS idx_breeder_slug_unique
    ON breeder(slug)
    WHERE slug IS NOT NULL;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS source_key VARCHAR(255);

ALTER TABLE soins ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_breeder_source_key
    ON reminders(breeder_id, source_key)
    WHERE source_key IS NOT NULL;

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2);

ALTER TABLE litters ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
