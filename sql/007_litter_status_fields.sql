ALTER TABLE litters ADD COLUMN IF NOT EXISTS mother_id UUID REFERENCES dogs(id) ON DELETE CASCADE;
ALTER TABLE litters ADD COLUMN IF NOT EXISTS mating_id UUID REFERENCES matings(id) ON DELETE SET NULL;
ALTER TABLE litters ADD COLUMN IF NOT EXISTS puppies_count_total INTEGER DEFAULT 0;
ALTER TABLE litters ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE litters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'litters' AND column_name = 'female_id'
  ) THEN
    UPDATE litters SET mother_id = female_id WHERE mother_id IS NULL AND female_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'litters' AND column_name = 'puppies_count'
  ) THEN
    UPDATE litters SET puppies_count_total = puppies_count WHERE puppies_count_total IS NULL AND puppies_count IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'litters' AND column_name = 'nb_puppies'
  ) THEN
    UPDATE litters SET puppies_count_total = nb_puppies WHERE puppies_count_total IS NULL AND nb_puppies IS NOT NULL;
  END IF;
END $$;
