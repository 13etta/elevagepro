-- Création de l'éleveur (ID forcé pour la démo)
INSERT INTO breeder (id, company_name, affix_name) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Élevage Démo', 'De la Plaine');

-- Utilisateur : admin@demo.com / mdp : password123
INSERT INTO users (breeder_id, email, password_hash)
VALUES ('11111111-1111-1111-1111-111111111111', 'admin@demo.com', '$2b$10$px79V2S5.Y6Y9Wl7.mZ6uOaC6m6E1mFvKzGvA/u8X8g5X5X5X5X5X');

-- Quelques chiens
INSERT INTO dogs (id, breeder_id, name, sex, breed, status)
VALUES 
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Apollo', 'M', 'Golden Retriever', 'actif'),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Bella', 'F', 'Golden Retriever', 'actif');