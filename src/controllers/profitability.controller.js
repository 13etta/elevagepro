const { pool } = require('../db');

const EXPENSE_CATEGORIES = [
  ['alimentation', 'Alimentation'],
  ['veterinaire', 'Vétérinaire'],
  ['vermifuge', 'Vermifuge'],
  ['vaccin', 'Vaccin'],
  ['identification', 'Identification / puce'],
  ['administratif', 'Administratif'],
  ['materiel', 'Matériel'],
  ['deplacement', 'Déplacement'],
  ['saillie', 'Frais de saillie'],
  ['autre', 'Autre'],
];

async function ensureProfitabilityTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      litter_id UUID REFERENCES litters(id) ON DELETE SET NULL,
      dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
      puppy_id UUID REFERENCES puppies(id) ON DELETE SET NULL,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category VARCHAR(80) NOT NULL DEFAULT 'autre',
      label TEXT NOT NULL DEFAULT '',
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP').catch(() => {});
  await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS puppy_id UUID').catch(() => {});
  await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dog_id UUID').catch(() => {});
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2)').catch(() => {});
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS is_sold BOOLEAN DEFAULT FALSE').catch(() => {});
  await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_reservation BOOLEAN DEFAULT FALSE').catch(() => {});
  await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE litters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP').catch(() => {});
  await pool.query('ALTER TABLE litters ADD COLUMN IF NOT EXISTS puppies_count_total INTEGER').catch(() => {});
  await pool.query('ALTER TABLE litters ADD COLUMN IF NOT EXISTS puppies_count INTEGER').catch(() => {});
  await pool.query('ALTER TABLE litters ADD COLUMN IF NOT EXISTS nb_puppies INTEGER').catch(() => {});
  await pool.query(`
    UPDATE litters
    SET puppies_count_total = COALESCE(puppies_count_total, puppies_count, nb_puppies)
    WHERE puppies_count_total IS NULL
  `).catch(() => {});
  await pool.query('CREATE INDEX IF NOT EXISTS idx_expenses_breeder_date ON expenses(breeder_id, expense_date DESC)').catch(() => {});
  await pool.query('CREATE INDEX IF NOT EXISTS idx_expenses_litter ON expenses(breeder_id, litter_id)').catch(() => {});
}

