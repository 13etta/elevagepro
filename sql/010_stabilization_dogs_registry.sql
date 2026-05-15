-- Stabilisation module chiens / registre légal
-- Objectif : réduire les erreurs dues aux écarts entre base réelle et code applicatif.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Colonnes optionnelles utilisées par certaines vues / anciens écrans.
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS lof VARCHAR(100);
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS father_name_external VARCHAR(255);
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS mother_name_external VARCHAR(255);
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Harmonisation LOF / pedigree.
UPDATE dogs
SET pedigree_number = lof
WHERE pedigree_number IS NULL
  AND lof IS NOT NULL;

UPDATE dogs
SET lof = pedigree_number
WHERE lof IS NULL
  AND pedigree_number IS NOT NULL;

-- Table canonique lue par le registre légal de l'application.
CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
    animal_type VARCHAR(50) NOT NULL DEFAULT 'adulte',
    animal_name VARCHAR(100) NOT NULL,
    chip_number VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    provenance_destination VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movements_breeder_date ON movements(breeder_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_dogs_breeder_name ON dogs(breeder_id, name);
CREATE INDEX IF NOT EXISTS idx_dogs_breeder_chip ON dogs(breeder_id, chip_number);

-- Table de compatibilité si des imports externes utilisent animal_movements.
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_animal_movements_breeder_date ON animal_movements(breeder_id, movement_date DESC);
