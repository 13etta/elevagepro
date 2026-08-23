-- Dossiers d'analyse de pedigree du nouvel agent de sélection.
-- Le PDF source n'est pas stocké : seuls son empreinte, l'extraction et les preuves sont conservés.

CREATE TABLE IF NOT EXISTS selection_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  subject_name VARCHAR(180),
  source_filename VARCHAR(255) NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'review_required'
    CHECK (status IN ('review_required', 'validated', 'researched', 'failed')),
  extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
  validated_pedigree JSONB,
  coi_percent NUMERIC(10,5),
  coi_method VARCHAR(180),
  completeness JSONB,
  research JSONB,
  ai_provider VARCHAR(40) NOT NULL DEFAULT 'openai',
  extraction_model VARCHAR(100),
  research_model VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_selection_analyses_breeder_created
  ON selection_analyses (breeder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_selection_analyses_breeder_status
  ON selection_analyses (breeder_id, status);
