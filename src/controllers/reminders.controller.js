const { pool } = require('../db');

async function getDogsForBreeder(breederId) {
  const result = await pool.query(
    `
      SELECT id, name, status
      FROM dogs
      WHERE breeder_id = $1
      ORDER BY name ASC
    `,
    [breederId],
  );

  return result.rows;
}

exports.listReminders = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

    const remindersRes = await pool.query(
      `
        SELECT r.*, d.name AS dog_name
        FROM reminders r
        LEFT JOIN dogs d ON r.dog_id = d.id
        WHERE r.breeder_id = $1
        ORDER BY r.is_completed ASC, r.due_date ASC, r.created_at DESC
      `,
      [breederId],
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reminders = remindersRes.rows;
    const lateReminders = reminders.filter((r) => !r.is_completed && r.due_date && new Date(r.due_date) < today);
    const upcomingReminders = reminders.filter((r) => !r.is_completed && (!r.due_date || new Date(r.due_date) >= today));
    const completedReminders = reminders.filter((r) => r.is_completed);

    res.render('reminders/index', {
      title: 'Rappels',
      lateReminders,
      upcomingReminders,
      completedReminders,
    });
  } catch (error) {
    console.error('Erreur liste rappels:', error);
    res.status(500).send('Erreur lors du chargement des rappels.');
  }
};

exports.getReminderForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const reminderId = req.params.id;
    const dogs = await getDogsForBreeder(breederId);

    let reminder = {
      type: 'general',
      title: '',
      due_date: '',
      dog_id: '',
    };

    if (reminderId) {
      const result = await pool.query(
        'SELECT * FROM reminders WHERE id = $1 AND breeder_id = $2',
        [reminderId, breederId],
      );

      if (!result.rows.length) {
        return res.status(404).send('Rappel introuvable.');
      }

      reminder = result.rows[0];
    }

    res.render('reminders/form', {
      title: reminderId ? 'Modifier un rappel' : 'Ajouter un rappel',
      reminder,
      dogs,
    });
  } catch (error) {
    console.error('Erreur formulaire rappel:', error);
    res.status(500).send('Erreur lors du chargement du formulaire rappel.');
  }
};

exports.saveReminder = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const reminderId = req.params.id;
    const { title, type, due_date, dog_id } = req.body;

    if (reminderId) {
      await pool.query(
        `
          UPDATE reminders
          SET title = $1,
              type = $2,
              due_date = $3,
              dog_id = $4
          WHERE id = $5 AND breeder_id = $6
        `,
        [title, type || 'general', due_date || null, dog_id || null, reminderId, breederId],
      );
    } else {
      await pool.query(
        `
          INSERT INTO reminders (breeder_id, title, type, due_date, dog_id, is_completed)
          VALUES ($1, $2, $3, $4, $5, FALSE)
        `,
        [breederId, title, type || 'general', due_date || null, dog_id || null],
      );
    }

    res.redirect('/reminders');
  } catch (error) {
    console.error('Erreur sauvegarde rappel:', error);
    res.status(500).send('Erreur lors de la sauvegarde du rappel.');
  }
};

exports.completeReminder = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const reminderId = req.params.id;

    await pool.query(
      'UPDATE reminders SET is_completed = TRUE WHERE id = $1 AND breeder_id = $2',
      [reminderId, breederId],
    );

    res.redirect('/reminders');
  } catch (error) {
    console.error('Erreur validation rappel:', error);
    res.status(500).send('Erreur lors de la validation du rappel.');
  }
};

exports.reopenReminder = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const reminderId = req.params.id;

    await pool.query(
      'UPDATE reminders SET is_completed = FALSE WHERE id = $1 AND breeder_id = $2',
      [reminderId, breederId],
    );

    res.redirect('/reminders');
  } catch (error) {
    console.error('Erreur réouverture rappel:', error);
    res.status(500).send('Erreur lors de la réouverture du rappel.');
  }
};

exports.deleteReminder = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const reminderId = req.params.id;

    await pool.query('DELETE FROM reminders WHERE id = $1 AND breeder_id = $2', [reminderId, breederId]);

    res.redirect('/reminders');
  } catch (error) {
    console.error('Erreur suppression rappel:', error);
    res.status(500).send('Erreur lors de la suppression du rappel.');
  }
};
