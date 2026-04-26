exports.getMatingForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // Les mâles actifs
        const males = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 AND sex = 'M' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        // Les femelles actives
        const females = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('matings/new', { 
            males: males.rows, 
            females: females.rows 
        });
    } catch (error) {
        console.error('Erreur chargement reproducteurs:', error);
        res.status(500).send('Erreur serveur.');
    }
};