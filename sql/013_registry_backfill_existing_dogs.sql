-- Reprise historique des chiens déjà créés dans le registre canonique movements
-- Objectif : les triggers automatisent les futurs inserts, mais ne rejouent pas les chiens déjà présents.
-- Cette migration crée donc une entrée Acquisition idempotente pour chaque chien existant.

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
    d.breeder_id,
    'adulte' AS animal_type,
    left(d.name, 100) AS animal_name,
    NULLIF(trim(COALESCE(d.chip_number, '')), '') AS chip_number,
    'entree' AS movement_type,
    'Acquisition' AS reason,
    COALESCE(d.created_at::date, CURRENT_DATE) AS movement_date,
    NULL AS provenance_destination,
    'dog_creation' AS movement_source_type,
    d.id AS movement_source_id,
    'Reprise historique automatique des chiens déjà présents avant automatisation du registre.' AS notes
FROM dogs d
WHERE d.breeder_id IS NOT NULL
  AND COALESCE(trim(d.name), '') <> ''
ON CONFLICT (breeder_id, movement_source_type, movement_source_id, movement_type, reason)
WHERE movement_source_type IS NOT NULL
  AND movement_source_id IS NOT NULL
DO NOTHING;

-- Reprise historique complémentaire : chiens déjà sortis par statut avant automatisation.
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
    d.breeder_id,
    'adulte' AS animal_type,
    left(d.name, 100) AS animal_name,
    NULLIF(trim(COALESCE(d.chip_number, '')), '') AS chip_number,
    'sortie' AS movement_type,
    CASE
        WHEN lower(trim(COALESCE(d.status, ''))) IN ('décédé', 'decede', 'décédée', 'decedee', 'dead') THEN 'Décès'
        ELSE 'Retraite / réforme'
    END AS reason,
    CURRENT_DATE AS movement_date,
    NULL AS provenance_destination,
    'dog_status' AS movement_source_type,
    d.id AS movement_source_id,
    'Reprise historique automatique du statut de sortie déjà présent avant automatisation du registre.' AS notes
FROM dogs d
WHERE d.breeder_id IS NOT NULL
  AND COALESCE(trim(d.name), '') <> ''
  AND lower(trim(COALESCE(d.status, ''))) IN (
      'décédé', 'decede', 'décédée', 'decedee', 'dead',
      'retraite', 'retiré', 'retire', 'retirée', 'reformé', 'reforme', 'réforme', 'reforme elevage'
  )
ON CONFLICT (breeder_id, movement_source_type, movement_source_id, movement_type, reason)
WHERE movement_source_type IS NOT NULL
  AND movement_source_id IS NOT NULL
DO NOTHING;
