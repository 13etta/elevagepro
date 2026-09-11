const { pool } = require('../db');
const registerService = require('../services/register.service');

function normalizeOptional(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function defaultMovementDate(value) {
  return normalizeOptional(value) || new Date().toISOString().slice(0, 10);
}



async function loadDogForBreeder(dogId, breederId, dbClient = pool) {
  const result = await dbClient.query(
    'SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2',
    [dogId, breederId],
  );
  return result.rows[0] || null;
}

exports.getDeleteForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const dogId = req.params.id;
    const dog = await loadDogForBreeder(dogId, breederId);

    if (!dog) {
      return res.status(404).render('errors/404', {
        title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
        user: req.session?.user || null,
      });
    }

    return res.render('dogs/delete', {
      title: 'Sortir un chien du cheptel',
      dog,
      errors: [],
      formData: {
        movement_date: new Date().toISOString().slice(0, 10),
        reason: '',
        notes: '',
      },
    });
  } catch (error) {
    console.error('Erreur formulaire sortie chien:', error);
    return res.status(500).send(`Erreur lors du chargement du formulaire de sortie : ${error.message}`);
  }
};

exports.deleteDog = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  const dogId = req.params.id;
  const reason = normalizeOptional(req.body.reason);
  const notes = normalizeOptional(req.body.notes);
  const movementDate = defaultMovementDate(req.body.movement_date);

  let dog = null;

  try {
    dog = await loadDogForBreeder(dogId, breederId);

    if (!dog) {
      return res.status(404).render('errors/404', {
        title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
        user: req.session?.user || null,
      });
    }

    if (!reason) {
      return res.status(400).render('dogs/delete', {
        title: 'Sortir un chien du cheptel',
        dog,
        errors: ['Le motif de sortie est obligatoire.'],
        formData: { movement_date: movementDate, reason: reason || '', notes: notes || '' },
      });
    }
  } catch (error) {
    console.error('Erreur vérification sortie chien:', error);
    return res.status(500).send(`Erreur lors de la préparation de la sortie : ${error.message}`);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE dogs
        SET status = 'sorti', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND breeder_id = $2
      `,
      [dogId, breederId],
    );

    await client.query(
      `
        INSERT INTO dog_movements (breeder_id, dog_id, movement_type, movement_date, reason, notes)
        VALUES ($1, $2, 'SORTIE', $3, $4, $5)
      `,
      [String(breederId), String(dogId), movementDate, reason, notes],
    );

    await registerService.logMovement({
      breederId,
      animalName: dog.name,
      identification: dog.chip_number || dog.id_scc || dog.lof || null,
      breed: dog.breed || 'Chien adulte',
      animalType: 'adulte',
      type: 'SORTIE',
      reason,
      date: movementDate,
      sourceType: 'dog_exit',
      sourceId: String(dogId),
      notes: notes || `Sortie administrative du chien ${dog.name}.`,
    }, client);

    await client.query('COMMIT');
    return res.redirect('/dogs?sortie=ok');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur sortie chien:', error);
    return res.status(500).render('dogs/delete', {
      title: 'Sortir un chien du cheptel',
      dog,
      errors: [`Erreur lors de la sortie du chien : ${error.message}`],
      formData: { movement_date: movementDate, reason: reason || '', notes: notes || '' },
    });
  } finally {
    client.release();
  }
};
