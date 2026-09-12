-- ElevagePro: mise a niveau additive de la base existante.
-- Executer TOUT ce fichier dans Supabase > SQL Editor, role postgres.
-- Aucune suppression de table, colonne ou donnee metier.
-- Les colonnes existantes et leurs valeurs sont conservees.
-- Les nouvelles lignes de facturation donnent l'acces beta aux eleveurs existants.
-- Tout est annule automatiquement si une instruction echoue.
-- Si le verrou est indisponible, relancer plus tard : ne pas retirer la transaction.
-- Genere a partir des migrations versionnees; ne pas executer les anciens SQL 001-023.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(741820260908);
DO $check_existing_database$
BEGIN
  IF to_regclass('public.breeder') IS NULL OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Base ElevagePro existante introuvable. Aucune initialisation effectuee.';
  END IF;
END;
$check_existing_database$;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS app_private.schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.schema_migrations FROM PUBLIC;

DO $release_step_0$
BEGIN
  IF EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090925_release_runtime_schema.sql' AND checksum <> 'bb3023ad183cf467c3a9735c6d9937a3517ccbac2ff35a60835055c02d7a256f') THEN
    RAISE EXCEPTION 'Migration already recorded with a different checksum: 20260908090925_release_runtime_schema.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090925_release_runtime_schema.sql') THEN
    EXECUTE $migration_payload_0$
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

$migration_payload_0$;
    INSERT INTO app_private.schema_migrations (name, checksum)
    VALUES ('20260908090925_release_runtime_schema.sql', 'bb3023ad183cf467c3a9735c6d9937a3517ccbac2ff35a60835055c02d7a256f');
  END IF;
END;
$release_step_0$;


