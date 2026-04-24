CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS breeder (
    id SERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    logo TEXT,
    first_name VARCHAR(120),
    last_name VARCHAR(120),
    siret VARCHAR(32),
    producer_number VARCHAR(80),
    theme VARCHAR(80) DEFAULT 'premium_dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(190) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(40) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dogs (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    name VARCHAR(140) NOT NULL,
    sex VARCHAR(20),
    breed VARCHAR(120),
    lof VARCHAR(80),
    chip VARCHAR(80),
    chip_number VARCHAR(80),
    id_scc VARCHAR(80),
    status VARCHAR(60) DEFAULT 'actif',
    father_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    mother_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    birth_date DATE,
    pedigree TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heats (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
    female_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    stage VARCHAR(80),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS matings (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    male_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    date DATE,
    mating_date DATE,
    method VARCHAR(80),
    place VARCHAR(160),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS pregnancies (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    mating_id INTEGER REFERENCES matings(id) ON DELETE SET NULL,
    female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    start_date DATE,
    expected_date DATE,
    due_date DATE,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    result VARCHAR(80),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS litters (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    pregnancy_id INTEGER REFERENCES pregnancies(id) ON DELETE SET NULL,
    mating_id INTEGER REFERENCES matings(id) ON DELETE SET NULL,
    female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    puppies_count INTEGER DEFAULT 0,
    nb_puppies INTEGER DEFAULT 0,
    birth_date DATE,
    status VARCHAR(80) DEFAULT 'prévue',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS puppies (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    litter_id INTEGER REFERENCES litters(id) ON DELETE CASCADE,
    name VARCHAR(140),
    chip_number VARCHAR(80),
    color VARCHAR(80),
    sale_price NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sex VARCHAR(20),
    birth_date DATE,
    status VARCHAR(80) DEFAULT 'disponible',
    is_sold BOOLEAN DEFAULT FALSE,
    owner_name VARCHAR(160),
    owner_firstname VARCHAR(160),
    owner_address TEXT
);

CREATE TABLE IF NOT EXISTS soins (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
    label VARCHAR(160) NOT NULL,
    event_date DATE,
    type VARCHAR(80),
    date DATE,
    next_due DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_protocols (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
    product VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    given_date DATE NOT NULL,
    next_due DATE,
    dose VARCHAR(80),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disinfections (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    zone VARCHAR(140) NOT NULL,
    product VARCHAR(140),
    disinfection_date DATE NOT NULL,
    next_due DATE,
    protocol TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weights (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
    weight_date DATE NOT NULL,
    weight_kg NUMERIC(6,2) NOT NULL,
    body_condition VARCHAR(80),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    due_date DATE NOT NULL,
    type VARCHAR(80),
    dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    puppy_id INTEGER REFERENCES puppies(id) ON DELETE SET NULL,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    buyer_name VARCHAR(160),
    buyer_firstname VARCHAR(160),
    buyer_address TEXT,
    buyer_company VARCHAR(160),
    sale_date DATE,
    delivery_date DATE,
    price NUMERIC(10,2),
    payment_method VARCHAR(80),
    documents_given TEXT,
    guarantees TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invoice_number VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS site_settings (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE UNIQUE,
    public_slug VARCHAR(120) UNIQUE,
    headline VARCHAR(200),
    description TEXT,
    phone VARCHAR(80),
    email VARCHAR(190),
    city VARCHAR(140),
    accent_color VARCHAR(40) DEFAULT '#b88746',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO breeder (name, first_name, last_name, theme)
SELECT 'Elevage Démo', 'Loïc', 'Darras', 'premium_dark'
WHERE NOT EXISTS (SELECT 1 FROM breeder);

INSERT INTO users (breeder_id, name, email, password_hash, role)
SELECT id, 'Administrateur', 'admin@elevagepro.fr', '$2y$10$w6BccwAf6FvP/ZvQLFwj8u3Xx8sHK7tgsgr3OOrE4y2NcVvIvrbMa', 'admin'
FROM breeder
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@elevagepro.fr');
