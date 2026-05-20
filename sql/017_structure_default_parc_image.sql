-- Image par défaut pour les parcs d'exercice / parcs d'ébats.
-- La mise à jour corrige les structures existantes.
-- Le trigger garantit que les futurs parcs créés avec l'ancienne image générique héritent de l'image métier.

ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

UPDATE infrastructures
SET image_url = 'https://www.epagneul-breton.ws/wp-content/uploads/2021/08/Activites-epagneul-breton-1024x683.jpeg',
    updated_at = CURRENT_TIMESTAMP
WHERE lower(COALESCE(type, '')) IN ('parc', 'yard', 'exercice', 'exercise')
   OR lower(COALESCE(name, '')) LIKE '%parc%'
   OR lower(COALESCE(name, '')) LIKE '%exercice%'
   OR lower(COALESCE(name, '')) LIKE '%ébats%'
   OR lower(COALESCE(name, '')) LIKE '%ebats%';

CREATE OR REPLACE FUNCTION set_default_structure_images()
RETURNS trigger AS $$
BEGIN
  IF (
    lower(COALESCE(NEW.type, '')) IN ('parc', 'yard', 'exercice', 'exercise')
    OR lower(COALESCE(NEW.name, '')) LIKE '%parc%'
    OR lower(COALESCE(NEW.name, '')) LIKE '%exercice%'
    OR lower(COALESCE(NEW.name, '')) LIKE '%ébats%'
    OR lower(COALESCE(NEW.name, '')) LIKE '%ebats%'
  )
  AND (
    NEW.image_url IS NULL
    OR trim(NEW.image_url) = ''
    OR NEW.image_url = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82'
  ) THEN
    NEW.image_url := 'https://www.epagneul-breton.ws/wp-content/uploads/2021/08/Activites-epagneul-breton-1024x683.jpeg';
  END IF;

  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_default_structure_images ON infrastructures;
CREATE TRIGGER trg_set_default_structure_images
BEFORE INSERT OR UPDATE ON infrastructures
FOR EACH ROW
EXECUTE FUNCTION set_default_structure_images();
