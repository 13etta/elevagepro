const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db');
const { mergeWebsiteSettings, buildServices } = require('../services/website-settings.service');

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

function groupByBreed(items) {
  return items.reduce((groups, item) => {
    const breed = item.breed || item.mother_breed || 'Race non renseignée';
    if (!groups[breed]) groups[breed] = [];
    groups[breed].push(item);
    return groups;
  }, {});
}



async function ensureBreederSlug(breeder) { return breeder.slug || breeder.id; }

async function renderPublic(req, res) {
  try {
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
    const websiteSettings = mergeWebsiteSettings(breeder.website_settings);
    if (websiteSettings.isPublished === false && !(req.preview && req.session.user.breeder_id === breeder.id)) return res.status(404).render('errors/404', { title: 'Élevage introuvable', user: null });

    const dogs = await pool.query(
      `
        SELECT id, name, sex, breed, birth_date, status, photo_url,
               COALESCE(lof, pedigree_number, id_scc) AS lof
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') IN ('actif', 'active', 'reproducteur', 'reproductrice', 'disponible')
        ORDER BY breed ASC NULLS LAST, sex DESC, name ASC
        LIMIT 48
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    const puppies = await pool.query(
      `
        SELECT p.*, l.birth_date, mother.name AS mother_name, mother.breed AS mother_breed
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id AND l.breeder_id = p.breeder_id
        LEFT JOIN dogs mother ON l.mother_id = mother.id AND mother.breeder_id = p.breeder_id
        WHERE p.breeder_id = $1
          AND COALESCE(lower(p.status), '') IN ('disponible', 'actif', 'active', 'réservé', 'reserve', 'reservé')
        ORDER BY mother.breed ASC NULLS LAST, l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
        LIMIT 60
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    const litters = await pool.query(
      `
        SELECT l.*, mother.name AS mother_name, mother.breed AS mother_breed
        FROM litters l
        LEFT JOIN dogs mother ON l.mother_id = mother.id AND mother.breeder_id = l.breeder_id
        WHERE l.breeder_id = $1
          AND COALESCE(lower(l.status), 'active') IN ('active', 'sevrage', 'née', 'nee')
        ORDER BY mother.breed ASC NULLS LAST, l.birth_date DESC NULLS LAST
        LIMIT 24
      `,
      [breeder.id],
    ).catch(() => ({ rows: [] }));

    const dogsByBreed = groupByBreed(dogs.rows);
    const puppiesByBreed = groupByBreed(puppies.rows);
    const littersByBreed = groupByBreed(litters.rows);
    const publicServices = buildServices(websiteSettings);

    return res.status(200).render('website/public-site', {
      title: breeder.company_name || breeder.name || 'Élevage',
      user: null,
      slug: breeder.slug,
      breeder,
      websiteSettings,
      dogs: dogs.rows,
      puppies: puppies.rows,
      litters: litters.rows,
      dogsByBreed,
      puppiesByBreed,
      littersByBreed,
      publicServices,
    });
  } catch (error) {
    console.error('Erreur vitrine publique:', error);
    return res.status(500).send('Erreur lors du chargement de la vitrine publique.');
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {

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

router.get('/preview', requireAuth, (req, res) => { req.params.slug = req.session.user.breeder_id; req.preview = true; return renderPublic(req, res); });
router.get('/elevage/:slug', renderPublic);
router.get('/:slug', renderPublic);

module.exports = router;
