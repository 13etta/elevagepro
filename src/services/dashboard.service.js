const db = require('../db');

async function getDashboardData(breederId) {
  const [dogs, puppies, litters, pregnancies, reminders, soins, sales] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM dogs WHERE breeder_id = $1 AND status = 'active'`, [breederId]),
    db.query(`SELECT COUNT(*)::int AS total FROM puppies WHERE breeder_id = $1 AND status = 'available'`, [breederId]),
    db.query(`SELECT COUNT(*)::int AS total FROM litters WHERE breeder_id = $1 AND status = 'active'`, [breederId]),
    db.query(`SELECT COUNT(*)::int AS total FROM pregnancies WHERE breeder_id = $1 AND status = 'ongoing'`, [breederId]),
    db.query(
      `SELECT r.id, r.label, r.due_date, d.name AS dog_name
       FROM reminders r
       LEFT JOIN dogs d ON d.id = r.dog_id AND d.breeder_id = r.breeder_id
       WHERE r.breeder_id = $1
       ORDER BY (r.due_date < CURRENT_DATE) DESC, r.due_date ASC
       LIMIT 8`,
      [breederId],
    ),
    db.query(
      `SELECT s.id, s.label, s.type, s.event_date, d.name AS dog_name
       FROM soins s
       LEFT JOIN dogs d ON d.id = s.dog_id AND d.breeder_id = s.breeder_id
       WHERE s.breeder_id = $1
       ORDER BY s.event_date DESC
       LIMIT 8`,
      [breederId],
    ),
    db.query(
      `SELECT id, puppy_id, sale_date, total_price, buyer_lastname, buyer_firstname
       FROM sales
       WHERE breeder_id = $1
       ORDER BY sale_date DESC
       LIMIT 8`,
      [breederId],
    ),
  ]);

  return {
    kpis: {
      activeDogs: dogs.rows[0].total,
      availablePuppies: puppies.rows[0].total,
      activeLitters: litters.rows[0].total,
      ongoingPregnancies: pregnancies.rows[0].total,
    },
    reminders: reminders.rows,
    soins: soins.rows,
    sales: sales.rows,
  };
}

module.exports = {
  getDashboardData,
};