function parseMoney(value) {
  const parsed = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isSoldStatus(value) {
  const status = normalizeStatus(value);
  return ['vendu', 'vendue', 'sold'].includes(status);
}

function isReservedStatus(value) {
  const status = normalizeStatus(value);
  return ['reserve', 'reservee', 'reserver', 'reservation'].includes(status);
}

function computeAverageSalePrice(puppies, sales) {
  const salePrices = sales.map((sale) => parseMoney(sale.price)).filter((price) => price > 0);
  if (salePrices.length) return salePrices.reduce((sum, price) => sum + price, 0) / salePrices.length;

  const listedPrices = puppies.map((puppy) => parseMoney(puppy.sale_price)).filter((price) => price > 0);
  if (listedPrices.length) return listedPrices.reduce((sum, price) => sum + price, 0) / listedPrices.length;

  return 0;
}

function buildLitterLabel(litter) {
  if (!litter) return 'Charges générales de l’élevage';
  const mother = litter.mother_name || 'Mère non renseignée';
  const date = litter.birth_date ? new Date(litter.birth_date).toLocaleDateString('fr-FR') : 'date inconnue';
  return `${mother} — ${date}`;
}

exports.getProfitability = async (req, res) => {
  try {
    await ensureProfitabilityTables();
    const breederId = req.session.user.breeder_id;
    const requestedLitterId = req.query.litter_id || '';

    const littersResult = await pool.query(`
      SELECT
        l.id,
        l.birth_date,
        COALESCE(l.puppies_count_total, l.puppies_count, l.nb_puppies, 0) AS puppies_count_total,
        l.status,
        l.notes,
        COALESCE(mother.name, female.name) AS mother_name,
        COALESCE(mother.breed, female.breed) AS mother_breed
      FROM litters l
      LEFT JOIN dogs mother ON l.mother_id = mother.id
      LEFT JOIN dogs female ON l.female_id = female.id
      WHERE l.breeder_id = $1
      ORDER BY l.birth_date DESC NULLS LAST, l.updated_at DESC NULLS LAST, l.id DESC
    `, [breederId]);

    const selectedLitter = requestedLitterId
      ? littersResult.rows.find((litter) => String(litter.id) === String(requestedLitterId))
      : littersResult.rows[0];
    const selectedId = selectedLitter?.id || null;

    const puppiesResult = selectedId
      ? await pool.query(`
          SELECT p.*
          FROM puppies p
          WHERE p.breeder_id = $1 AND p.litter_id = $2
          ORDER BY p.name ASC NULLS LAST, p.created_at ASC NULLS LAST
        `, [breederId, selectedId])
      : { rows: [] };

    const expensesResult = selectedId
      ? await pool.query(`
          SELECT e.*, p.name AS puppy_name, d.name AS dog_name
          FROM expenses e
          LEFT JOIN puppies p ON e.puppy_id = p.id
          LEFT JOIN dogs d ON e.dog_id = d.id
          WHERE e.breeder_id = $1 AND e.litter_id = $2
          ORDER BY e.expense_date DESC, e.created_at DESC
        `, [breederId, selectedId])
      : await pool.query(`
          SELECT e.*, p.name AS puppy_name, d.name AS dog_name
          FROM expenses e
          LEFT JOIN puppies p ON e.puppy_id = p.id
          LEFT JOIN dogs d ON e.dog_id = d.id
          WHERE e.breeder_id = $1 AND e.litter_id IS NULL
          ORDER BY e.expense_date DESC, e.created_at DESC
        `, [breederId]);

    const salesResult = selectedId
      ? await pool.query(`
          SELECT
            s.*,
            p.name AS puppy_name,
            p.status AS puppy_status,
            p.sale_price AS puppy_sale_price,
            p.color AS puppy_color,
            p.sex AS puppy_sex
          FROM sales s
          JOIN puppies p ON s.puppy_id = p.id
          WHERE s.breeder_id = $1 AND p.litter_id = $2
          ORDER BY s.sale_date DESC, s.created_at DESC NULLS LAST
        `, [breederId, selectedId])
      : { rows: [] };

    const puppies = puppiesResult.rows;
    const sales = salesResult.rows;
    const expenses = expensesResult.rows;

    const puppyStats = {
      total: puppies.length || Number(selectedLitter?.puppies_count_total || 0),
      reserved: puppies.filter((puppy) => isReservedStatus(puppy.status)).length,
      sold: puppies.filter((puppy) => isSoldStatus(puppy.status) || puppy.is_sold).length,
      available: puppies.filter((puppy) => !isSoldStatus(puppy.status) && !isReservedStatus(puppy.status) && !puppy.is_sold).length,
    };

    const totalExpenses = expenses.reduce((sum, row) => sum + parseMoney(row.amount), 0);
    const bookedRevenue = sales.reduce((sum, row) => sum + parseMoney(row.price), 0);
    const depositRevenue = sales.reduce((sum, row) => sum + parseMoney(row.deposit_amount), 0);
    const paidRevenue = sales.reduce((sum, row) => sum + (row.is_reservation ? parseMoney(row.deposit_amount) : parseMoney(row.price)), 0);

    const averageSalePrice = computeAverageSalePrice(puppies, sales);
    const projectedUnsoldRevenue = puppies
      .filter((puppy) => !isSoldStatus(puppy.status) && !puppy.is_sold && !sales.some((sale) => String(sale.puppy_id) === String(puppy.id)))
      .reduce((sum, puppy) => sum + (parseMoney(puppy.sale_price) || averageSalePrice), 0);

    const projectedRevenue = bookedRevenue + projectedUnsoldRevenue;
    const projectedProfit = projectedRevenue - totalExpenses;
    const cashProfit = paidRevenue - totalExpenses;
    const marginRate = projectedRevenue > 0 ? Math.round((projectedProfit / projectedRevenue) * 100) : 0;
    const costPerPuppy = puppyStats.total > 0 ? totalExpenses / puppyStats.total : 0;
    const revenuePerPuppy = puppyStats.total > 0 ? projectedRevenue / puppyStats.total : 0;

    const expenseByCategory = EXPENSE_CATEGORIES.map(([key, label]) => ({
      key,
      label,
      amount: expenses
        .filter((expense) => String(expense.category || 'autre') === key)
        .reduce((sum, expense) => sum + parseMoney(expense.amount), 0),
    })).filter((item) => item.amount > 0);

    res.render('profitability/index', {
      title: 'Rentabilité',
      litters: littersResult.rows,
      selectedLitter,
      selectedLitterLabel: buildLitterLabel(selectedLitter),
      selectedId,
      puppies,
      expenses,
      sales,
      puppyStats,
      totalExpenses,
      bookedRevenue,
      paidRevenue,
      depositRevenue,
      projectedRevenue,
      projectedUnsoldRevenue,
      projectedProfit,
      cashProfit,
      marginRate,
      costPerPuppy,
      revenuePerPuppy,
      averageSalePrice,
      expenseByCategory,
      expenseCategories: EXPENSE_CATEGORIES,
      hasLitter: Boolean(selectedId),
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
    const { expense_date, category, label, amount, notes } = req.body;
    let { litter_id, puppy_id } = req.body;

    litter_id = litter_id && String(litter_id).trim() ? litter_id : null;
    puppy_id = puppy_id && String(puppy_id).trim() ? puppy_id : null;

    if (puppy_id) {
      const puppyCheck = await pool.query('SELECT id, litter_id FROM puppies WHERE id = $1 AND breeder_id = $2', [puppy_id, breederId]);
      if (!puppyCheck.rows.length) return res.status(404).send('Chiot introuvable pour cet élevage.');
      if (!litter_id && puppyCheck.rows[0].litter_id) litter_id = puppyCheck.rows[0].litter_id;
    }

    if (litter_id) {
      const litterCheck = await pool.query('SELECT id FROM litters WHERE id = $1 AND breeder_id = $2', [litter_id, breederId]);
      if (!litterCheck.rows.length) return res.status(404).send('Portée introuvable pour cet élevage.');
    }

    const cleanAmount = parseMoney(amount);
    if (cleanAmount <= 0) return res.status(400).send('Le montant de la charge doit être supérieur à 0.');

    await pool.query(`
      INSERT INTO expenses (breeder_id, litter_id, puppy_id, expense_date, category, label, amount, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [breederId, litter_id, puppy_id, expense_date || new Date().toISOString().split('T')[0], category || 'autre', String(label || '').trim() || 'Charge sans libellé', cleanAmount, notes || null]);

    res.redirect(`/profitability${litter_id ? '?litter_id=' + litter_id : ''}`);
  } catch (error) {
    console.error('Erreur ajout dépense:', error);
    res.status(500).send('Erreur lors de l’enregistrement de la dépense.');
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const expenseId = req.params.id;
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND breeder_id = $2 RETURNING litter_id', [expenseId, breederId]);
    const litterId = result.rows[0]?.litter_id;
    res.redirect(`/profitability${litterId ? '?litter_id=' + litterId : ''}`);
  } catch (error) {
    console.error('Erreur suppression dépense:', error);
    res.status(500).send('Erreur lors de la suppression de la dépense.');
  }
};