DO $release_step_1$
BEGIN
  IF EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090926_release_accounts_billing.sql' AND checksum <> '187d7659ca6c0e6df5450ca6521ecdfc4e7d040a65c5d71a46f407b7d50cc06b') THEN
    RAISE EXCEPTION 'Migration already recorded with a different checksum: 20260908090926_release_accounts_billing.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090926_release_accounts_billing.sql') THEN
    EXECUTE $migration_payload_1$
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE IF NOT EXISTS public.session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS release_session_expire ON public.session(expire);
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  breeder_id uuid PRIMARY KEY REFERENCES public.breeder(id),
  status text NOT NULL DEFAULT 'inactive',
  beta_access boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  checkout_session_id text,
  checkout_attempt uuid NOT NULL DEFAULT gen_random_uuid(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
-- Existing breeders keep their test access. Never charge or suspend them implicitly.
INSERT INTO public.billing_accounts (breeder_id, beta_access, status)
SELECT id, true, 'beta' FROM public.breeder ON CONFLICT (breeder_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_private.auth_rate_limits (
  key_hash text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry ON app_private.auth_rate_limits(reset_at);
CREATE TABLE IF NOT EXISTS app_private.account_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  breeder_id uuid NOT NULL REFERENCES public.breeder(id),
  purpose text NOT NULL CHECK (purpose IN ('reset', 'verify')),
  session_version integer NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_private.billing_events (
  event_id text PRIMARY KEY, breeder_id uuid NOT NULL REFERENCES public.breeder(id), processed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC;

$migration_payload_1$;
    INSERT INTO app_private.schema_migrations (name, checksum)
    VALUES ('20260908090926_release_accounts_billing.sql', '187d7659ca6c0e6df5450ca6521ecdfc4e7d040a65c5d71a46f407b7d50cc06b');
  END IF;
END;
$release_step_1$;


DO $release_step_2$
BEGIN
  IF EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090927_release_tenant_guards.sql' AND checksum <> 'b9e0b25a19f3b1fe23d5b81ece6a7981f06f8e53e7b9a425753ebfb9e0ab6e89') THEN
    RAISE EXCEPTION 'Migration already recorded with a different checksum: 20260908090927_release_tenant_guards.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '20260908090927_release_tenant_guards.sql') THEN
    EXECUTE $migration_payload_2$
-- New writes cannot attach an animal, sale, document or record to another breeder.
-- Existing records are preserved; unrelated edits on historical records stay possible.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE OR REPLACE FUNCTION app_private.enforce_tenant_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE parent_id text; old_parent_id text; owner_id text; found_parent boolean;
BEGIN
  owner_id := to_jsonb(NEW)->>'breeder_id';
  parent_id := to_jsonb(NEW)->>TG_ARGV[0];
  IF TG_OP = 'UPDATE' THEN
    old_parent_id := to_jsonb(OLD)->>TG_ARGV[0];
    IF parent_id IS NOT DISTINCT FROM old_parent_id AND owner_id IS NOT DISTINCT FROM (to_jsonb(OLD)->>'breeder_id') THEN RETURN NEW; END IF;
  END IF;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Breeder required' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT true FROM %I.%I WHERE %I::text = $1 AND breeder_id::text = $2 FOR KEY SHARE', TG_ARGV[1], TG_ARGV[2], TG_ARGV[3])
    INTO found_parent USING parent_id, owner_id;
  IF found_parent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reference outside breeder' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION app_private.keep_breeder_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.breeder_id IS DISTINCT FROM OLD.breeder_id THEN
    RAISE EXCEPTION 'Breeder ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.enforce_tenant_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.keep_breeder_ownership() FROM PUBLIC;
DO $$
DECLARE r record; trigger_name text;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='breeder_id'
  LOOP
    trigger_name := 'release_keep_breeder';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',r.table_name)::regclass AND tgname=trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF breeder_id ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.keep_breeder_ownership()',trigger_name,r.table_name);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.table_name);
  END LOOP;
  FOR r IN
    SELECT DISTINCT child.relname child_table, ca.attname child_column, pn.nspname parent_schema, parent.relname parent_table, pa.attname parent_column
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=fk.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=fk.confkey[1]
    WHERE fk.contype='f' AND array_length(fk.conkey,1)=1 AND cn.nspname='public' AND pn.nspname='public'
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=child.oid AND attname='breeder_id' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=parent.oid AND attname='breeder_id' AND NOT attisdropped)
    UNION
    SELECT 'dogs','infrastructure_id','public','infrastructures','id'
    UNION SELECT 'puppies','infrastructure_id','public','infrastructures','id'
    UNION SELECT 'dog_movements','dog_id','public','dogs','id'
    UNION SELECT 'expenses','dog_id','public','dogs','id'
    UNION SELECT 'expenses','puppy_id','public','puppies','id'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.child_table AND column_name=r.child_column) THEN CONTINUE; END IF;
    trigger_name := 'release_tenant_' || r.child_column;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',r.child_table)::regclass AND tgname=trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_reference(%L,%L,%L,%L)', trigger_name,r.child_table,r.child_column,r.parent_schema,r.parent_table,r.parent_column);
    END IF;
  END LOOP;
  -- Harden existing registry functions without replacing their bodies or changing data.
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE 'registry_%' OR p.proname='archive_exited_dog')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public',r.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',r.signature); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated',r.signature); END IF;
  END LOOP;
END;
$$;

$migration_payload_2$;
    INSERT INTO app_private.schema_migrations (name, checksum)
    VALUES ('20260908090927_release_tenant_guards.sql', 'b9e0b25a19f3b1fe23d5b81ece6a7981f06f8e53e7b9a425753ebfb9e0ab6e89');
  END IF;
END;
$release_step_2$;

COMMIT;

-- Verification finale: trois migrations enregistrees, tables et colonne presentes.
SELECT name, applied_at FROM app_private.schema_migrations ORDER BY name;
SELECT
  to_regclass('public.billing_accounts') IS NOT NULL AS abonnements_presents,
  to_regclass('app_private.auth_rate_limits') IS NOT NULL AS protection_connexion_presente,
  to_regclass('app_private.account_tokens') IS NOT NULL AS recuperation_compte_presente,
  to_regclass('app_private.billing_events') IS NOT NULL AS evenements_paiement_presents,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='session_version') AS version_session_presente;
