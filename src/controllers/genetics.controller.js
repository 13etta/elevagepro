const { pool } = require('../db');

// Affiche l'interface de sélection
exports.getSimulator = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // Correction de la casse : 'Actif' au lieu de 'actif'
        const males = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' AND status = 'Actif' ORDER BY name ASC`, [breederId]);
        const females = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status = 'Actif' ORDER BY name ASC`, [breederId]);

        res.render('genetics/simulator', {
            males: males.rows,
            females: females.rows,
            result: null
        });
    } catch (error) {
        console.error('Erreur simulateur génétique:', error);
        res.status(500).send('Erreur du module génétique.');
    }
};

// Requête récursive pour obtenir la généalogie d'un chien (Wright's Algorithm)
const getPedigree = async (dogId, maxGenerations = 5) => {
    const query = `
        WITH RECURSIVE tree AS (
            SELECT id, name, father_id, mother_id, 0 AS generation
            FROM dogs WHERE id = $1
            UNION ALL
            SELECT d.id, d.name, d.father_id, d.mother_id, t.generation + 1
            FROM dogs d
            JOIN tree t ON d.id = t.father_id OR d.id = t.mother_id
            WHERE t.generation < $2
        )
        SELECT * FROM tree WHERE generation > 0;
    `;
    const res = await pool.query(query, [dogId, maxGenerations]);
    return res.rows;
};

// Lance la simulation et calcule le COI
exports.runSimulation = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { sire_id, dam_id } = req.body;

        if (!sire_id || !dam_id) {
            return res.redirect('/genetics/simulator');
        }

        const sireRes = await pool.query('SELECT name FROM dogs WHERE id = $1', [sire_id]);
        const damRes = await pool.query('SELECT name FROM dogs WHERE id = $1', [dam_id]);

        const sirePedigree = await getPedigree(sire_id, 5);
        const damPedigree = await getPedigree(dam_id, 5);

        let coi = 0;
        const commonAncestors = [];

        sirePedigree.forEach(sireAncestor => {
            damPedigree.forEach(damAncestor => {
                if (sireAncestor.id === damAncestor.id) {
                    const n1 = sireAncestor.generation;
                    const n2 = damAncestor.generation;
                    const contribution = Math.pow(0.5, n1 + n2 + 1);
                    
                    coi += contribution;

                    commonAncestors.push({
                        name: sireAncestor.name,
                        genSire: n1,
                        genDam: n2,
                        contribution: (contribution * 100).toFixed(4)
                    });
                }
            });
        });

        const males = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' AND status = 'Actif'`, [breederId]);
        const females = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status = 'Actif'`, [breederId]);

        res.render('genetics/simulator', {
            males: males.rows,
            females: females.rows,
            result: {
                sireName: sireRes.rows[0].name,
                damName: damRes.rows[0].name,
                coiTotal: (coi * 100).toFixed(2),
                commonAncestors: commonAncestors
            }
        });

    } catch (error) {
        console.error('Erreur calcul COI:', error);
        res.status(500).send('Erreur lors de la simulation génétique.');
    }
};