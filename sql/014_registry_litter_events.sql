-- Registre automatisé : événements de naissance de portée
-- Les chiens adultes et les chiots sont déjà couverts par 012_registry_automation.sql.
-- Cette migration ajoute le mouvement global de portée : création portée -> entrée Naissance portée.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE movements ADD COLUMN IF NOT EXISTS movement_source_type VARCHAR(80);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS movement_source_id UUID;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_unique_source
ON movements(breeder_id, movement_source_type, movement_source_id, movement_type, reason)
WHERE movement_source_type IS NOT NULL
  AND movement_source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION registry_after_litter_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_mother_name VARCHAR;
    v_puppy_count INTEGER;
    v_litter_name VARCHAR;
BEGIN
    SELECT name INTO v_mother_name
    FROM dogs
    WHERE id = NEW.mother_id
    LIMIT 1;

    v_puppy_count := COALESCE(NEW.puppies_count_total, 0);
    v_litter_name := 'Portée' ||
        CASE WHEN v_mother_name IS NOT NULL THEN ' de ' || v_mother_name ELSE '' END ||
        CASE WHEN NEW.birth_date IS NOT NULL THEN ' - ' || to_char(NEW.birth_date, 'DD/MM/YYYY') ELSE '' END;

    PERFORM registry_insert_movement(
        NEW.breeder_id,
        'portee',
        v_litter_name,
        NULL,
        'entree',
        'Naissance portée',
        COALESCE(NEW.birth_date, CURRENT_DATE),
        NULL,
        'litter_birth',
        NEW.id,
        'Entrée automatique à la création de la portée. Nombre déclaré : ' || v_puppy_count::text || '.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_after_litter_insert ON litters;
CREATE TRIGGER trg_registry_after_litter_insert
AFTER INSERT ON litters
FOR EACH ROW
EXECUTE FUNCTION registry_after_litter_insert();

-- Reprise historique des portées déjà créées avant ce trigger.
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
)
SELECT
    l.breeder_id,
    'portee' AS animal_type,
    left(
        'Portée' ||
        CASE WHEN mother.name IS NOT NULL THEN ' de ' || mother.name ELSE '' END ||
        CASE WHEN l.birth_date IS NOT NULL THEN ' - ' || to_char(l.birth_date, 'DD/MM/YYYY') ELSE '' END,
        100
    ) AS animal_name,
    NULL AS chip_number,
    'entree' AS movement_type,
    'Naissance portée' AS reason,
    COALESCE(l.birth_date, CURRENT_DATE) AS movement_date,
    NULL AS provenance_destination,
    'litter_birth' AS movement_source_type,
    l.id AS movement_source_id,
    'Reprise historique automatique des portées déjà présentes. Nombre déclaré : ' || COALESCE(l.puppies_count_total, 0)::text || '.' AS notes
FROM litters l
LEFT JOIN dogs mother ON mother.id = l.mother_id
WHERE l.breeder_id IS NOT NULL
ON CONFLICT (breeder_id, movement_source_type, movement_source_id, movement_type, reason)
WHERE movement_source_type IS NOT NULL
  AND movement_source_id IS NOT NULL
DO NOTHING;
