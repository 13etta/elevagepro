-- Archivage opérationnel d'un chien sorti du cheptel.
-- Les données historiques restent en place et consultables ; seuls les liens actifs sont clôturés.

CREATE OR REPLACE FUNCTION archive_exited_dog()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.status, '')) = 'sorti'
     AND LOWER(COALESCE(OLD.status, '')) <> 'sorti' THEN

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dogs'
        AND column_name = 'infrastructure_id'
    ) THEN
      NEW.infrastructure_id := NULL;
    END IF;

    IF to_regclass('public.infrastructure_assignments') IS NOT NULL THEN
      EXECUTE
        'UPDATE infrastructure_assignments
         SET ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
         WHERE breeder_id = $1 AND dog_id = $2 AND ended_at IS NULL'
      USING NEW.breeder_id, NEW.id;
    END IF;

    IF to_regclass('public.reminders') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'reminders'
           AND column_name = 'is_completed'
       ) THEN
      EXECUTE
        'UPDATE reminders
         SET is_completed = TRUE
         WHERE breeder_id = $1 AND dog_id = $2 AND COALESCE(is_completed, FALSE) = FALSE'
      USING NEW.breeder_id, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_exited_dog ON dogs;
CREATE TRIGGER trg_archive_exited_dog
BEFORE UPDATE OF status ON dogs
FOR EACH ROW
EXECUTE FUNCTION archive_exited_dog();

CREATE INDEX IF NOT EXISTS idx_dogs_breeder_active_status
  ON dogs (breeder_id, status);
