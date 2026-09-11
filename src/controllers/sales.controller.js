const { pool } = require('../db');
const documentService = require('../services/document.service');
const salesService = require('../services/sales.service');

async function ensureSalesSchema() {
  // Les migrations doivent être jouées par `npm run db:migrate`.
  // Ne pas exécuter d'ALTER TABLE au runtime : cela peut bloquer Render/PostgreSQL.
  return true;
}

async function getSaleWithAnimal(clientOrPool, saleId, breederId) {
  const saleRes = await clientOrPool.query(
    `
      SELECT s.*,
             COALESCE(p.name, d.name) AS animal_name,
             COALESCE(p.sex, d.sex) AS animal_sex,
             COALESCE(p.chip_number, d.chip_number) AS animal_chip_number,
             COALESCE(d.breed, 'Chiot') AS animal_breed,
             p.color AS animal_color,
             CASE WHEN s.puppy_id IS NOT NULL THEN 'puppy' ELSE 'dog' END AS animal_type,
             COALESCE(s.puppy_id, s.dog_id) AS animal_id
      FROM sales s
      LEFT JOIN puppies p ON s.puppy_id = p.id AND p.breeder_id = s.breeder_id
      LEFT JOIN dogs d ON s.dog_id = d.id AND d.breeder_id = s.breeder_id
      WHERE s.id = $1 AND s.breeder_id = $2
    `,
    [saleId, breederId],
  );

  return saleRes.rows[0] || null;
}

function parseMoney(value) {
  const parsed = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

exports.listSales = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

    const sales = await pool.query(
      `
        SELECT s.*,
               COALESCE(p.name, d.name) AS animal_name,
               COALESCE(p.chip_number, d.chip_number) AS animal_chip_number,
               CASE WHEN s.puppy_id IS NOT NULL THEN 'Chiot' ELSE 'Chien adulte' END AS animal_category
        FROM sales s
        LEFT JOIN puppies p ON s.puppy_id = p.id AND p.breeder_id = s.breeder_id
        LEFT JOIN dogs d ON s.dog_id = d.id AND d.breeder_id = s.breeder_id
        WHERE s.breeder_id = $1
        ORDER BY s.sale_date DESC
      `,
      [breederId],
    );

    const totalRevenue = sales.rows.reduce((sum, sale) => {
      if (sale.is_reservation) return sum;
      return sum + parseMoney(sale.price);
    }, 0);

    res.render('sales/index', {
      sales: sales.rows,
      totalRevenue: totalRevenue.toFixed(2),
    });
  } catch (error) {
    console.error('Erreur liste ventes:', error);
    res.status(500).send('Erreur lors du chargement du module financier.');
  }
};

exports.getSaleForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

    const puppies = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.sex,
          p.color,
          p.chip_number,
          p.status,
          p.sale_price,
          l.birth_date AS litter_birth_date,
          d.name AS mother_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id AND l.breeder_id = p.breeder_id
        LEFT JOIN dogs d ON l.mother_id = d.id AND d.breeder_id = l.breeder_id
        WHERE p.breeder_id = $1
          AND COALESCE(lower(trim(p.status)), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee')
        ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
      `,
      [breederId],
    );

    const dogs = await pool.query(
      `
        SELECT id, name, sex, breed, chip_number, status
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(trim(status)), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee')
        ORDER BY name ASC
      `,
      [breederId],
    );

    res.render('sales/new', {
      title: 'Déclarer une transaction',
      puppies: puppies.rows,
      dogs: dogs.rows,
    });
  } catch (error) {
    console.error('Erreur chargement formulaire vente:', error);
    res.status(500).send('Erreur d\'ouverture du formulaire.');
  }
};

exports.createSale = async (req, res, next) => {
  try { await salesService.create(req.session.user.breeder_id, req.body); return res.redirect('/sales'); }
  catch (error) { if (error.status) return res.status(error.status).send(error.message); return next(error); }
};

exports.getEditSaleForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const sale = await getSaleWithAnimal(pool, req.params.id, breederId);

    if (!sale) {
      return res.status(404).send('Vente introuvable.');
    }

    res.render('sales/edit', {
      title: 'Modifier la transaction',
      sale,
    });
  } catch (error) {
    console.error('Erreur chargement édition vente:', error);
    res.status(500).send('Erreur lors du chargement de la transaction.');
  }
};

exports.updateSale = async (req, res, next) => {
  try { await salesService.update(req.session.user.breeder_id, req.params.id, req.body); return res.redirect('/sales'); }
  catch (error) { if (error.status) return res.status(error.status).send(error.message); return next(error); }
};

exports.downloadDocument = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const saleId = req.params.id;
    const docType = req.params.type;
    const allowedDocumentTypes = documentService.getAllowedDocumentTypes();

    if (!allowedDocumentTypes.includes(docType)) {
      return res.status(400).send('Type de document non autorisé.');
    }

    const saleRes = await pool.query(
      `
        SELECT s.*,
               COALESCE(p.name, d.name) AS name,
               COALESCE(p.sex, d.sex) AS sex,
               COALESCE(p.chip_number, d.chip_number) AS chip_number,
               COALESCE(d.breed, 'Chiot') AS breed,
               p.color AS color,
               CASE WHEN s.puppy_id IS NOT NULL THEN 'puppy' ELSE 'dog' END AS animal_type
        FROM sales s
        LEFT JOIN puppies p ON s.puppy_id = p.id AND p.breeder_id = s.breeder_id
        LEFT JOIN dogs d ON s.dog_id = d.id AND d.breeder_id = s.breeder_id
        WHERE s.id = $1 AND s.breeder_id = $2
      `,
      [saleId, breederId],
    );

    const breederRes = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);

    if (saleRes.rows.length === 0 || breederRes.rows.length === 0) {
      return res.status(404).send('Données introuvables.');
    }

    const saleData = saleRes.rows[0];
    const animalData = saleRes.rows[0];
    const breederData = breederRes.rows[0];

    const pdfBuffer = await documentService.generateDocument(docType, breederData, saleData, animalData);
    const filename = documentService.getDocumentFilename(docType, animalData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).send('Erreur lors de la création du document légal.');
  }
};
