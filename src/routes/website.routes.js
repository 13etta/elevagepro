const express = require('express');
const { pool } = require('../db');

const router = express.Router();

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

    const dogs = await pool.query(
      `
        SELECT id, name, sex, breed, lof, chip_number, birth_date, status, notes
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') IN ('actif', 'reproducteur', 'active')
        ORDER BY sex DESC, name ASC
        LIMIT 12
      `,
      [breeder.id],
    );

    const puppies = await pool.query(
      `
        SELECT p.*, l.birth_date, mother.name AS mother_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs mother ON l.mother_id = mother.id
        WHERE p.breeder_id = $1
          AND COALESCE(lower(p.status), '') IN ('disponible', 'actif', 'réservé', 'reserve', 'reservé')
        ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
        LIMIT 24
      `,
      [breeder.id],
    );

    const litters = await pool.query(
      `
        SELECT l.*, mother.name AS mother_name
        FROM litters l
        LEFT JOIN dogs mother ON l.mother_id = mother.id
        WHERE l.breeder_id = $1
          AND COALESCE(lower(l.status), '') IN ('active', 'sevrage')
        ORDER BY l.birth_date DESC
        LIMIT 8
      `,
      [breeder.id],
    );

    return res.status(200).render('website/public-site', {
      title: breeder.company_name || breeder.name || 'Élevage',
      user: null,
      slug,
      breeder,
      dogs: dogs.rows,
      puppies: puppies.rows,
      litters: litters.rows,
    });
  } catch (error) {
    console.error('Erreur vitrine publique:', error);
    return res.status(500).render('errors/500', {
      title: 'Erreur vitrine',
      user: null,
    });
  }
}

router.get('/elevage/:slug', renderPublic);
router.get('/:slug', renderPublic);

module.exports = router;
