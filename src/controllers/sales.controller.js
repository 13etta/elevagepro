const { pool } = require('../db');
const pdfService = require('../utils/pdf.service');

/**
 * Affiche la liste de toutes les ventes et le chiffre d'affaires global
 */
exports.listSales = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        const sales = await pool.query(`
            SELECT s.*, p.name AS puppy_name
            FROM sales s
            JOIN puppies p ON s.puppy_id = p.id
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

/**
 * Affiche le formulaire de création d'une vente en récupérant les chiots disponibles
 */
exports.getSaleForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        const puppies = await pool.query(`
            SELECT id, name, chip_number, sale_price 
            FROM puppies 
            WHERE breeder_id = $1 AND (status = 'disponible' OR status = 'Disponible')
            ORDER BY name ASC
        `, [breederId]);

        res.render('sales/new', { puppies: puppies.rows });
    } catch (error) {
        console.error('Erreur chargement formulaire vente:', error);
        res.status(500).send('Erreur lors de l\'ouverture du formulaire.');
    }
};

/**
 * Enregistre une vente (Transaction : Vente + Statut Chiot + Registre des mouvements)
 */
exports.createSale = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { puppy_id, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount } = req.body;

        const isResa = is_reservation === 'true';
        const deposit = deposit_amount ? parseFloat(deposit_amount) : 0;
        const targetStatus = isResa ? 'réservé' : 'vendu';

        await client.query('BEGIN');

        // 1. Enregistrement avec les nouvelles colonnes
        await client.query(`
            INSERT INTO sales (breeder_id, puppy_id, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [breederId, puppy_id, buyer_name, sale_date, price, payment_method, notes, isResa, deposit]);

        // 2. Mise à jour dynamique du statut du chiot (réservé OU vendu)
        await client.query(`
            UPDATE puppies SET status = $1 
            WHERE id = $2 AND breeder_id = $3
        `, [targetStatus, puppy_id, breederId]);
        
        // 3. Inscription au registre légal UNIQUEMENT si c'est un départ définitif
        if (!isResa) {
            await client.query(`
                INSERT INTO movements (
                    breeder_id, animal_type, animal_name, chip_number, 
                    movement_type, reason, movement_date, provenance_destination
                )
                SELECT $1, 'chiot', name, chip_number, 'sortie', 'vente', $2, $3
                FROM puppies WHERE id = $4
            `, [breederId, sale_date, buyer_name, puppy_id]);
        }

        await client.query('COMMIT');
        res.redirect('/sales');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur enregistrement vente/réservation:', error);
        res.status(500).send('Erreur lors de la finalisation de la transaction.');
    } finally {
        client.release();
    }
};

/**
 * Génère et envoie le document PDF demandé (cession, facture, etc.)
 */
exports.downloadDocument = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const saleId = req.params.id;
        const docType = req.params.type;

        // Récupération des données de la vente et du chiot
        const saleRes = await pool.query(`
            SELECT s.*, p.name, p.sex, p.chip_number, p.color 
            FROM sales s
            JOIN puppies p ON s.puppy_id = p.id
            WHERE s.id = $1 AND s.breeder_id = $2
        `, [saleId, breederId]);

        // Récupération des informations de l'éleveur (pour le logo et l'en-tête)
        const breederRes = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);

        if (saleRes.rows.length === 0 || breederRes.rows.length === 0) {
            return res.status(404).send('Données de vente ou d\'élevage introuvables.');
        }

        const saleData = saleRes.rows[0];
        const puppyData = saleRes.rows[0]; 
        const breederData = breederRes.rows[0];

        // Génération du flux PDF via le service
        const pdfBuffer = await pdfService.generateDocument(docType, breederData, saleData, puppyData);

        // Configuration de la réponse HTTP
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${docType}_${puppyData.name || 'document'}.pdf`);
        
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Erreur génération documentaire PDF:', error);
        res.status(500).send('Erreur lors de la création du document légal.');
    }
};