const { pool } = require('../db');
const documentService = require('../services/document.service');
const registerService = require('../services/register.service');

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
      LEFT JOIN puppies p ON s.puppy_id = p.id
      LEFT JOIN dogs d ON s.dog_id = d.id
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
        LEFT JOIN puppies p ON s.puppy_id = p.id
        LEFT JOIN dogs d ON s.dog_id = d.id
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
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs d ON l.mother_id = d.id
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

exports.createSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const breederId = req.session.user.breeder_id;
    const { animal_selection, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount } = req.body;

    if (!animal_selection || !animal_selection.includes('|')) {
      return res.status(400).send('Aucun animal valide sélectionné.');
    }

    if (!buyer_name || !String(buyer_name).trim()) {
      return res.status(400).send('Le nom de l’acquéreur est obligatoire.');
    }

    if (!sale_date) {
      return res.status(400).send('La date de transaction est obligatoire.');
    }

    const totalPrice = parseMoney(price);
    const deposit = parseMoney(deposit_amount);
    const isResa = is_reservation === 'true';
    const targetStatus = isResa ? 'Réservé' : 'Vendu';

    const [animalType, animalId] = animal_selection.split('|');
    if (!['puppy', 'dog'].includes(animalType) || !animalId) {
      return res.status(400).send('Sélection animal invalide.');
    }

    const puppyId = animalType === 'puppy' ? animalId : null;
    const dogId = animalType === 'dog' ? animalId : null;

    await client.query('BEGIN');

    const animalCheck = await client.query(
      animalType === 'puppy'
        ? 'SELECT id FROM puppies WHERE id = $1 AND breeder_id = $2'
        : 'SELECT id FROM dogs WHERE id = $1 AND breeder_id = $2',
      [animalId, breederId],
    );

    if (!animalCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).send('Animal introuvable pour cet élevage.');
    }

    const inserted = await client.query(
      `
        INSERT INTO sales (breeder_id, puppy_id, dog_id, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [breederId, puppyId, dogId, String(buyer_name).trim(), sale_date, totalPrice, payment_method || null, notes || null, isResa, deposit],
    );

    if (animalType === 'puppy') {
      await client.query('UPDATE puppies SET status = $1, is_sold = $2 WHERE id = $3 AND breeder_id = $4', [targetStatus, !isResa, animalId, breederId]);
    } else {
      await client.query('UPDATE dogs SET status = $1 WHERE id = $2 AND breeder_id = $3', [targetStatus, animalId, breederId]);
    }

    await client.query('COMMIT');

    if (!isResa) {
      try {
        const sale = await getSaleWithAnimal(pool, inserted.rows[0].id, breederId);
        if (sale) {
          await registerService.logSaleExit({ breederId, sale });
        }
      } catch (registerError) {
        console.warn('Registre non mis à jour après transaction:', registerError.message);
      }
    }

    res.redirect('/sales');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback transaction vente impossible:', rollbackError);
    }
    console.error('Erreur enregistrement transaction:', error);
    res.status(500).send(`Erreur lors de la finalisation : ${error.message}`);
  } finally {
    client.release();
  }
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

exports.updateSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const breederId = req.session.user.breeder_id;
    const saleId = req.params.id;
    const { buyer_name, sale_date, price, payment_method, notes, deposit_amount, finalize_sale } = req.body;

    await client.query('BEGIN');

    const previousSale = await getSaleWithAnimal(client, saleId, breederId);
    if (!previousSale) {
      await client.query('ROLLBACK');
      return res.status(404).send('Vente introuvable.');
    }

    const isFinalSale = finalize_sale === 'true';
    const newReservationStatus = isFinalSale ? false : previousSale.is_reservation;

    await client.query(
      `
        UPDATE sales
        SET buyer_name = $1,
            sale_date = $2,
            price = $3,
            payment_method = $4,
            notes = $5,
            deposit_amount = $6,
            is_reservation = $7
        WHERE id = $8 AND breeder_id = $9
      `,
      [buyer_name, sale_date, parseMoney(price), payment_method || null, notes || null, parseMoney(deposit_amount), newReservationStatus, saleId, breederId],
    );

    await client.query('COMMIT');

    if (isFinalSale) {
      try {
        const finalizedSale = await getSaleWithAnimal(pool, saleId, breederId);
        if (finalizedSale) {
          await registerService.logSaleExit({ breederId, sale: finalizedSale });
        }
      } catch (registerError) {
        console.warn('Registre non mis à jour après finalisation:', registerError.message);
      }
    }

    res.redirect('/sales');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback mise à jour vente impossible:', rollbackError);
    }
    console.error('Erreur mise à jour vente:', error);
    res.status(500).send(`Erreur lors de la mise à jour de la transaction : ${error.message}`);
  } finally {
    client.release();
  }
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
        LEFT JOIN puppies p ON s.puppy_id = p.id
        LEFT JOIN dogs d ON s.dog_id = d.id
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
