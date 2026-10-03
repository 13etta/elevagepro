-- Dossiers clients indépendants du cheptel reproducteur.
CREATE TABLE training_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id uuid NOT NULL REFERENCES breeder(id) ON DELETE RESTRICT,
  quote_number text NOT NULL,
  client_name varchar(255) NOT NULL,
  client_address text NOT NULL DEFAULT '',
  client_email varchar(255) NOT NULL DEFAULT '',
  client_phone varchar(80) NOT NULL DEFAULT '',
  dog_name varchar(255) NOT NULL,
  dog_breed varchar(255) NOT NULL DEFAULT '',
  dog_chip varchar(80) NOT NULL DEFAULT '',
  service_label varchar(255) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  price_cents integer NOT NULL CHECK(price_cents > 0),
  deposit_cents integer NOT NULL CHECK(deposit_cents >= 0 AND deposit_cents <= price_cents),
  vat_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK(vat_rate BETWEEN 0 AND 100),
  tax_note text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','accepted','confirmed','completed','cancelled')),
  accepted_at timestamptz,
  acceptance_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,breeder_id), UNIQUE(breeder_id,quote_number),
  CHECK(end_date >= start_date AND end_date <= start_date + 365),
  CHECK(end_time > start_time),
  CHECK(cardinality(weekdays) > 0 AND weekdays <@ ARRAY[0,1,2,3,4,5,6])
);
CREATE TABLE training_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id uuid NOT NULL REFERENCES breeder(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('deposit','balance','refund')),
  amount_cents integer NOT NULL CHECK(amount_cents > 0),
  paid_on date NOT NULL,
  method varchar(80) NOT NULL,
  reference varchar(255) NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(job_id,breeder_id) REFERENCES training_jobs(id,breeder_id) ON DELETE RESTRICT,
  UNIQUE(breeder_id,idempotency_key)
);
CREATE TABLE training_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeder_id uuid NOT NULL REFERENCES breeder(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('invoice','deposit-invoice','credit')),
  number text NOT NULL,
  snapshot jsonb NOT NULL,
  source_key text NOT NULL DEFAULT 'job',
  issued_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(job_id,breeder_id) REFERENCES training_jobs(id,breeder_id),
  UNIQUE(breeder_id,number), UNIQUE(job_id,kind,source_key)
);
CREATE TABLE commercial_document_counters (
  breeder_id uuid NOT NULL REFERENCES breeder(id),
  series text NOT NULL,
  year integer NOT NULL,
  value integer NOT NULL,
  PRIMARY KEY(breeder_id,series,year)
);
ALTER TABLE calendar_events ADD COLUMN training_job_id uuid;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_training_job_tenant_fk
  FOREIGN KEY(training_job_id,breeder_id) REFERENCES training_jobs(id,breeder_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX calendar_training_date ON calendar_events(training_job_id,event_date) WHERE training_job_id IS NOT NULL;
CREATE INDEX training_jobs_tenant ON training_jobs(breeder_id,start_date);
CREATE INDEX training_payments_tenant ON training_payments(breeder_id,paid_on,job_id);
CREATE INDEX training_documents_tenant ON training_documents(breeder_id,job_id);
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_document_counters ENABLE ROW LEVEL SECURITY;
-- Authentification Express et accès PostgreSQL serveur, aucune exposition Data API.
REVOKE ALL ON training_jobs,training_payments,training_documents,commercial_document_counters FROM PUBLIC,anon,authenticated;
