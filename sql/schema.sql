CREATE TABLE IF NOT EXISTS breeder (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    first_name TEXT,
    last_name TEXT,
    siret TEXT,
    producer_number TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    theme TEXT DEFAULT 'dark'
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dogs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sex TEXT,
    breed TEXT,
    lof TEXT,
    chip TEXT,
    id_scc TEXT,
    status TEXT DEFAULT 'actif',
    father_id INTEGER,
    mother_id INTEGER,
    birth_date DATE,
    pedigree TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    chip_number TEXT,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS heats (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER,
    female_id INTEGER,
    start_date DATE,
    end_date DATE,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    stage TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS matings (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    male_id INTEGER,
    female_id INTEGER,
    date DATE,
    mating_date DATE,
    method TEXT,
    place TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS pregnancies (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    mating_id INTEGER,
    female_id INTEGER,
    start_date DATE,
    expected_date DATE,
    due_date DATE,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    result TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS litters (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    pregnancy_id INTEGER,
    mating_id INTEGER,
    female_id INTEGER,
    puppies_count INTEGER,
    birth_date DATE,
    status TEXT,
    nb_puppies INTEGER,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS puppies (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    litter_id INTEGER,
    name TEXT,
    chip_number TEXT,
    color TEXT,
    sale_price NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    sex TEXT,
    birth_date DATE,
    status TEXT,
    is_sold BOOLEAN DEFAULT FALSE,
    owner_name TEXT,
    owner_firstname TEXT,
    owner_address TEXT
);

CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE,
    type TEXT,
    dog_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    puppy_id INTEGER,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    buyer_name TEXT,
    buyer_firstname TEXT,
    buyer_address TEXT,
    buyer_company TEXT,
    sale_date DATE,
    delivery_date DATE,
    price NUMERIC(10,2),
    payment_method TEXT,
    documents_given TEXT,
    guarantees TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    invoice_number TEXT
);

CREATE TABLE IF NOT EXISTS soins (
    id SERIAL PRIMARY KEY,
    breeder_id INTEGER REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id INTEGER,
    label TEXT,
    event_date DATE,
    type TEXT,
    date DATE,
    next_due DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO breeder (id, name, first_name, last_name, theme)
VALUES (1, 'Élevage Démo', 'Loïc', 'Darras', 'dark')
ON CONFLICT DO NOTHING;

INSERT INTO users (breeder_id, name, email, password_hash, role)
VALUES (1, 'Administrateur', 'admin@elevage.local', '$2y$10$zeUuV6SHQXcXdN3qP.XPSe.Cvvrh55iZ8R4S3ErUJHrn6rF2OC41W', 'admin')
ON CONFLICT (email) DO NOTHING;
