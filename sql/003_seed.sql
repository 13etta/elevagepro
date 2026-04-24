-- =========================
-- SEED ELEVAGE DEMO
-- =========================

-- 1. BREEDER
INSERT INTO breeder (name, slug)
VALUES ('Demo Elevage', 'demo-elevage')
ON CONFLICT (slug) DO NOTHING;

-- 2. USER ADMIN
WITH demo_breeder AS (
  SELECT id FROM breeder WHERE slug = 'demo-elevage'
)
INSERT INTO users (breeder_id, email, password_hash, full_name, role)
SELECT id,
       'admin@elevagepro.fr',
       '$2b$10$wHh7p5Zp6dP6V5eX7QYpOe1GZr6Jw5lWqZ2cY5h8tQxYb4kNfVx3K', -- mot de passe: Admin123!
       'Admin Demo',
       'owner'
FROM demo_breeder
ON CONFLICT (email) DO NOTHING;

-- =========================
-- DOGS
-- =========================

WITH demo_breeder AS (
  SELECT id FROM breeder WHERE slug = 'demo-elevage'
)

INSERT INTO dogs (breeder_id, name, sex, breed, status, birth_date)
SELECT id, 'Vainqueur', 'male', 'Setter anglais', 'active', '2023-01-01'
FROM demo_breeder
ON CONFLICT DO NOTHING;

WITH demo_breeder AS (
  SELECT id FROM breeder WHERE slug = 'demo-elevage'
)

INSERT INTO dogs (breeder_id, name, sex, breed, status, birth_date)
SELECT id, 'Altesse', 'female', 'Setter anglais', 'active', '2023-03-01'
FROM demo_breeder
ON CONFLICT DO NOTHING;

-- =========================
-- HEAT (chaleur)
-- =========================

WITH female AS (
  SELECT d.id, d.breeder_id
  FROM dogs d
  WHERE d.name = 'Altesse'
)

INSERT INTO heats (breeder_id, female_id, start_date, stage, status)
SELECT breeder_id, id, CURRENT_DATE - INTERVAL '10 days', 'estrus', 'active'
FROM female;

-- =========================
-- MATING
-- =========================

WITH male AS (
  SELECT id FROM dogs WHERE name = 'Vainqueur'
),
female AS (
  SELECT id, breeder_id FROM dogs WHERE name = 'Altesse'
)

INSERT INTO matings (breeder_id, male_id, female_id, mating_date, method)
SELECT f.breeder_id, m.id, f.id, CURRENT_DATE - INTERVAL '7 days', 'naturelle'
FROM male m, female f;

-- =========================
-- PREGNANCY
-- =========================

WITH last_mating AS (
  SELECT id, female_id, breeder_id
  FROM matings
  ORDER BY id DESC
  LIMIT 1
)

INSERT INTO pregnancies (breeder_id, mating_id, female_id, start_date, expected_birth_date)
SELECT breeder_id, id, female_id, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '55 days'
FROM last_mating;

-- =========================
-- LITTER
-- =========================

WITH last_pregnancy AS (
  SELECT id, female_id, breeder_id
  FROM pregnancies
  ORDER BY id DESC
  LIMIT 1
)

INSERT INTO litters (breeder_id, pregnancy_id, female_id, birth_date, puppy_count)
SELECT breeder_id, id, female_id, CURRENT_DATE, 3
FROM last_pregnancy;

-- =========================
-- PUPPIES
-- =========================

WITH last_litter AS (
  SELECT id, breeder_id FROM litters ORDER BY id DESC LIMIT 1
)

INSERT INTO puppies (breeder_id, litter_id, name, sex, birth_date, status)
SELECT breeder_id, id, 'Chiot 1', 'male', CURRENT_DATE, 'available'
FROM last_litter;

WITH last_litter AS (
  SELECT id, breeder_id FROM litters ORDER BY id DESC LIMIT 1
)

INSERT INTO puppies (breeder_id, litter_id, name, sex, birth_date, status)
SELECT breeder_id, id, 'Chiot 2', 'female', CURRENT_DATE, 'available'
FROM last_litter;

WITH last_litter AS (
  SELECT id, breeder_id FROM litters ORDER BY id DESC LIMIT 1
)

INSERT INTO puppies (breeder_id, litter_id, name, sex, birth_date, status)
SELECT breeder_id, id, 'Chiot 3', 'female', CURRENT_DATE, 'available'
FROM last_litter;

-- =========================
-- SOINS
-- =========================

WITH dog AS (
  SELECT id, breeder_id FROM dogs WHERE name = 'Vainqueur'
)

INSERT INTO soins (breeder_id, dog_id, label, event_date, type, next_due)
SELECT breeder_id, id, 'Vaccin annuel', CURRENT_DATE - INTERVAL '30 days', 'vaccin', CURRENT_DATE + INTERVAL '335 days'
FROM dog;

WITH dog AS (
  SELECT id, breeder_id FROM dogs WHERE name = 'Altesse'
)

INSERT INTO soins (breeder_id, dog_id, label, event_date, type, next_due)
SELECT breeder_id, id, 'Bravecto', CURRENT_DATE - INTERVAL '60 days', 'antiparasitaire', CURRENT_DATE + INTERVAL '30 days'
FROM dog;

-- =========================
-- REMINDERS
-- =========================

WITH dog AS (
  SELECT id, breeder_id FROM dogs WHERE name = 'Altesse'
)

INSERT INTO reminders (breeder_id, dog_id, type, label, due_date)
SELECT breeder_id, id, 'vaccin', 'Rappel vaccin', CURRENT_DATE + INTERVAL '30 days'
FROM dog;

-- =========================
-- SALES (exemple)
-- =========================

WITH puppy AS (
  SELECT id, breeder_id FROM puppies WHERE name = 'Chiot 1' LIMIT 1
)

INSERT INTO sales (breeder_id, puppy_id, sale_date, total_price, buyer_lastname, buyer_firstname)
SELECT breeder_id, id, CURRENT_DATE, 800, 'Dupont', 'Jean'
FROM puppy;