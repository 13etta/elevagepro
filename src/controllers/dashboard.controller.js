const { pool } = require('../db');

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildMonthLabel(monthKey) {
  if (!monthKey) return '-';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit',
  });
}

function resolveBoxCapacity(settings) {
  const configured = Number.parseInt(settings?.kennelBoxCapacity, 10);
  if (Number.isFinite(configured) && configured > 0) return configured;

  const envValue = Number.parseInt(process.env.KENNEL_BOX_CAPACITY || process.env.BOX_CAPACITY || '12', 10);
  return Number.isFinite(envValue) && envValue > 0 ? envValue : 12;
}

function isMissingSchemaError(error) {
  return ['42P01', '42703'].includes(error?.code);
}

function isTimeoutOrLockError(error) {
  return ['57014', '55P03'].includes(error?.code);
}

async function safeQuery(sql, params, fallbackRows = []) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Dashboard degradé: colonne ou table absente:', error.message);
      return { rows: fallbackRows };
    }

    if (isTimeoutOrLockError(error)) {
      console.warn('Dashboard degradé: requête interrompue ou verrouillée:', error.message);
      return { rows: fallbackRows };
    }

    throw error;
  }
}

async function ensureDashboardSchema() {
  // Ne jamais exécuter de DDL depuis le chargement du dashboard.
  // Les ALTER TABLE doivent être joués via `npm run db:migrate`.
  // Ancienne cause de panne Render : statement timeout sur ALTER TABLE à l'ouverture du dashboard.
  return true;
}

