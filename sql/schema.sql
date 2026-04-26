CREATE TABLE movements (
    id SERIAL PRIMARY KEY,
    breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
    animal_type VARCHAR(50) NOT NULL,
    animal_name VARCHAR(100) NOT NULL,
    chip_number VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    provenance_destination VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer les recherches lors de l'affichage du registre
CREATE INDEX idx_movements_breeder_date ON movements(breeder_id, movement_date DESC);