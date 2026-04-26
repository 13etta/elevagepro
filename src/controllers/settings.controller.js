const { pool } = require('../db');

exports.getSettings = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // Récupération des informations actuelles de l'élevage
        const result = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);
        
        res.render('settings/index', {
            breeder: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur lecture paramètres:', error);
        res.status(500).send('Erreur lors du chargement des paramètres.');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { company_name, affix_name, siret, address } = req.body;

        // Mise à jour des informations textuelles
        await pool.query(`
            UPDATE breeder 
            SET company_name = $1, 
                affix_name = $2, 
                siret = $3, 
                address = $4, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
        `, [company_name, affix_name, siret, address, breederId]);

        res.redirect('/settings');
    } catch (error) {
        console.error('Erreur mise à jour paramètres:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};
const { pool } = require('../db');
const supabase = require('../utils/supabase'); // À ajouter en haut

// ... (tes fonctions getSettings et updateSettings existantes)

exports.uploadLogo = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const file = req.file;

        if (!file) {
            return res.status(400).send('Aucun fichier détecté.');
        }

        // 1. Création d'un nom de fichier unique et sécurisé
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${breederId}-${Date.now()}.${fileExtension}`;

        // 2. Envoi du fichier depuis la mémoire vive vers Supabase Storage
        const { data, error } = await supabase.storage
            .from('logos')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) throw error;

        // 3. Récupération du lien public de l'image
        const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(fileName);

        const logoUrl = publicUrlData.publicUrl;

        // 4. Enregistrement du lien dans la fiche de l'élevage
        await pool.query('UPDATE breeder SET logo_url = $1 WHERE id = $2', [logoUrl, breederId]);

        res.redirect('/settings');
    } catch (error) {
        console.error('Erreur upload logo:', error);
        res.status(500).send('Erreur lors de la sauvegarde du logo.');
    }
};