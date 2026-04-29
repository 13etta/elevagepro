const express = require('express');
const { pool } = require('../db');

const router = express.Router();

function buildSlug(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function defaultWebsiteSettings() {
  return {
    primaryColor: '#3f6212',
    secondaryColor: '#b45309',
    heroTitle: '',
    heroSubtitle: 'Élevage canin familial, sélection, passion et accompagnement.',
    heroImageUrl: '',
    servicesEnabled: true,
    newsEnabled: true,
    strengthsEnabled: true,
    galleryEnabled: true,
    contactEnabled: true,
    service1Title: 'Élevage canin',
    service1Text: 'Sélection raisonnée, suivi des portées et accompagnement des familles.',
    service2Title: 'Conseil & accompagnement',
    service2Text: 'Aide au choix du chiot, socialisation et suivi après départ.',
    service3Title: 'Sélection cynotechnique',
    service3Text: 'Travail sur la santé, le tempérament, le type et les aptitudes naturelles.',
    newsTitle: 'Actualités de l’élevage',
    newsText: 'Retrouvez nos disponibilités, projets de portées et nouvelles de l’élevage.',
    strengths: 'Sélection raisonnée\nSuivi sanitaire structuré\nAccompagnement après départ\nPassion cynophile',
    phone: '',
    publicEmail: '',
    instagram: '',
    facebook: '',
    gallery: []
  };
}

function mergeWebsiteSettings(settings) {
  return { ...defaultWebsiteSettings(), ...(settings || {}) };
}

async function ensureWebsiteSchema() {
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS slug VARCHAR(180)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS logo_url TEXT').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS address TEXT').catch(() => {});
  await pool.query("ALTER TABLE breeder ADD COLUMN IF NOT EXISTS website_settings JSONB DEFAULT '{}'::jsonb").catch(() => {});
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2)').catch(() => {});
  await pool.query("ALTER TABLE litters ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'").catch(() => {});
}

async function ensureBreederSlug(breeder) {
  if (breeder.slug) return breeder.slug;

  const base = buildSlug(breeder.company_name || breeder.name || 'elevage') || 'elevage';
  const slug = `${base}-${String(breeder.id).slice(0, 8)}`;

  await pool.query('UPDATE breeder SET slug = $1 WHERE id = $2', [slug, breeder.id]).catch(() => {});
  return slug;
}

async function renderPublic(req, res) {
  try {
    await ensureWebsiteSchema();
    const slug = req.params.slug;

    const breederRes = await pool.query(
      `
        SELECT *
        FROM breeder
        WHERE slug = $1 OR id::text = $1
        LIMIT 1
      `,
      [slug],
    );

    if (!breederRes.rows.length) {
      return res.status(404).render('errors/404', {
        title: 'Élevage introuvable',
        user: null,
      });
    }

    const breeder = breederRes.rows[0];
    breeder.slug = await ensureBreederSlug(breeder);
    const websiteSettings = mergeWebsiteSettings(breeder.website_settings);

    const dogs = await pool.query(
      `
        SELECT id, name, sex, breed, chip_number, birth_date, status, notes,
               COALESCE(lof, pedigree, id_scc) AS lof
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') IN ('actif', 'active', 'reproducteur', 'reproductrice')
        ORDER BY sex DESC, name ASC
        LIMIT 12
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    const puppies = await pool.query(
      `
        SELECT p.*, l.birth_date, mother.name AS mother_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs mother ON l.female_id = mother.id
        WHERE p.breeder_id = $1
          AND COALESCE(lower(p.status), '') IN ('disponible', 'actif', 'active', 'réservé', 'reserve', 'reservé')
        ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
        LIMIT 24
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    const litters = await pool.query(
      `
        SELECT l.*, mother.name AS mother_name
        FROM litters l
        LEFT JOIN dogs mother ON l.female_id = mother.id
        WHERE l.breeder_id = $1
          AND COALESCE(lower(l.status), 'active') IN ('active', 'sevrage', 'née', 'nee')
        ORDER BY l.birth_date DESC NULLS LAST
        LIMIT 8
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    return res.status(200).render('website/public-site', {
      title: breeder.company_name || breeder.name || 'Élevage',
      user: null,
      slug: breeder.slug,
      breeder,
      websiteSettings,
      dogs: dogs.rows,
      puppies: puppies.rows,
      litters: litters.rows,
    });
  } catch (error) {
    console.error('Erreur vitrine publique:', error);
    return res.status(500).send('Erreur lors du chargement de la vitrine publique.');
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureWebsiteSchema();

    if (!req.session?.user?.breeder_id) {
      return res.redirect('/auth/login');
    }

    const breederRes = await pool.query('SELECT * FROM breeder WHERE id = $1 LIMIT 1', [req.session.user.breeder_id]);
    if (!breederRes.rows.length) {
      return res.status(404).render('errors/404', {
        title: 'Élevage introuvable',
        user: req.session.user,
      });
    }

    const breeder = breederRes.rows[0];
    const publicSlug = await ensureBreederSlug(breeder);
    return res.redirect(`/site/${publicSlug || breeder.id}`);
  } catch (error) {
    console.error('Erreur route vitrine:', error);
    return res.status(500).send('Erreur lors de l’ouverture de la vitrine.');
  }
});

router.get('/elevage/:slug', renderPublic);
router.get('/:slug', renderPublic);

module.exports = router;
