-- Calendrier professionnel : concours, TAN, expositions, rendez-vous et échéances.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'autre',
  event_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN NOT NULL DEFAULT TRUE,
  location VARCHAR(255),
  organizer VARCHAR(255),
  judge_name VARCHAR(255),
  registration_deadline DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'prevu',
  cost NUMERIC(10, 2),
  document_url TEXT,
  reminder_days INTEGER[] NOT NULL DEFAULT ARRAY[30, 15, 7, 1],
  ranking VARCHAR(100),
  qualification VARCHAR(160),
  award VARCHAR(160),
  notes TEXT,
  result_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calendar_events_category_check CHECK (
    category IN (
      'tan', 'field_trial', 'beaute', 'confirmation', 'exposition',
      'entrainement', 'chasse', 'veterinaire', 'reproduction',
      'administratif', 'autre'
    )
  ),
  CONSTRAINT calendar_events_status_check CHECK (
    status IN ('prevu', 'inscrit', 'confirme', 'termine', 'annule')
  ),
  CONSTRAINT calendar_events_dates_check CHECK (
    end_date IS NULL OR end_date >= event_date
  ),
  CONSTRAINT calendar_events_cost_check CHECK (
    cost IS NULL OR cost >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_calendar_events_id_breeder
  ON calendar_events (id, breeder_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dogs_id_breeder
  ON dogs (id, breeder_id);

CREATE TABLE IF NOT EXISTS calendar_event_dogs (
  event_id UUID NOT NULL,
  dog_id UUID NOT NULL,
  breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, dog_id),
  CONSTRAINT calendar_event_dogs_event_tenant_fkey
    FOREIGN KEY (event_id, breeder_id)
    REFERENCES calendar_events(id, breeder_id)
    ON DELETE CASCADE,
  CONSTRAINT calendar_event_dogs_dog_tenant_fkey
    FOREIGN KEY (dog_id, breeder_id)
    REFERENCES dogs(id, breeder_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_breeder_date
  ON calendar_events (breeder_id, event_date, status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_breeder_deadline
  ON calendar_events (breeder_id, registration_deadline)
  WHERE registration_deadline IS NOT NULL AND status <> 'annule';

CREATE INDEX IF NOT EXISTS idx_calendar_event_dogs_breeder
  ON calendar_event_dogs (breeder_id, dog_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_dogs_dog
  ON calendar_event_dogs (dog_id, breeder_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_dogs_event_tenant
  ON calendar_event_dogs (event_id, breeder_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_dogs ENABLE ROW LEVEL SECURITY;

-- ElevagePro utilise une connexion PostgreSQL serveur et applique breeder_id
-- dans chaque requête. Les tables ne sont pas exposées aux clients Data API.
REVOKE ALL ON TABLE calendar_events FROM anon, authenticated;
REVOKE ALL ON TABLE calendar_event_dogs FROM anon, authenticated;
