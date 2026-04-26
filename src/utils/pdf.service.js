const pdfService = require('../utils/pdf.service');

// ... tes autres fonctions de ventes ...

exports.downloadCessionPdf = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const saleId = req.params.id;

        // 1. Récupération croisée des données (Vente + Chiot + Élevage)
        const saleRes = await pool.query(`
            SELECT s.*, p.name, p.sex, p.chip_number, p.color 
            FROM sales s
            JOIN puppies p ON s.puppy_id = p.id
            WHERE s.id = $1 AND s.breeder_id = $2
        `, [saleId, breederId]);

        if (saleRes.rows.length === 0) {
            return res.status(404).send('Vente introuvable.');
        }

        const breederRes = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);

        const saleData = saleRes.rows[0];
        const puppyData = saleRes.rows[0]; // Les données du chiot ont été jointes dans la même ligne
        const breederData = breederRes.rows[0];

        // 2. Génération du buffer PDF
        const pdfBuffer = await pdfService.generateCessionDocument(breederData, saleData, puppyData);

        // 3. Configuration des en-têtes HTTP pour forcer le téléchargement du PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Attestation_Cession_${puppyData.name || 'Chiot'}.pdf`);
        
        // 4. Envoi du fichier
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erreur génération PDF de cession:', error);
        res.status(500).send('Erreur lors de la création du document légal.');
    }
};