-- Table des Élevages (le cœur du SaaS)
CREATE TABLE breeders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    affixe VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des Utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeders(id) ON DELETE CASCADE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin', -- admin, employe
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion d'un compte de test (Mot de passe : admin123)
INSERT INTO breeders (name, affixe) VALUES ('Élevage Démo', 'DU VAL DES SOURCES');
INSERT INTO users (breeder_id, email, password_hash, name) 
VALUES (1, 'demo@elevagepro.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrateur');