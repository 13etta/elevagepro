ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS female_id UUID REFERENCES dogs(id) ON DELETE CASCADE;
ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS expected_date DATE;
ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS result VARCHAR(50) DEFAULT 'En cours';
ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancies' AND column_name = 'dog_id'
  ) THEN
    UPDATE pregnancies SET female_id = dog_id WHERE female_id IS NULL AND dog_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancies' AND column_name = 'confirmation_date'
  ) THEN
    UPDATE pregnancies SET start_date = confirmation_date WHERE start_date IS NULL AND confirmation_date IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancies' AND column_name = 'expected_delivery_date'
  ) THEN
    UPDATE pregnancies SET expected_date = expected_delivery_date WHERE expected_date IS NULL AND expected_delivery_date IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancies' AND column_name = 'status'
  ) THEN
    UPDATE pregnancies
    SET result = CASE
      WHEN status IN ('en_cours', 'active') THEN 'En cours'
      WHEN status IN ('terminee', 'réussie', 'reussie') THEN 'Réussie'
      WHEN status IN ('echec', 'échec') THEN 'Échec'
      ELSE COALESCE(status, result)
    END
    WHERE result IS NULL OR result = 'En cours';
  END IF;
END $$;
