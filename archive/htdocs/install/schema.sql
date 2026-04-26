-- Structure de la base elevagepro (sans données)

-- Table breeder
CREATE TABLE IF NOT EXISTS breeder (
  id INT(11) NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  logo VARCHAR(255) DEFAULT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  siret VARCHAR(20) DEFAULT NULL,
  producer_number VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  theme ENUM('light','dark') DEFAULT 'light',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table dogs
CREATE TABLE IF NOT EXISTS dogs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  sex ENUM('M','F') NOT NULL,
  breed VARCHAR(100) DEFAULT 'Setter Anglais',
  lof VARCHAR(50) DEFAULT NULL,
  chip VARCHAR(50) DEFAULT NULL,
  id_scc VARCHAR(50) DEFAULT NULL,
  status ENUM('Actif','Réservé','Vendu','Retraité','Décédé') DEFAULT 'Actif',
  father_id INT(11) DEFAULT NULL,
  mother_id INT(11) DEFAULT NULL,
  birth_date DATE DEFAULT NULL,
  pedigree VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  chip_number VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_dogs_father (father_id),
  KEY fk_dogs_mother (mother_id),
  CONSTRAINT fk_dogs_father FOREIGN KEY (father_id) REFERENCES dogs (id) ON DELETE SET NULL,
  CONSTRAINT fk_dogs_mother FOREIGN KEY (mother_id) REFERENCES dogs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table heats
CREATE TABLE IF NOT EXISTS heats (
  id INT(11) NOT NULL AUTO_INCREMENT,
  dog_id INT(11) NOT NULL,
  female_id INT(11) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  start_at DATE NOT NULL,
  end_at DATE DEFAULT NULL,
  stage VARCHAR(50) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY dog_id (dog_id),
  KEY fk_heats_female (female_id),
  CONSTRAINT heats_ibfk_1 FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE CASCADE,
  CONSTRAINT fk_heats_female FOREIGN KEY (female_id) REFERENCES dogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table matings
CREATE TABLE IF NOT EXISTS matings (
  id INT(11) NOT NULL AUTO_INCREMENT,
  male_id INT(11) NOT NULL,
  female_id INT(11) NOT NULL,
  date DATE DEFAULT NULL,
  mating_date DATE NOT NULL,
  method ENUM('Naturelle','Insémination') DEFAULT 'Naturelle',
  place VARCHAR(150) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY male_id (male_id),
  KEY female_id (female_id),
  CONSTRAINT matings_ibfk_1 FOREIGN KEY (male_id) REFERENCES dogs (id) ON DELETE CASCADE,
  CONSTRAINT matings_ibfk_2 FOREIGN KEY (female_id) REFERENCES dogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table pregnancies
CREATE TABLE IF NOT EXISTS pregnancies (
  id INT(11) NOT NULL AUTO_INCREMENT,
  mating_id INT(11) DEFAULT NULL,
  female_id INT(11) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  expected_date DATE DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  start_at DATE NOT NULL,
  end_at DATE DEFAULT NULL,
  result ENUM('En cours','Réussie','Échec') DEFAULT 'En cours',
  notes TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY mating_id (mating_id),
  CONSTRAINT pregnancies_ibfk_1 FOREIGN KEY (mating_id) REFERENCES matings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table litters
CREATE TABLE IF NOT EXISTS litters (
  id INT(11) NOT NULL AUTO_INCREMENT,
  pregnancy_id INT(11) NOT NULL,
  mating_id INT(11) DEFAULT NULL,
  female_id INT(11) DEFAULT NULL,
  puppies_count INT(11) DEFAULT 0,
  birth_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT NULL,
  nb_puppies INT(11) DEFAULT 0,
  notes TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY pregnancy_id (pregnancy_id),
  KEY fk_litters_female (female_id),
  KEY fk_litters_mating (mating_id),
  CONSTRAINT litters_ibfk_1 FOREIGN KEY (pregnancy_id) REFERENCES pregnancies (id) ON DELETE CASCADE,
  CONSTRAINT fk_litters_female FOREIGN KEY (female_id) REFERENCES dogs (id) ON DELETE CASCADE,
  CONSTRAINT fk_litters_mating FOREIGN KEY (mating_id) REFERENCES matings (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table puppies
CREATE TABLE IF NOT EXISTS puppies (
  id INT(11) NOT NULL AUTO_INCREMENT,
  litter_id INT(11) NOT NULL,
  name VARCHAR(100) DEFAULT NULL,
  chip_number VARCHAR(50) DEFAULT NULL,
  color VARCHAR(100) DEFAULT NULL,
  sale_price DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  sex ENUM('M','F') DEFAULT NULL,
  birth_date DATE DEFAULT NULL,
  status ENUM('Actif','Réservé','Vendu','Décédé') DEFAULT 'Actif',
  PRIMARY KEY (id),
  KEY litter_id (litter_id),
  CONSTRAINT puppies_ibfk_1 FOREIGN KEY (litter_id) REFERENCES litters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table soins
CREATE TABLE IF NOT EXISTS soins (
  id INT(11) NOT NULL AUTO_INCREMENT,
  dog_id INT(11) NOT NULL,
  label VARCHAR(100) NOT NULL,
  event_date DATE DEFAULT NULL,
  type ENUM('Vaccin','Vermifuge','Antiparasitaire','Autre') NOT NULL,
  date DATE NOT NULL,
  next_due DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY dog_id (dog_id),
  CONSTRAINT soins_ibfk_1 FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table reminders
CREATE TABLE IF NOT EXISTS reminders (
  id INT(11) NOT NULL AUTO_INCREMENT,
  dog_id INT(11) DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  reminder_date DATE NOT NULL,
  done TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  KEY dog_id (dog_id),
  CONSTRAINT reminders_ibfk_1 FOREIGN KEY (dog_id) REFERENCES dogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table users
CREATE TABLE IF NOT EXISTS users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
