ALTER TABLE training_jobs ADD COLUMN quote_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE training_jobs ADD COLUMN valid_until date;
ALTER TABLE training_jobs ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE training_jobs ADD CONSTRAINT training_quote_validity CHECK(valid_until IS NULL OR valid_until >= quote_date);
ALTER TABLE training_jobs ADD CONSTRAINT training_details_object CHECK(jsonb_typeof(details)='object');
