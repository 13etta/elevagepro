-- migrations/001_init.sql
-- Create all core tables and a default admin user

CREATE TABLE IF NOT EXISTS users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(190) NULL,
  role VARCHAR(50) DEFAULT 'admin',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users(email,name,role,password_hash)
VALUES('admin@example.com','Admin','admin','$2b$12$Z9RXzGetVelvQ5Qu0sy/u.Xnb8keREY8bEDdVbKwPUSlxqGQhJQ8.');

CREATE TABLE IF NOT EXISTS dogs(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  breed VARCHAR(120) DEFAULT 'Setter anglais',
  sex ENUM('M','F') NOT NULL,
  dob DATE NULL,
  reg_number VARCHAR(120) NULL,
  microchip VARCHAR(120) NULL,
  color VARCHAR(120) NULL,
  breeder VARCHAR(190) NULL,
  sire_name VARCHAR(190) NULL,
  dam_name VARCHAR(190) NULL,
  status ENUM('active','retired','sold','deceased') DEFAULT 'active',
  weight_kg DECIMAL(5,2) NULL,
  height_cm INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dogs_sex(sex),
  INDEX idx_dogs_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS heats(
  id INT AUTO_INCREMENT PRIMARY KEY,
  dog_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  stage ENUM('proestrus','estrus','diestrus','anestrus') DEFAULT 'proestrus',
  notes TEXT NULL,
  CONSTRAINT fk_heats_dog FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE,
  INDEX idx_heats_start(start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matings(
  id INT AUTO_INCREMENT PRIMARY KEY,
  female_id INT NOT NULL,
  male_id INT NOT NULL,
  date DATE NOT NULL,
  method ENUM('natural','AI') DEFAULT 'natural',
  location VARCHAR(190) NULL,
  progesterone_ng_ml DECIMAL(5,2) NULL,
  tie_minutes INT NULL,
  repeats INT DEFAULT 1,
  success TINYINT(1) DEFAULT 0,
  notes TEXT NULL,
  FOREIGN KEY (female_id) REFERENCES dogs(id) ON DELETE CASCADE,
  FOREIGN KEY (male_id) REFERENCES dogs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pregnancies(
  id INT AUTO_INCREMENT PRIMARY KEY,
  mating_id INT NOT NULL,
  expected_due_date DATE NULL,
  ultrasound_date DATE NULL,
  ultrasound_result ENUM('positive','negative','unknown') DEFAULT 'unknown',
  xray_date DATE NULL,
  xray_count INT NULL,
  supplements TEXT NULL,
  whelping_box_ready TINYINT(1) DEFAULT 0,
  FOREIGN KEY (mating_id) REFERENCES matings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS litters(
  id INT AUTO_INCREMENT PRIMARY KEY,
  mating_id INT NOT NULL,
  whelp_date DATE NULL,
  puppies_born INT DEFAULT 0,
  puppies_alive INT DEFAULT 0,
  c_section TINYINT(1) DEFAULT 0,
  complications TEXT NULL,
  notes TEXT NULL,
  FOREIGN KEY (mating_id) REFERENCES matings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS puppies(
  id INT AUTO_INCREMENT PRIMARY KEY,
  litter_id INT NOT NULL,
  name VARCHAR(190) NULL,
  sex ENUM('M','F') NULL,
  color VARCHAR(120) NULL,
  weight_birth_g INT NULL,
  status ENUM('alive','deceased','sold','reserved','kept') DEFAULT 'alive',
  FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vaccinations(
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_type ENUM('dog','puppy') NOT NULL,
  subject_id INT NOT NULL,
  date DATE NOT NULL,
  next_due_date DATE NULL,
  vaccine VARCHAR(120) NOT NULL,
  vet VARCHAR(190) NULL,
  batch VARCHAR(120) NULL,
  notes TEXT NULL,
  completed TINYINT(1) DEFAULT 0,
  INDEX idx_vacc_next(next_due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dewormings(
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_type ENUM('dog','puppy') NOT NULL,
  subject_id INT NOT NULL,
  date DATE NOT NULL,
  next_due_date DATE NULL,
  product VARCHAR(120) NOT NULL,
  weight_kg DECIMAL(5,2) NULL,
  notes TEXT NULL,
  INDEX idx_deworm_next(next_due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS health_tests(
  id INT AUTO_INCREMENT PRIMARY KEY,
  dog_id INT NOT NULL,
  test_name VARCHAR(190) NOT NULL,
  result VARCHAR(190) NULL,
  date DATE NULL,
  lab VARCHAR(190) NULL,
  file_path VARCHAR(255) NULL,
  FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events(
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date_time DATETIME NOT NULL,
  type VARCHAR(60) NOT NULL,
  related_type VARCHAR(60) NULL,
  related_id INT NULL,
  due TINYINT(1) DEFAULT 0,
  completed TINYINT(1) DEFAULT 0,
  notes TEXT NULL,
  INDEX idx_events_dt(date_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks(
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  due_date DATE NULL,
  priority ENUM('low','med','high') DEFAULT 'med',
  completed TINYINT(1) DEFAULT 0,
  related_type VARCHAR(60) NULL,
  related_id INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(60) NULL,
  address VARCHAR(255) NULL,
  notes TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales(
  id INT AUTO_INCREMENT PRIMARY KEY,
  puppy_id INT NOT NULL,
  client_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  contract_signed TINYINT(1) DEFAULT 0,
  date_reserved DATE NULL,
  date_sold DATE NULL,
  notes TEXT NULL,
  FOREIGN KEY (puppy_id) REFERENCES puppies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS files(
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_type VARCHAR(60) NOT NULL,
  owner_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
