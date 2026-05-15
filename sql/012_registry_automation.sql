-- Registre entrées / sorties automatisé
-- movements devient la table canonique.
-- animal_movements reste une table de compatibilité/import historique.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
    animal_type VARCHAR(50) NOT NULL,
    animal_name VARCHAR(100) NOT NULL,
    chip_number VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    provenance_destination VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE movements ADD COLUMN IF NOT EXISTS movement_source_type VARCHAR(80);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS movement_source_id UUID;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_movements_breeder_date ON movements(breeder_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_source ON movements(breeder_id, movement_source_type, movement_source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_unique_source
ON movements(breeder_id, movement_source_type, movement_source_id, movement_type, reason)
WHERE movement_source_type IS NOT NULL
  AND movement_source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS animal_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    animal_name VARCHAR(255) NOT NULL,
    identification VARCHAR(100),
    breed VARCHAR(255),
    movement_type VARCHAR(50) NOT NULL,
    movement_reason VARCHAR(100),
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    third_party_info TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE animal_movements ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_animal_movements_breeder_date ON animal_movements(breeder_id, movement_date DESC);