exports.getDashboard = async (req, res) => {
  try {
    await ensureDashboardSchema();
    const breederId = req.session.user.breeder_id;

    const countFallback = [{ count: 0 }];
    const breederSettingsRes = await safeQuery('SELECT website_settings FROM breeder WHERE id = $1', [breederId], []);
    const breederSettings = breederSettingsRes.rows[0]?.website_settings || {};

    const activeDogs = await safeQuery(
      `
        SELECT count(*)
        FROM dogs
        WHERE breeder_id = $1
          AND LOWER(TRIM(COALESCE(status, 'actif'))) <> 'sorti'
      `,
      [breederId],
      countFallback,
    );

    const availablePuppies = await safeQuery(
      `
        SELECT count(*)
        FROM puppies
        WHERE breeder_id = $1
          AND COALESCE(is_sold, false) = false
          AND COALESCE(lower(status), 'disponible') NOT IN ('vendu', 'vendue', 'sold')
      `,
      [breederId],
      countFallback,
    );

    const reservedPuppies = await safeQuery(
      `
        SELECT count(*)
        FROM puppies
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') IN ('réservé', 'reserve', 'reserved', 'option', 'réservation')
      `,
      [breederId],
      countFallback,
    );

    const activeLitters = await safeQuery(
      `
        SELECT count(*)
        FROM litters
        WHERE breeder_id = $1
          AND COALESCE(lower(status), 'active') IN ('active', 'sevrage', 'en cours', 'en_cours')
      `,
      [breederId],
      countFallback,
    );

    const ongoingPregnancies = await safeQuery(
      `
        SELECT count(*)
        FROM pregnancies
        WHERE breeder_id = $1
          AND COALESCE(lower(result), 'en cours') IN ('en cours', 'en_cours', 'active', 'confirmée', 'confirmee')
      `,
      [breederId],
      countFallback,
    );

    const incompleteSales = await safeQuery(
      `
        SELECT count(*)
        FROM sales
        WHERE breeder_id = $1
          AND COALESCE(is_reservation, FALSE) = TRUE
      `,
      [breederId],
      countFallback,
    );

    const puppiesWithoutChip = await safeQuery(
      `
        SELECT count(*)
        FROM puppies
        WHERE breeder_id = $1
          AND COALESCE(chip_number, '') = ''
          AND COALESCE(lower(status), '') NOT IN ('vendu', 'vendue', 'sold')
      `,
      [breederId],
      countFallback,
    );

    const monthlySales = await safeQuery(
      `
        SELECT
          to_char(months.month_start, 'YYYY-MM') AS month_key,
          COALESCE(SUM(s.price), 0)::numeric AS total
        FROM generate_series(
          date_trunc('month', CURRENT_DATE)::timestamp - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE)::timestamp,
          INTERVAL '1 month'
        ) AS months(month_start)
        LEFT JOIN sales s
          ON s.breeder_id = $1
         AND date_trunc('month', COALESCE(s.sale_date, s.created_at::date)::timestamp) = months.month_start
        GROUP BY months.month_start
        ORDER BY months.month_start ASC
      `,
      [breederId],
      [],
    );

    const upcomingRemindersCount = await safeQuery(
      `
        SELECT count(*)
        FROM reminders
        WHERE breeder_id = $1
          AND COALESCE(is_completed, FALSE) = FALSE
          AND due_date <= CURRENT_DATE + INTERVAL '7 days'
      `,
      [breederId],
      countFallback,
    );

    const activeDogsCount = toNumber(activeDogs.rows[0]?.count);
    const boxCapacity = Math.max(resolveBoxCapacity(breederSettings), 1);
    const boxOccupancyRate = Math.min(100, Math.round((activeDogsCount / boxCapacity) * 100));

    const salesSeries = monthlySales.rows.map((row) => ({
      month: row.month_key,
      label: buildMonthLabel(row.month_key),
      total: toNumber(row.total),
    }));

    const currentMonthSales = salesSeries.length ? salesSeries[salesSeries.length - 1].total : 0;
    const maxMonthlySales = Math.max(...salesSeries.map((row) => row.total), 1);

    const kpis = {
      activeDogs: activeDogsCount,
      availablePuppies: toNumber(availablePuppies.rows[0]?.count),
      reservedPuppies: toNumber(reservedPuppies.rows[0]?.count),
      activeLitters: toNumber(activeLitters.rows[0]?.count),
      ongoingPregnancies: toNumber(ongoingPregnancies.rows[0]?.count),
      incompleteSales: toNumber(incompleteSales.rows[0]?.count),
      puppiesWithoutChip: toNumber(puppiesWithoutChip.rows[0]?.count),
      boxCapacity,
      boxOccupancyRate,
      currentMonthSales,
      upcomingReminders: toNumber(upcomingRemindersCount.rows[0]?.count),
    };

    const remindersRes = await safeQuery(
      `
        SELECT
          r.due_date,
          COALESCE(r.title, 'Rappel') AS label,
          COALESCE(d.name, p.name, lm.name) AS dog_name,
          CASE
            WHEN r.puppy_id IS NOT NULL THEN 'Chiot'
            WHEN r.litter_id IS NOT NULL THEN 'Portée'
            WHEN r.dog_id IS NOT NULL THEN 'Chien'
            ELSE 'Général'
          END AS scope
        FROM reminders r
        LEFT JOIN dogs d ON r.dog_id = d.id
        LEFT JOIN puppies p ON r.puppy_id = p.id
        LEFT JOIN litters l ON r.litter_id = l.id
        LEFT JOIN dogs lm ON l.mother_id = lm.id
        WHERE r.breeder_id = $1
          AND COALESCE(r.is_completed, FALSE) = FALSE
        ORDER BY r.due_date ASC
        LIMIT 8
      `,
      [breederId],
      [],
    );

    const calendarEventsRes = await safeQuery(
      `
        SELECT
          e.id,
          e.title,
          e.category,
          e.event_date,
          e.start_time,
          e.all_day,
          e.location,
          e.registration_deadline,
          e.status,
          COALESCE(dogs.names, '') AS dog_names
        FROM calendar_events e
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(d.name, ', ' ORDER BY d.name) AS names
          FROM calendar_event_dogs ced
          JOIN dogs d
            ON d.id = ced.dog_id
           AND d.breeder_id = ced.breeder_id
          WHERE ced.event_id = e.id
            AND ced.breeder_id = e.breeder_id
        ) dogs ON TRUE
        WHERE e.breeder_id = $1
          AND e.event_date >= CURRENT_DATE
          AND e.status <> 'annule'
        ORDER BY e.event_date ASC, e.start_time ASC NULLS FIRST
        LIMIT 5
      `,
      [breederId],
      [],
    );

    const calendarDeadlinesRes = await safeQuery(
      `
        SELECT count(*)::int AS count
        FROM calendar_events
        WHERE breeder_id = $1
          AND registration_deadline >= CURRENT_DATE
          AND registration_deadline <= CURRENT_DATE + INTERVAL '7 days'
          AND status IN ('prevu', 'inscrit')
      `,
      [breederId],
      countFallback,
    );

    const soinsRes = await safeQuery(
      `
        SELECT s.event_date, s.type, s.label, COALESCE(d.name, p.name) AS dog_name
        FROM soins s
        LEFT JOIN dogs d ON s.dog_id = d.id
        LEFT JOIN puppies p ON s.puppy_id = p.id
        WHERE s.breeder_id = $1
        ORDER BY s.event_date DESC
        LIMIT 5
      `,
      [breederId],
      [],
    );

    const salesRes = await safeQuery(
      `
        SELECT
          sale_date,
          buyer_name AS buyer_firstname,
          price AS total_price,
          is_reservation,
          deposit_amount
        FROM sales
        WHERE breeder_id = $1
        ORDER BY COALESCE(sale_date, created_at::date) DESC
        LIMIT 5
      `,
      [breederId],
      [],
    );

    const lateReminders = remindersRes.rows.filter((r) => r.due_date && new Date(r.due_date) < new Date());

    const salesToFinalize = await safeQuery(
      `
        SELECT
          s.id,
          s.buyer_name,
          s.price,
          s.deposit_amount,
          COALESCE(p.name, d.name) AS animal_name
        FROM sales s
        LEFT JOIN puppies p ON s.puppy_id = p.id
        LEFT JOIN dogs d ON s.dog_id = d.id
        WHERE s.breeder_id = $1
          AND COALESCE(s.is_reservation, FALSE) = TRUE
        ORDER BY COALESCE(s.sale_date, s.created_at::date) ASC
        LIMIT 5
      `,
      [breederId],
      [],
    );

    const littersWithoutPuppies = await safeQuery(
      `
        SELECT l.id, l.birth_date, d.name AS mother_name
        FROM litters l
        LEFT JOIN dogs d ON l.mother_id = d.id
        LEFT JOIN puppies p ON p.litter_id = l.id
        WHERE l.breeder_id = $1
          AND COALESCE(lower(l.status), 'active') IN ('active', 'sevrage', 'en cours', 'en_cours')
        GROUP BY l.id, d.name
        HAVING count(p.id) = 0
        ORDER BY l.birth_date DESC
        LIMIT 5
      `,
      [breederId],
      [],
    );

    const alerts = [];
    if (lateReminders.length) alerts.push({ level: 'danger', title: `${lateReminders.length} rappel(s) en retard`, href: '/reminders' });
    if (toNumber(calendarDeadlinesRes.rows[0]?.count)) {
      alerts.push({
        level: 'warning',
        title: `${toNumber(calendarDeadlinesRes.rows[0]?.count)} engagement(s) à finaliser sous 7 jours`,
        href: '/calendar',
      });
    }
    if (salesToFinalize.rows.length) alerts.push({ level: 'warning', title: `${salesToFinalize.rows.length} réservation(s) à finaliser`, href: '/sales' });
    if (littersWithoutPuppies.rows.length) alerts.push({ level: 'warning', title: `${littersWithoutPuppies.rows.length} portée(s) sans chiots enregistrés`, href: '/litters' });
    if (Number(kpis.puppiesWithoutChip) > 0) alerts.push({ level: 'info', title: `${kpis.puppiesWithoutChip} chiot(s) sans identification`, href: '/puppies' });
    if (kpis.boxOccupancyRate >= 90) alerts.push({ level: 'warning', title: `Occupation des box à ${kpis.boxOccupancyRate}%`, href: '/settings?tab=application' });

    const formatDate = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('fr-FR');
    };

    const formatCurrency = (value) => new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(toNumber(value));

    res.render('dashboard', {
      kpis,
      alerts,
      reminders: remindersRes.rows,
      calendarEvents: calendarEventsRes.rows,
      soins: soinsRes.rows,
      sales: salesRes.rows,
      salesToFinalize: salesToFinalize.rows,
      littersWithoutPuppies: littersWithoutPuppies.rows,
      salesSeries,
      maxMonthlySales,
      formatDate,
      formatCurrency,
      user: req.session.user,
    });
  } catch (error) {
    console.error('Erreur lors du chargement du Dashboard:', error);
    res.status(500).send('Erreur serveur lors de la génération du tableau de bord.');
  }
};
