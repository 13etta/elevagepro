const { pool } = require('../db');
const pdfService = require('../utils/pdf.service');

exports.listSales = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // COALESCE permet de prendre le nom du chiot, et s'il n'existe pas, de prendre le nom du chien adulte
        const sales = await pool.query(`
            SELECT s.*, 
                   COALESCE(p.name, d.name) AS animal_name
            FROM sales s
            LEFT JOIN puppies p ON s.puppy_id = p.id
            LEFT JOIN dogs d ON s.dog_id = d.id
            WHERE s.breeder_id = $1
            ORDER BY s.sale_date DESC
        `, [breederId]);

        const totalRevenue = sales.rows.reduce((sum, sale) => sum + parseFloat(sale.price || 0), 0);

        res.render('sales/index', {
            sales: sales.rows,
            totalRevenue: totalRevenue.toFixed(2)
        });
    } catch (error) {
        console.error('Erreur liste ventes:', error);
        res.status(500).send('Erreur lors du chargement du module financier.');
    }
};

exports.getSaleForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // On récupère les deux listes d'animaux disponibles
        const puppies = await pool.query(`SELECT id, name, chip_number FROM puppies WHERE breeder_id = $1 AND lower(status) = 'disponible' ORDER BY name ASC`, [breederId]);
        const dogs = await pool.query(`SELECT id, name, chip_number FROM dogs WHERE breeder_id = $1 AND lower(status) = 'disponible' ORDER BY name ASC`, [breederId]);

        res.render('sales/new', { puppies: puppies.rows, dogs: dogs.rows });
    } catch (error) {
        console.error('Erreur chargement formulaire vente:', error);
        res.status(500).send('Erreur d\'ouverture du formulaire.');
    }
};

exports.createSale = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { animal_selection, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount } = req.body;

        const isResa = is_reservation === 'true';
        const deposit = deposit_amount ? parseFloat(deposit_amount) : 0;
        const targetStatus = isResa ? 'réservé' : 'vendu';

        // Extraction du type (puppy ou dog) et de l'ID depuis le menu déroulant
        const [animalType, animalId] = animal_selection.split('|');
        const puppyId = animalType === 'puppy' ? animalId : null;
        const dogId = animalType === 'dog' ? animalId : null;

        await client.query('BEGIN');

        await client.query(`
            INSERT INTO sales (breeder_id, puppy_id, dog_id, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [breederId, puppyId, dogId, buyer_name, sale_date, price, payment_method, notes, isResa, deposit]);

        // Récupération des infos de l'animal pour le registre légal
        const table = animalType === 'puppy' ? 'puppies' : 'dogs';
        const animalDataRes = await client.query(`SELECT name, chip_number FROM ${table} WHERE id = $1`, [animalId]);
        const animalName = animalDataRes.rows[0].name;
        const animalChip = animalDataRes.rows[0].chip_number;

        // Mise à jour du statut de l'animal
        await client.query(`UPDATE ${table} SET status = $1 WHERE id = $2 AND breeder_id = $3`, [targetStatus, animalId, breederId]);
        
        // Inscription au registre UNIQUEMENT si c'est un départ définitif
        if (!isResa) {
            await client.query(`
                INSERT INTO movements (breeder_id, animal_type, animal_name, chip_number, movement_type, reason, movement_date, provenance_destination)
                VALUES ($1, $2, $3, $4, 'sortie', 'vente', $5, $6)
            `, [breederId, animalType === 'puppy' ? 'chiot' : 'adulte', animalName, animalChip, sale_date, buyer_name]);
        }

        await client.query('COMMIT');
        res.redirect('/sales');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur enregistrement transaction:', error);
        res.status(500).send('Erreur lors de la finalisation.');
    } finally {
        client.release();
    }
};

exports.downloadDocument = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const saleId = req.params.id;
        const docType = req.params.type;

        const saleRes = await pool.query(`
            SELECT s.*, 
                   COALESCE(p.name, d.name) AS name,
                   COALESCE(p.sex, d.sex) AS sex,
                   COALESCE(p.chip_number, d.chip_number) AS chip_number,
                   p.color AS color
            FROM sales s
            LEFT JOIN puppies p ON s.puppy_id = p.id
            LEFT JOIN dogs d ON s.dog_id = d.id
            WHERE s.id = $1 AND s.breeder_id = $2
        `, [saleId, breederId]);

        const breederRes = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);

        if (saleRes.rows.length === 0 || breederRes.rows.length === 0) {
            return res.status(404).send('Données introuvables.');
        }

        const saleData = saleRes.rows[0];
        const animalData = saleRes.rows[0]; 
        const breederData = breederRes.rows[0];

        const pdfBuffer = await pdfService.generateDocument(docType, breederData, saleData, animalData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${docType}_${animalData.name}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        res.status(500).send('Erreur lors de la création du document légal.');
    }
};