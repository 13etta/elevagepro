const bcrypt = require('bcrypt');
const { pool } = require('./src/db');

async function createAdmin() {
    const client = await pool.connect();

    try {
        console.log('Démarrage de la création du compte administrateur...');
        await client.query('BEGIN'); // Début de la transaction

        // 1. Création de l'entité Élevage
        const breederRes = await client.query(`
            INSERT INTO breeder (company_name, affix_name) 
            VALUES ('Élevage Test', 'Du Domaine de Test') 
            RETURNING id
        `);
        const breederId = breederRes.rows[0].id;

        // 2. Préparation du mot de passe (Hashage sécurisé)
        const email = 'contact@elevage.pro';
        const passwordPlaintText = 'AdminPro2026!';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(passwordPlaintText, salt);

        // 3. Création de l'utilisateur rattaché
        await client.query(`
            INSERT INTO users (breeder_id, email, password_hash, full_name, role, is_active) 
            VALUES ($1, $2, $3, $4, 'admin', true)
        `, [breederId, email, passwordHash, 'Admin Principal']);

        await client.query('COMMIT'); // Validation des écritures
        
        console.log('--- COMPTE CRÉÉ AVEC SUCCÈS ---');
        console.log(`Email : ${email}`);
        console.log(`Mot de passe : ${passwordPlaintText}`);
        console.log('-------------------------------');

    } catch (error) {
        await client.query('ROLLBACK'); // Annulation en cas d'erreur
        console.error('Erreur lors de la création :', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

createAdmin();