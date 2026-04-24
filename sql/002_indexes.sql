CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

CREATE INDEX IF NOT EXISTS idx_users_breeder ON users(breeder_id);
CREATE INDEX IF NOT EXISTS idx_dogs_breeder ON dogs(breeder_id);
CREATE INDEX IF NOT EXISTS idx_heats_breeder ON heats(breeder_id);
CREATE INDEX IF NOT EXISTS idx_matings_breeder ON matings(breeder_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_breeder ON pregnancies(breeder_id);
CREATE INDEX IF NOT EXISTS idx_litters_breeder ON litters(breeder_id);
CREATE INDEX IF NOT EXISTS idx_puppies_breeder ON puppies(breeder_id);
CREATE INDEX IF NOT EXISTS idx_soins_breeder ON soins(breeder_id);
CREATE INDEX IF NOT EXISTS idx_reminders_breeder ON reminders(breeder_id);
CREATE INDEX IF NOT EXISTS idx_sales_breeder ON sales(breeder_id);

CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_soins_event_date ON soins(event_date);
