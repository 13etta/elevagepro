const { pool } = require('../db');

async function ensureProfitabilityTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      litter_id UUID REFERENCES litters(id) ON DELETE SET NULL,
      dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
      puppy_id UUID REFERENCES puppies(id) ON DELETE SET NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(80) NOT NULL,
      label TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_expenses_breeder_date ON expenses(breeder_id, expense_date DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_expenses_litter ON expenses(breeder_id, litter_id)');
}

exports.getProfitability = async (req, res) => {
  try {
    await ensureProfitabilityTables();
    const breederId = req.session.user.breeder_id;
    const litterId = req.query.litter_id || '';

    const litters = await pool.query(`
      SELECT l.id, l.birth_date, d.name AS mother_name
      FROM litters l
      LEFT JOIN dogs d ON l.mother_id = d.id
      WHERE l.breeder_id = $1
      ORDER BY l.birth_date DESC
    `, [breederId]);

    const selectedLitter = litterId ? litters.rows.find((l) => String(l.id) === String(litterId)) : litters.rows[0];
    const selectedId = selectedLitter?.id || null;

    const expenses = selectedId
      ? await pool.query(`
          SELECT * FROM expenses
          WHERE breeder_id = $1 AND litter_id = $2
          ORDER BY expense_date DESC
        `, [breederId, selectedId])
      : { rows: [] };

    const sales = selectedId
      ? await pool.query(`
          SELECT s.*, p.name AS puppy_name
          FROM sales s
          JOIN puppies p ON s.puppy_id = p.id
          WHERE s.breeder_id = $1 AND p.litter_id = $2
          ORDER BY s.sale_date DESC
        `, [breederId, selectedId])
      : { rows: [] };

    const puppyStats = selectedId
      ? await pool.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE lower(COALESCE(status,'')) IN ('vendu','vendue'))::int AS sold,
            COUNT(*) FILTER (WHERE lower(COALESCE(status,'')) IN ('réservé','reserve','reservé','réserve'))::int AS reserved
          FROM puppies
          WHERE breeder_id = $1 AND litter_id = $2
        `, [breederId, selectedId])
      : { rows: [{ total: 0, sold: 0, reserved: 0 }] };

    const totalExpenses = expenses.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const bookedRevenue = sales.rows.reduce((sum, row) => sum + Number(row.price || 0), 0);
    const paidRevenue = sales.rows.reduce((sum, row) => row.is_reservation ? sum + Number(row.deposit_amount || 0) : sum + Number(row.price || 0), 0);
    const projectedProfit = bookedRevenue - totalExpenses;
    const cashProfit = paidRevenue - totalExpenses;

    res.render('profitability/index', {
      title: 'Rentabilité',
      litters: litters.rows,
      selectedLitter,
      expenses: expenses.rows,
      sales: sales.rows,
      puppyStats: puppyStats.rows[0],
      totalExpenses,
      bookedRevenue,
      paidRevenue,
      projectedProfit,
      cashProfit,
    });
  } catch (error) {
    console.error('Erreur rentabilité:', error);
    res.status(500).send('Erreur lors du chargement de la rentabilité.');
  }
};

exports.addExpense = async (req, res) => {
  try {
    await ensureProfitabilityTables();
    const breederId = req.session.user.breeder_id;
    const { litter_id, expense_date, category, label, amount, notes } = req.body;

    await pool.query(`
      INSERT INTO expenses (breeder_id, litter_id, expense_date, category, label, amount, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [breederId, litter_id || null, expense_date, category, label, Number(amount || 0), notes || null]);

    res.redirect(`/profitability${litter_id ? '?litter_id=' + litter_id : ''}`);
  } catch (error) {
    console.error('Erreur ajout dépense:', error);
    res.status(500).send('Erreur lors de l’enregistrement de la dépense.');
  }
};
