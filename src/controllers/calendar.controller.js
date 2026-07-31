const { pool } = require('../db');

const CATEGORY_LABELS = {
  tan: 'TAN',
  field_trial: 'Field-trial',
  beaute: 'Concours de beauté',
  confirmation: 'Confirmation',
  exposition: 'Exposition',
  entrainement: 'Entraînement',
  chasse: 'Chasse',
  veterinaire: 'Vétérinaire',
  reproduction: 'Reproduction',
  administratif: 'Administratif',
  autre: 'Autre',
};

const STATUS_LABELS = {
  prevu: 'Prévu',
  inscrit: 'Inscrit',
  confirme: 'Confirmé',
  termine: 'Terminé',
  annule: 'Annulé',
};

const ACTIVE_DOG_EXCLUSIONS = ['sorti', 'archivé', 'archive', 'archived', 'inactif'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function normalizeDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function parseDateInput(value) {
  const raw = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return '';
  }

  return raw;
}

function parseTimeInput(value) {
  const raw = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '';
}

function parseMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function shiftMonth(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}

function buildCalendarWeeks(year, month, events) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayOffset }, () => null);
  const eventsByDay = new Map();

  events.forEach((event) => {
    const day = Number(normalizeDate(event.event_date).slice(8, 10));
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day).push(event);
  });

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      date: `${monthKey(year, month)}-${String(day).padStart(2, '0')}`,
      events: eventsByDay.get(day) || [],
    });
  }

  while (cells.length % 7) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

function parseDogIds(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map(String).filter(isUuid))];
}

function parseReminderDays(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 365))]
    .sort((a, b) => b - a);
}

function cleanText(value, maxLength = null) {
  const text = String(value || '').trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function getDogs(breederId, includeDogIds = []) {
  const result = await pool.query(
    `
      SELECT id, name, status
      FROM dogs
      WHERE breeder_id = $1
        AND (
          LOWER(TRIM(COALESCE(status, 'actif'))) <> ALL($2::text[])
          OR id = ANY($3::uuid[])
        )
      ORDER BY name ASC
    `,
    [breederId, ACTIVE_DOG_EXCLUSIONS, includeDogIds],
  );

  return result.rows;
}

async function getEvent(breederId, eventId) {
  const result = await pool.query(
    `
      SELECT
        e.*,
        COALESCE(
          ARRAY_AGG(ced.dog_id) FILTER (WHERE ced.dog_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS dog_ids
      FROM calendar_events e
      LEFT JOIN calendar_event_dogs ced
        ON ced.event_id = e.id
       AND ced.breeder_id = e.breeder_id
      WHERE e.id = $1
        AND e.breeder_id = $2
      GROUP BY e.id
    `,
    [eventId, breederId],
  );

  return result.rows[0] || null;
}

function eventQueryParts(filters, breederId, params) {
  const conditions = ['e.breeder_id = $1'];
  params.push(breederId);

  if (filters.category && CATEGORY_LABELS[filters.category]) {
    params.push(filters.category);
    conditions.push(`e.category = $${params.length}`);
  }

  if (filters.status && STATUS_LABELS[filters.status]) {
    params.push(filters.status);
    conditions.push(`e.status = $${params.length}`);
  }

  if (filters.dogId && isUuid(filters.dogId)) {
    params.push(filters.dogId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM calendar_event_dogs dog_filter
        WHERE dog_filter.event_id = e.id
          AND dog_filter.breeder_id = e.breeder_id
          AND dog_filter.dog_id = $${params.length}
      )
    `);
  }

  return conditions;
}

exports.listEvents = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const { year, month } = parseMonth(req.query.month);
    const currentMonth = monthKey(year, month);
    const filters = {
      category: cleanText(req.query.category, 40),
      status: cleanText(req.query.status, 30),
      dogId: cleanText(req.query.dog_id, 36),
    };
    const params = [];
    const conditions = eventQueryParts(filters, breederId, params);

    params.push(`${currentMonth}-01`);
    conditions.push(`e.event_date >= $${params.length}::date`);
    params.push(shiftMonth(year, month, 1) + '-01');
    conditions.push(`e.event_date < $${params.length}::date`);

    const eventsResult = await pool.query(
      `
        SELECT
          e.*,
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
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.event_date ASC, e.start_time ASC NULLS FIRST, e.title ASC
      `,
      params,
    );

    const upcomingParams = [];
    const upcomingConditions = eventQueryParts(filters, breederId, upcomingParams);
    upcomingConditions.push("e.event_date >= CURRENT_DATE");
    upcomingConditions.push("e.status <> 'annule'");

    const upcomingResult = await pool.query(
      `
        SELECT
          e.*,
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
        WHERE ${upcomingConditions.join(' AND ')}
        ORDER BY e.event_date ASC, e.start_time ASC NULLS FIRST
        LIMIT 12
      `,
      upcomingParams,
    );

    const summaryResult = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE event_date >= CURRENT_DATE
              AND event_date <= CURRENT_DATE + INTERVAL '30 days'
              AND status <> 'annule'
          )::int AS upcoming_count,
          COUNT(*) FILTER (
            WHERE registration_deadline >= CURRENT_DATE
              AND registration_deadline <= CURRENT_DATE + INTERVAL '7 days'
              AND status IN ('prevu', 'inscrit')
          )::int AS deadline_count,
          COALESCE(SUM(cost) FILTER (
            WHERE event_date >= $2::date
              AND event_date < $3::date
              AND status <> 'annule'
          ), 0)::numeric AS monthly_cost
        FROM calendar_events
        WHERE breeder_id = $1
      `,
      [breederId, `${currentMonth}-01`, `${shiftMonth(year, month, 1)}-01`],
    );

    const dogs = await getDogs(breederId);
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    return res.render('calendar/index', {
      title: 'Calendrier',
      currentMonth,
      monthLabel,
      previousMonth: shiftMonth(year, month, -1),
      nextMonth: shiftMonth(year, month, 1),
      weeks: buildCalendarWeeks(year, month, eventsResult.rows),
      upcomingEvents: upcomingResult.rows,
      summary: summaryResult.rows[0],
      filters,
      dogs,
      categoryLabels: CATEGORY_LABELS,
      statusLabels: STATUS_LABELS,
      normalizeDate,
      normalizeTime,
    });
  } catch (error) {
    console.error('Erreur chargement calendrier:', error);
    return res.status(500).send('Erreur lors du chargement du calendrier.');
  }
};

