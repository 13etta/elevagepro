CREATE TABLE IF NOT EXISTS cynognostic_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
