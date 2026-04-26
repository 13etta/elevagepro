exports.getHeatForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // On sélectionne uniquement les femelles (sex = 'F') qui sont actives
        const females = await pool.query(`
            SELECT id, name, chip_number 
            FROM dogs 
            WHERE breeder_id = $1 
            AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('heats/new', { females: females.rows });
    } catch (error) {
        console.error('Erreur chargement formulaire chaleurs:', error);
        res.status(500).send('Erreur lors de l\'ouverture du formulaire.');
    }
};