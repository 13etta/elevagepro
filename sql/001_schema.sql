CREATE TABLE IF NOT EXISTS breeder (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dogs (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  sex VARCHAR(10),
  breed VARCHAR(120),
  lof VARCHAR(120),
  chip VARCHAR(120),
  id_scc VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  father_id INTEGER,
  mother_id INTEGER,
  birth_date DATE,
  pedigree TEXT,
  notes TEXT,
  chip_number VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heats (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  stage VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matings (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  male_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  mating_date DATE NOT NULL,
  method VARCHAR(120),
  place VARCHAR(180),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pregnancies (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  mating_id INTEGER REFERENCES matings(id) ON DELETE SET NULL,
  female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  start_date DATE,
  expected_birth_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'ongoing',
  result VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS litters (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  pregnancy_id INTEGER REFERENCES pregnancies(id) ON DELETE SET NULL,
  female_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  birth_date DATE,
  puppy_count INTEGER DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puppies (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  litter_id INTEGER REFERENCES litters(id) ON DELETE SET NULL,
  name VARCHAR(120),
  sex VARCHAR(10),
  birth_date DATE,
  color VARCHAR(80),
  chip_number VARCHAR(120),
  sale_price NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  is_sold BOOLEAN NOT NULL DEFAULT FALSE,
  owner_name VARCHAR(120),
  owner_firstname VARCHAR(120),
  owner_address TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soins (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  label VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  next_due DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(180) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  breeder_id INTEGER NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
  puppy_id INTEGER REFERENCES puppies(id) ON DELETE SET NULL,
  sale_date DATE NOT NULL,
  delivery_date DATE,
  total_price NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(60),
  invoice_number VARCHAR(80),
  documents_given TEXT,
  guarantees TEXT,
  buyer_lastname VARCHAR(120),
  buyer_firstname VARCHAR(120),
  buyer_address TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
