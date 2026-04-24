INSERT INTO breeder (name, slug)
VALUES ('Demo Elevage', 'demo-elevage')
ON CONFLICT (slug) DO NOTHING;

WITH demo_breeder AS (
  SELECT id FROM breeder WHERE slug = 'demo-elevage'
)
INSERT INTO users (breeder_id, email, password_hash, full_name, role)
SELECT id, 'admin@elevagepro.fr', '$2b$12$k3KX3XW8hpHItP3zM8P38u4s7nQUBU1fknT2rQvCGVY3Vv7xJkVFO', 'Admin Demo', 'owner'
FROM demo_breeder
ON CONFLICT (email) DO NOTHING;
