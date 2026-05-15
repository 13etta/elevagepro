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

CREATE OR REPLACE FUNCTION registry_insert_movement(
    p_breeder_id UUID,
    p_animal_type VARCHAR,
    p_animal_name VARCHAR,
    p_chip_number VARCHAR,
    p_movement_type VARCHAR,
    p_reason VARCHAR,
    p_movement_date DATE,
    p_third_party VARCHAR,
    p_source_type VARCHAR,
    p_source_id UUID,
    p_notes TEXT
) RETURNS VOID AS $$
BEGIN
    IF p_breeder_id IS NULL OR COALESCE(trim(p_animal_name), '') = '' THEN
        RETURN;
    END IF;

    INSERT INTO movements (
        breeder_id,
        animal_type,
        animal_name,
        chip_number,
        movement_type,
        reason,
        movement_date,
        provenance_destination,
        movement_source_type,
        movement_source_id,
        notes
    ) VALUES (
        p_breeder_id,
        COALESCE(p_animal_type, 'adulte'),
        left(p_animal_name, 100),
        NULLIF(trim(COALESCE(p_chip_number, '')), ''),
        p_movement_type,
        p_reason,
        COALESCE(p_movement_date, CURRENT_DATE),
        NULLIF(trim(COALESCE(p_third_party, '')), ''),
        p_source_type,
        p_source_id,
        p_notes
    )
    ON CONFLICT (breeder_id, movement_source_type, movement_source_id, movement_type, reason)
    WHERE movement_source_type IS NOT NULL
      AND movement_source_id IS NOT NULL
    DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION registry_after_dog_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM registry_insert_movement(
        NEW.breeder_id,
        'adulte',
        NEW.name,
        NEW.chip_number,
        'entree',
        'Acquisition',
        COALESCE(NEW.created_at::date, CURRENT_DATE),
        NULL,
        'dog_creation',
        NEW.id,
        'Entrée automatique à la création du chien adulte.'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_dog_insert ON dogs;
CREATE TRIGGER trg_registry_after_dog_insert
AFTER INSERT ON dogs
FOR EACH ROW
EXECUTE FUNCTION registry_after_dog_insert();

CREATE OR REPLACE FUNCTION registry_after_dog_status_update()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
    v_reason TEXT;
BEGIN
    v_status := lower(trim(COALESCE(NEW.status, '')));

    IF COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
        RETURN NEW;
    END IF;

    IF v_status IN ('décédé', 'decede', 'décédée', 'decedee', 'dead') THEN
        v_reason := 'Décès';
    ELSIF v_status IN ('retraite', 'retiré', 'retire', 'retirée', 'reformé', 'reforme', 'réforme', 'reforme elevage') THEN
        v_reason := 'Retraite / réforme';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM registry_insert_movement(
        NEW.breeder_id,
        'adulte',
        NEW.name,
        NEW.chip_number,
        'sortie',
        v_reason,
        CURRENT_DATE,
        NULL,
        'dog_status',
        NEW.id,
        'Sortie automatique liée au changement de statut.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_dog_status_update ON dogs;
CREATE TRIGGER trg_registry_after_dog_status_update
AFTER UPDATE OF status ON dogs
FOR EACH ROW
EXECUTE FUNCTION registry_after_dog_status_update();

CREATE OR REPLACE FUNCTION registry_after_puppy_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_birth_date DATE;
BEGIN
    SELECT birth_date INTO v_birth_date
    FROM litters
    WHERE id = NEW.litter_id
    LIMIT 1;

    PERFORM registry_insert_movement(
        NEW.breeder_id,
        'chiot',
        COALESCE(NEW.name, 'Chiot sans nom'),
        NEW.chip_number,
        'entree',
        'Naissance',
        COALESCE(NEW.birth_date, v_birth_date, CURRENT_DATE),
        NULL,
        'puppy_birth',
        NEW.id,
        'Entrée automatique à la création du chiot.'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_puppy_insert ON puppies;
CREATE TRIGGER trg_registry_after_puppy_insert
AFTER INSERT ON puppies
FOR EACH ROW
EXECUTE FUNCTION registry_after_puppy_insert();

CREATE OR REPLACE FUNCTION registry_after_puppy_status_update()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
    v_reason TEXT;
BEGIN
    v_status := lower(trim(COALESCE(NEW.status, '')));

    IF COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
        RETURN NEW;
    END IF;

    IF v_status IN ('décédé', 'decede', 'décédée', 'decedee', 'dead') THEN
        v_reason := 'Décès';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM registry_insert_movement(
        NEW.breeder_id,
        'chiot',
        COALESCE(NEW.name, 'Chiot sans nom'),
        NEW.chip_number,
        'sortie',
        v_reason,
        CURRENT_DATE,
        NULL,
        'puppy_status',
        NEW.id,
        'Sortie automatique liée au changement de statut du chiot.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_puppy_status_update ON puppies;
CREATE TRIGGER trg_registry_after_puppy_status_update
AFTER UPDATE OF status ON puppies
FOR EACH ROW
EXECUTE FUNCTION registry_after_puppy_status_update();

CREATE OR REPLACE FUNCTION registry_after_sale_insert_or_update()
RETURNS TRIGGER AS $$
DECLARE
    v_animal_name VARCHAR;
    v_chip_number VARCHAR;
    v_animal_type VARCHAR;
BEGIN
    IF COALESCE(NEW.is_reservation, FALSE) = TRUE THEN
        RETURN NEW;
    END IF;

    IF NEW.puppy_id IS NOT NULL THEN
        SELECT name, chip_number INTO v_animal_name, v_chip_number
        FROM puppies
        WHERE id = NEW.puppy_id;
        v_animal_type := 'chiot';
    ELSIF NEW.dog_id IS NOT NULL THEN
        SELECT name, chip_number INTO v_animal_name, v_chip_number
        FROM dogs
        WHERE id = NEW.dog_id;
        v_animal_type := 'adulte';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM registry_insert_movement(
        NEW.breeder_id,
        v_animal_type,
        COALESCE(v_animal_name, 'Animal vendu'),
        v_chip_number,
        'sortie',
        'Vente',
        COALESCE(NEW.sale_date, CURRENT_DATE),
        NEW.buyer_name,
        'sale',
        NEW.id,
        'Sortie automatique à la validation de la vente définitive.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_sale_insert ON sales;
CREATE TRIGGER trg_registry_after_sale_insert
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION registry_after_sale_insert_or_update();

DROP TRIGGER IF EXISTS trg_registry_after_sale_update ON sales;
CREATE TRIGGER trg_registry_after_sale_update
AFTER UPDATE OF is_reservation ON sales
FOR EACH ROW
WHEN (OLD.is_reservation IS DISTINCT FROM NEW.is_reservation)
EXECUTE FUNCTION registry_after_sale_insert_or_update();
