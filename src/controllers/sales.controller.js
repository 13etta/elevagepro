const { pool } = require('../db');

exports.listSales = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // Récupération de l'historique des ventes avec le nom du chiot associé
        const sales = await pool.query(`
            SELECT s.*, p.name AS puppy_name
            FROM sales s
            JOIN puppies p ON s.puppy_id = p.id
            WHERE s.breeder_id = $1
            ORDER BY s.sale_date DESC
        `, [breederId]);

        // On calcule le chiffre d'affaires total pour l'affichage
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

exports.createSale = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { puppy_id, buyer_name, sale_date, price, payment_method, notes } = req.body;

        await client.query('BEGIN');

        // 1. Enregistrement de la vente
        await client.query(`
            INSERT INTO sales (breeder_id, puppy_id, buyer_name, sale_date, price, payment_method, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [breederId, puppy_id, buyer_name, sale_date, price, payment_method, notes]);

        // 2. Mise à jour automatique du statut du chiot
        await client.query(`
            UPDATE puppies SET status = 'vendu' 
            
            WHERE id = $1 AND breeder_id = $2
        `, [puppy_id, breederId]);
        
        // Écriture automatique dans le registre légal des sorties
await client.query(`
    INSERT INTO movements (breeder_id, animal_type, animal_name, chip_number, movement_type, reason, movement_date, provenance_destination)
    SELECT $1, 'chiot', name, chip_number, 'sortie', 'vente', $2, $3
    FROM puppies WHERE id = $4
`, [breederId, sale_date, buyer_name, puppy_id]);

        await client.query('COMMIT');
        res.redirect('/sales');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur enregistrement vente:', error);
        res.status(500).send('Erreur lors de la finalisation de la vente.');
    } finally {
        client.release();
    }
};
module.exports = {
    getSales,
    createSale,
    downloadCessionPdf 
};