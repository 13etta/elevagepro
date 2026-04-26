-- Activation de l'extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table requise par connect-pg-simple pour les sessions persistantes
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

-- ==========================================
-- NETTOYAGE DE DEVELOPPEMENT (A retirer en production)
-- ==========================================
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS soins CASCADE;
DROP TABLE IF EXISTS puppies CASCADE;
DROP TABLE IF EXISTS litters CASCADE;
DROP TABLE IF EXISTS pregnancies CASCADE;
DROP TABLE IF EXISTS matings CASCADE;
DROP TABLE IF EXISTS heats CASCADE;
DROP TABLE IF EXISTS dogs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS breeder CASCADE;
-- ==========================================

-- 1. ELEVEURS (Compte principal)
CREATE TABLE IF NOT EXISTS breeder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    affix_name VARCHAR(255),
    siret VARCHAR(14),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. UTILISATEURS (Accès staff)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE, -- Ajout de la colonne de vérification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CHIENS (Reproducteurs et retraités)
CREATE TABLE IF NOT EXISTS dogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sex CHAR(1) CHECK (sex IN ('M', 'F')),
    breed VARCHAR(255),
    birth_date DATE,
    chip_number VARCHAR(15),
    id_scc VARCHAR(50),
    pedigree_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'actif',
    father_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
    mother_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CHALEURS
CREATE TABLE IF NOT EXISTS heats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    stage VARCHAR(50),
    notes TEXT
);

-- 5. SAILLIES
CREATE TABLE IF NOT EXISTS matings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    female_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    male_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    mating_date DATE NOT NULL,
    method VARCHAR(50) DEFAULT 'naturelle',
    place VARCHAR(255),
    notes TEXT
);

-- 6. GESTATIONS
CREATE TABLE IF NOT EXISTS pregnancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    mating_id UUID REFERENCES matings(id) ON DELETE CASCADE,
    dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    confirmation_date DATE,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'en_cours',
    notes TEXT
);

-- 7. PORTÉES
CREATE TABLE IF NOT EXISTS litters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    mother_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    pregnancy_id UUID REFERENCES pregnancies(id) ON DELETE SET NULL,
    birth_date DATE NOT NULL,
    puppies_count_total INTEGER DEFAULT 0,
    notes TEXT
);

-- 8. CHIOTS
CREATE TABLE IF NOT EXISTS puppies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    litter_id UUID REFERENCES litters(id) ON DELETE CASCADE,
    name VARCHAR(255),
    sex CHAR(1) CHECK (sex IN ('M', 'F')),
    color VARCHAR(100),
    chip_number VARCHAR(15),
    status VARCHAR(50) DEFAULT 'disponible',
    sale_price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. SOINS
CREATE TABLE IF NOT EXISTS soins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    next_due DATE,
    notes TEXT
);

-- 10. RAPPELS
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
    type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. VENTES
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breeder_id UUID REFERENCES breeder(id) ON DELETE CASCADE,
    puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE,
    buyer_name VARCHAR(255),
    sale_date DATE NOT NULL,
    price DECIMAL(10, 2),
    payment_method VARCHAR(50),
    invoice_number VARCHAR(100),
    notes TEXT
);