const { pool } = require('../db');

exports.update = async (req, res, next) => {
  const { first_name: firstName, last_name: lastName } = req.body;
  if (![firstName, lastName].every(value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120)) {
    return res.status(400).send('Le prénom et le nom sont obligatoires (120 caractères maximum chacun).');
  }
  try {
    const user = req.session.user;
    const result = await pool.query(
      `UPDATE users SET first_name=$1,last_name=$2,full_name=$3
       WHERE id=$4 AND breeder_id=$5 RETURNING first_name,last_name,full_name`,
      [firstName.trim(), lastName.trim(), `${firstName.trim()} ${lastName.trim()}`, user.id, user.breeder_id],
    );
    if (!result.rows.length) return res.status(404).send('Profil introuvable.');
    Object.assign(req.session.user, result.rows[0]);
    return req.session.save(error => error ? next(error) : res.redirect('/settings?tab=application#mon-profil'));
  } catch (error) { return next(error); }
};

