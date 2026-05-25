const { pool } = require('../db');
const { analyzeCynognostic, buildSearchQueries } = require('../services/cynognostic/analyzer');

async function ensureCynognosticSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS cynognostic_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      breed VARCHAR(255),
      objective VARCHAR(255),
      discipline VARCHAR(255),
      source_url TEXT,
      pedigree_text TEXT,
      announcement_text TEXT,
      observations TEXT,
      image_notes TEXT,
      video_notes TEXT,
      score_global INTEGER DEFAULT 0,
      score_work INTEGER DEFAULT 0,
      score_beauty INTEGER DEFAULT 0,
      score_health INTEGER DEFAULT 0,
      score_pedigree INTEGER DEFAULT 0,
      score_strategic INTEGER DEFAULT 0,
      confidence_score INTEGER DEFAULT 0,
      verdict TEXT,
      alerts JSONB DEFAULT '[]'::jsonb,
      findings JSONB DEFAULT '{}'::jsonb,
      raw_input JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cynognostic_reports_breeder_created
      ON cynognostic_reports(breeder_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_cynognostic_reports_breed
      ON cynognostic_reports(breeder_id, breed);

    CREATE TABLE IF NOT EXISTS cynognostic_watch_profiles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      breed VARCHAR(255),
      objective VARCHAR(255),
      discipline VARCHAR(255),
      zone VARCHAR(255),
      sex_preference VARCHAR(100),
      budget_max NUMERIC(10,2),
      non_negotiables TEXT,
      search_queries JSONB DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT TRUE,
      last_run_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cynognostic_watch_breeder_active
      ON cynognostic_watch_profiles(breeder_id, is_active);
  `);
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeFormInput(body) {
  return {
    title: body.title || 'Analyse Cynognostic',
    breed: body.breed || '',
    objective: body.objective || '',
    discipline: body.discipline || '',
    zone: body.zone || '',
    sexPreference: body.sex_preference || '',
    budgetMax: body.budget_max || '',
    sourceUrl: body.source_url || '',
    pedigreeText: body.pedigree_text || '',
    announcementText: body.announcement_text || '',
    observations: body.observations || '',
    imageNotes: body.image_notes || '',
    videoNotes: body.video_notes || '',
  };
}

exports.index = async (req, res) => {
  try {
    await ensureCynognosticSchema();
    const breederId = req.session.user.breeder_id;

    const analyses = await pool.query(
      `SELECT id, title, breed, objective, discipline, score_global, score_work, score_beauty, score_health, confidence_score, verdict, created_at
       FROM cynognostic_reports
       WHERE breeder_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [breederId],
    );

    const watches = await pool.query(
      `SELECT id, name, breed, objective, discipline, zone, budget_max, is_active, created_at
       FROM cynognostic_watch_profiles
       WHERE breeder_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [breederId],
    );

    res.render('cynognostic/index', {
      title: 'CYNOGNOSTIC CORE',
      analyses: analyses.rows,
      watches: watches.rows,
      result: null,
      input: {},
    });
  } catch (error) {
    console.error('Erreur index Cynognostic:', error);
    res.status(500).render('errors/500', { title: res.__('errors.serverError'), user: req.session?.user || null });
  }
};

exports.runAnalysis = async (req, res) => {
  try {
    await ensureCynognosticSchema();
    const breederId = req.session.user.breeder_id;
    const userInput = normalizeFormInput(req.body);
    const analysis = analyzeCynognostic(userInput);

    const inserted = await pool.query(
      `INSERT INTO cynognostic_reports (
        breeder_id, title, breed, objective, discipline, source_url,
        pedigree_text, announcement_text, observations, image_notes, video_notes,
        score_global, score_work, score_beauty, score_health, score_pedigree, score_strategic, confidence_score,
        verdict, alerts, findings, raw_input
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) RETURNING id`,
      [
        breederId,
        userInput.title,
        userInput.breed,
        userInput.objective,
        userInput.discipline,
        userInput.sourceUrl,
        userInput.pedigreeText,
        userInput.announcementText,
        userInput.observations,
        userInput.imageNotes,
        userInput.videoNotes,
        analysis.scores.global,
        analysis.scores.work,
        analysis.scores.beauty,
        analysis.scores.health,
        analysis.scores.pedigree,
        analysis.scores.strategic,
        analysis.scores.confidence,
        analysis.verdict,
        JSON.stringify(analysis.alerts),
        JSON.stringify(analysis.findings),
        JSON.stringify(userInput),
      ],
    );

    req.session.flash = { type: 'success', message: 'Analyse CYNOGNOSTIC enregistrée.' };
    res.redirect(`/cynognostic/reports/${inserted.rows[0].id}`);
  } catch (error) {
    console.error('Erreur analyse Cynognostic:', error);
    req.session.flash = { type: 'error', message: 'Impossible de générer l’analyse CYNOGNOSTIC.' };
    res.redirect('/cynognostic');
  }
};

exports.showReport = async (req, res) => {
  try {
    await ensureCynognosticSchema();
    const breederId = req.session.user.breeder_id;
    const report = await pool.query(
      `SELECT * FROM cynognostic_reports WHERE id = $1 AND breeder_id = $2`,
      [req.params.id, breederId],
    );

    if (!report.rows.length) {
      return res.status(404).render('errors/404', { title: res.__('errors.notFound'), user: req.session?.user || null });
    }

    const row = report.rows[0];
    row.alerts = parseJsonField(row.alerts, []);
    row.findings = parseJsonField(row.findings, {});
    row.raw_input = parseJsonField(row.raw_input, {});

    return res.render('cynognostic/report', {
      title: row.title,
      report: row,
    });
  } catch (error) {
    console.error('Erreur rapport Cynognostic:', error);
    res.status(500).render('errors/500', { title: res.__('errors.serverError'), user: req.session?.user || null });
  }
};

exports.createWatch = async (req, res) => {
  try {
    await ensureCynognosticSchema();
    const breederId = req.session.user.breeder_id;
    const criteria = {
      breed: req.body.breed || '',
      objective: req.body.objective || '',
      discipline: req.body.discipline || '',
      zone: req.body.zone || '',
      sexPreference: req.body.sex_preference || '',
      budgetMax: req.body.budget_max || '',
      nonNegotiables: req.body.non_negotiables || '',
    };
    const queries = buildSearchQueries(criteria);

    await pool.query(
      `INSERT INTO cynognostic_watch_profiles (
        breeder_id, name, breed, objective, discipline, zone, sex_preference, budget_max, non_negotiables, search_queries
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        breederId,
        req.body.name || `Veille ${criteria.breed || 'race'}`,
        criteria.breed,
        criteria.objective,
        criteria.discipline,
        criteria.zone,
        criteria.sexPreference,
        criteria.budgetMax || null,
        criteria.nonNegotiables,
        JSON.stringify(queries),
      ],
    );

    req.session.flash = { type: 'success', message: 'Profil de veille créé. Les connecteurs de recherche pourront s’appuyer dessus.' };
    return res.redirect('/cynognostic');
  } catch (error) {
    console.error('Erreur veille Cynognostic:', error);
    req.session.flash = { type: 'error', message: 'Impossible de créer le profil de veille.' };
    return res.redirect('/cynognostic');
  }
};
