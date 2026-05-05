const { pool } = require('../db');

/**
 * Enregistre un mouvement (Entrée ou Sortie) dans le registre légal.
 * 
 * @param {Object} data 
 * @param {String} data.breederId - L'ID de l'éleveur
 * @param {String} data.animalName - Le nom de l'animal
 * @param {String} data.identification - N° de puce / tatouage
 * @param {String} data.breed - La race
 * @param {String} data.type - 'ENTREE' ou 'SORTIE'
 * @param {String} data.reason - 'Naissance', 'Achat', 'Vente', 'Décès', etc.
 * @param {String|Date} data.date - La date de l'événement
 * @param {String} data.thirdParty - Les coordonnées de l'acheteur/vendeur (Optionnel)
 */
exports.logMovement = async (data, dbClient = pool) => {
    try {
        // On utilise dbClient (qui peut être ton "client" de transaction, ou le pool par défaut)
        await dbClient.query(
            `INSERT INTO animal_movements 
            (breeder_id, animal_name, identification, breed, movement_type, movement_reason, movement_date, third_party_info) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                data.breederId,
                data.animalName,
                data.identification || null,
                data.breed || null,
                data.type,
                data.reason,
                data.date || new Date(),
                data.thirdParty || null
            ]
        );
    } catch (error) {
        console.error('Erreur critique registre légal:', error);
        throw error; // On propage l'erreur pour que ton ROLLBACK s'active en cas de pépin
    }
};