exports.getEventForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const eventId = req.params.id;
    let event = {
      title: '',
      category: 'tan',
      event_date: parseDateInput(req.query.date) || '',
      end_date: '',
      start_time: '',
      end_time: '',
      all_day: true,
      status: 'prevu',
      reminder_days: [30, 15, 7, 1],
      dog_ids: [],
    };

    if (eventId) {
      if (!isUuid(eventId)) return res.status(404).send('Événement introuvable.');
      event = await getEvent(breederId, eventId);
      if (!event) return res.status(404).send('Événement introuvable.');
    }

    const selectedDogIds = (event.dog_ids || []).map(String);
    const dogs = await getDogs(breederId, selectedDogIds);

    return res.render('calendar/form', {
      title: eventId ? 'Modifier l’événement' : 'Nouvel événement',
      event,
      dogs,
      categoryLabels: CATEGORY_LABELS,
      statusLabels: STATUS_LABELS,
      normalizeDate,
      normalizeTime,
    });
  } catch (error) {
    console.error('Erreur formulaire calendrier:', error);
    return res.status(500).send('Erreur lors du chargement du formulaire.');
  }
};

exports.saveEvent = async (req, res) => {
  const client = await pool.connect();

  try {
    const breederId = req.session.user.breeder_id;
    const eventId = req.params.id;
    const title = cleanText(req.body.title, 255);
    const category = cleanText(req.body.category, 40);
    const status = cleanText(req.body.status, 30);
    const eventDate = parseDateInput(req.body.event_date);
    const endDate = parseDateInput(req.body.end_date);
    const allDay = req.body.all_day === 'on' || req.body.all_day === 'true';
    const startTime = allDay ? '' : parseTimeInput(req.body.start_time);
    const endTime = allDay ? '' : parseTimeInput(req.body.end_time);
    const documentUrl = cleanText(req.body.document_url);
    const dogIds = parseDogIds(req.body.dog_ids);
    const reminderDays = parseReminderDays(req.body.reminder_days);
    const cost = req.body.cost === '' ? null : Number(req.body.cost);

    const errors = [];
    if (!title) errors.push('Le titre est obligatoire.');
    if (!CATEGORY_LABELS[category]) errors.push('La catégorie est invalide.');
    if (!STATUS_LABELS[status]) errors.push('Le statut est invalide.');
    if (!eventDate) errors.push('La date de l’événement est obligatoire.');
    if (req.body.end_date && !endDate) errors.push('La date de fin est invalide.');
    const registrationDeadline = parseDateInput(req.body.registration_deadline);
    if (req.body.registration_deadline && !registrationDeadline) errors.push('La date limite d’inscription est invalide.');
    if (endDate && endDate < eventDate) errors.push('La date de fin ne peut pas précéder la date de début.');
    if (!allDay && req.body.start_time && !startTime) errors.push('L’heure de début est invalide.');
    if (!allDay && req.body.end_time && !endTime) errors.push('L’heure de fin est invalide.');
    if (!allDay && !endDate && startTime && endTime && endTime < startTime) {
      errors.push('L’heure de fin ne peut pas précéder l’heure de début.');
    }
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) errors.push('Le coût est invalide.');
    if (!isValidHttpUrl(documentUrl)) errors.push('Le lien du document doit commencer par http:// ou https://.');
    if (eventId && !isUuid(eventId)) errors.push('L’événement est invalide.');

    if (errors.length) {
      req.session.flash = { type: 'error', message: errors.join(' ') };
      return res.redirect(eventId ? `/calendar/${eventId}/edit` : '/calendar/new');
    }

    await client.query('BEGIN');

    let existingDogIds = [];
    if (eventId) {
      const current = await client.query(
        `
          SELECT ced.dog_id
          FROM calendar_events e
          LEFT JOIN calendar_event_dogs ced
            ON ced.event_id = e.id
           AND ced.breeder_id = e.breeder_id
          WHERE e.id = $1
            AND e.breeder_id = $2
        `,
        [eventId, breederId],
      );

      if (!current.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).send('Événement introuvable.');
      }

      existingDogIds = current.rows.map((row) => row.dog_id).filter(Boolean).map(String);
    }

    if (dogIds.length) {
      const allowedDogs = await client.query(
        `
          SELECT id
          FROM dogs
          WHERE breeder_id = $1
            AND id = ANY($2::uuid[])
            AND (
              LOWER(TRIM(COALESCE(status, 'actif'))) <> ALL($3::text[])
              OR id = ANY($4::uuid[])
            )
        `,
        [breederId, dogIds, ACTIVE_DOG_EXCLUSIONS, existingDogIds],
      );

      if (allowedDogs.rows.length !== dogIds.length) {
        await client.query('ROLLBACK');
        req.session.flash = {
          type: 'error',
          message: 'Un chien sélectionné est sorti de l’élevage ou ne vous appartient pas.',
        };
        return res.redirect(eventId ? `/calendar/${eventId}/edit` : '/calendar/new');
      }
    }

    const values = [
      title,
      category,
      eventDate,
      endDate || null,
      startTime || null,
      endTime || null,
      allDay,
      cleanText(req.body.location, 255) || null,
      cleanText(req.body.organizer, 255) || null,
      cleanText(req.body.judge_name, 255) || null,
      registrationDeadline || null,
      status,
      cost,
      documentUrl || null,
      reminderDays,
      cleanText(req.body.ranking, 100) || null,
      cleanText(req.body.qualification, 160) || null,
      cleanText(req.body.award, 160) || null,
      cleanText(req.body.notes) || null,
      cleanText(req.body.result_notes) || null,
    ];

    let savedEventId = eventId;
    if (eventId) {
      const updated = await client.query(
        `
          UPDATE calendar_events
          SET title = $1,
              category = $2,
              event_date = $3,
              end_date = $4,
              start_time = $5,
              end_time = $6,
              all_day = $7,
              location = $8,
              organizer = $9,
              judge_name = $10,
              registration_deadline = $11,
              status = $12,
              cost = $13,
              document_url = $14,
              reminder_days = $15,
              ranking = $16,
              qualification = $17,
              award = $18,
              notes = $19,
              result_notes = $20,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $21
            AND breeder_id = $22
          RETURNING id
        `,
        [...values, eventId, breederId],
      );

      if (!updated.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).send('Événement introuvable.');
      }
    } else {
      const inserted = await client.query(
        `
          INSERT INTO calendar_events (
            title, category, event_date, end_date, start_time, end_time,
            all_day, location, organizer, judge_name, registration_deadline,
            status, cost, document_url, reminder_days, ranking, qualification,
            award, notes, result_notes, breeder_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          )
          RETURNING id
        `,
        [...values, breederId],
      );
      savedEventId = inserted.rows[0].id;
    }

    await client.query(
      'DELETE FROM calendar_event_dogs WHERE event_id = $1 AND breeder_id = $2',
      [savedEventId, breederId],
    );

    if (dogIds.length) {
      await client.query(
        `
          INSERT INTO calendar_event_dogs (event_id, dog_id, breeder_id)
          SELECT $1, selected_dog_id, $2
          FROM UNNEST($3::uuid[]) AS selected_dog_id
        `,
        [savedEventId, breederId, dogIds],
      );
    }

    await client.query('COMMIT');
    req.session.flash = {
      type: 'success',
      message: eventId ? 'Événement mis à jour.' : 'Événement ajouté au calendrier.',
    };
    return res.redirect(`/calendar?month=${eventDate.slice(0, 7)}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur sauvegarde calendrier:', error);
    return res.status(500).send('Erreur lors de la sauvegarde de l’événement.');
  } finally {
    client.release();
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const eventId = req.params.id;
    if (!isUuid(eventId)) return res.status(404).send('Événement introuvable.');

    const result = await pool.query(
      'DELETE FROM calendar_events WHERE id = $1 AND breeder_id = $2 RETURNING id',
      [eventId, breederId],
    );

    if (!result.rows.length) return res.status(404).send('Événement introuvable.');

    req.session.flash = { type: 'success', message: 'Événement supprimé.' };
    return res.redirect('/calendar');
  } catch (error) {
    console.error('Erreur suppression calendrier:', error);
    return res.status(500).send('Erreur lors de la suppression de l’événement.');
  }
};
