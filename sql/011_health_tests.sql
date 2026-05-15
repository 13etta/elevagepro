-- Module tests de santé reproducteurs
-- Centralise ADN, radios, ophtalmologie et justificatifs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS health_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_health_tests_breeder_dog ON health_tests(breeder_id, dog_id);
CREATE INDEX IF NOT EXISTS idx_health_tests_breeder_date ON health_tests(breeder_id, test_date DESC);
