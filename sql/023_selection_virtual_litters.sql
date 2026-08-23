-- Portées virtuelles calculées à partir de deux pedigrees contrôlés par l'opérateur.

CREATE UNIQUE INDEX IF NOT EXISTS uq_selection_analyses_id_breeder
  ON selection_analyses (id, breeder_id);

CREATE TABLE IF NOT EXISTS selection_virtual_litters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  sire_analysis_id UUID NOT NULL,
  dam_analysis_id UUID NOT NULL,
  name VARCHAR(220) NOT NULL,
  coi_percent NUMERIC(10,5) NOT NULL,
  coi_method VARCHAR(180) NOT NULL,
  completeness JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_ancestors JSONB NOT NULL DEFAULT '[]'::jsonb,
  offspring_pedigree JSONB NOT NULL DEFAULT '{}'::jsonb,
  explained_percent NUMERIC(10,5) NOT NULL DEFAULT 0,
  unexplained_percent NUMERIC(10,5) NOT NULL DEFAULT 0,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (sire_analysis_id <> dam_analysis_id),
  FOREIGN KEY (sire_analysis_id, breeder_id)
    REFERENCES selection_analyses (id, breeder_id) ON DELETE CASCADE,
  FOREIGN KEY (dam_analysis_id, breeder_id)
    REFERENCES selection_analyses (id, breeder_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_selection_virtual_litters_breeder_created
  ON selection_virtual_litters (breeder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_selection_virtual_litters_sire_tenant
  ON selection_virtual_litters (sire_analysis_id, breeder_id);

CREATE INDEX IF NOT EXISTS idx_selection_virtual_litters_dam_tenant
  ON selection_virtual_litters (dam_analysis_id, breeder_id);

-- Ces tables sont utilisées par le serveur PostgreSQL avec contrôle breeder_id.
-- Aucune politique Data API n'est accordée : un accès anon/authenticated ne voit aucune ligne.
ALTER TABLE selection_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_virtual_litters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE selection_analyses FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE selection_virtual_litters FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE selection_analyses FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE selection_virtual_litters FROM authenticated';
  END IF;
END
$$;
