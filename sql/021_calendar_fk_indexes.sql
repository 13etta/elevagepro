-- Complète les index des clés étrangères composites du calendrier.

DROP INDEX IF EXISTS idx_calendar_event_dogs_dog;

CREATE INDEX IF NOT EXISTS idx_calendar_event_dogs_dog
  ON calendar_event_dogs (dog_id, breeder_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_dogs_event_tenant
  ON calendar_event_dogs (event_id, breeder_id);
