const { pool } = require('../db');
const pdfService = require('../utils/pdf.service');

async function getSaleWithAnimal(clientOrPool, saleId, breederId) {
  const saleRes = await clientOrPool.query(
    `
      SELECT s.*,
             COALESCE(p.name, d.name) AS animal_name,
             COALESCE(p.sex, d.sex) AS animal_sex,
             COALESCE(p.chip_number, d.chip_number) AS animal_chip_number,
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

async function registerFinalMovementIfNeeded(client, breederId, sale, saleDate, buyerName) {
  if (!sale?.animal_id) return;

  const animalTable = sale.animal_type === 'puppy' ? 'puppies' : 'dogs';
  const animalLabel = sale.animal_type === 'puppy' ? 'chiot' : 'adulte';

  const animalDataRes = await client.query(
    `SELECT name, chip_number FROM ${animalTable} WHERE id = $1 AND breeder_id = $2`,
    [sale.animal_id, breederId],
  );

  if (!animalDataRes.rows.length) return;

  const animalName = animalDataRes.rows[0].name;
  const animalChip = animalDataRes.rows[0].chip_number;

  await client.query(`UPDATE ${animalTable} SET status = 'Vendu' WHERE id = $1 AND breeder_id = $2`, [sale.animal_id, breederId]);

  const existingMovement = await client.query(
    `
      SELECT id
      FROM movements
      WHERE breeder_id = $1
        AND animal_type = $2
        AND animal_name = $3
        AND COALESCE(chip_number, '') = COALESCE($4, '')
        AND movement_type = 'sortie'
        AND reason = 'vente'
      LIMIT 1
    `,
    [breederId, animalLabel, animalName, animalChip],
  );

  if (!existingMovement.rows.length) {
    await client.query(
      `
        INSERT INTO movements (breeder_id, animal_type, animal_name, chip_number, movement_type, reason, movement_date, provenance_destination)
        VALUES ($1, $2, $3, $4, 'sortie', 'vente', $5, $6)
      `,
      [breederId, animalLabel, animalName, animalChip, saleDate, buyerName],
    );
  }
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
      return sum + parseFloat(sale.price || 0);
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
          AND COALESCE(lower(p.status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee')
        ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
      `,
      [breederId],
    );

    const dogs = await pool.query(
      `
        SELECT id, name, sex, breed, chip_number, status
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee', 'archivé', 'archive')
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

    if (!animal_selection) {
      return res.status(400).send('Aucun animal sélectionné.');
    }

    const isResa = is_reservation === 'true';
    const deposit = deposit_amount ? parseFloat(deposit_amount) : 0;
    const targetStatus = isResa ? 'Réservé' : 'Vendu';

    const [animalType, animalId] = animal_selection.split('|');
    const puppyId = animalType === 'puppy' ? animalId : null;
    const dogId = animalType === 'dog' ? animalId : null;

    await client.query('BEGIN');

    const inserted = await client.query(
      `
        INSERT INTO sales (breeder_id, puppy_id, dog_id, buyer_name, sale_date, price, payment_method, notes, is_reservation, deposit_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [breederId, puppyId, dogId, buyer_name, sale_date, price, payment_method, notes, isResa, deposit],
    );

    const table = animalType === 'puppy' ? 'puppies' : 'dogs';
    await client.query(`UPDATE ${table} SET status = $1 WHERE id = $2 AND breeder_id = $3`, [targetStatus, animalId, breederId]);

    if (!isResa) {
      const sale = await getSaleWithAnimal(client, inserted.rows[0].id, breederId);
      await registerFinalMovementIfNeeded(client, breederId, sale, sale_date, buyer_name);
    }

    await client.query('COMMIT');
    res.redirect('/sales');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur enregistrement transaction:', error);
    res.status(500).send('Erreur lors de la finalisation.');
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
      [buyer_name, sale_date, price, payment_method, notes, deposit_amount || 0, newReservationStatus, saleId, breederId],
    );

    if (isFinalSale) {
      await registerFinalMovementIfNeeded(client, breederId, previousSale, sale_date, buyer_name);
    }

    await client.query('COMMIT');
    res.redirect('/sales');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur mise à jour vente:', error);
    res.status(500).send('Erreur lors de la mise à jour de la transaction.');
  } finally {
    client.release();
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const saleId = req.params.id;
    const docType = req.params.type;
    const allowedDocumentTypes = ['reservation', 'facture', 'cession', 'information'];

    if (!allowedDocumentTypes.includes(docType)) {
      return res.status(400).send('Type de document non autorisé.');
    }

    const saleRes = await pool.query(
      `
        SELECT s.*,
               COALESCE(p.name, d.name) AS name,
               COALESCE(p.sex, d.sex) AS sex,
               COALESCE(p.chip_number, d.chip_number) AS chip_number,
               p.color AS color
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

    const pdfBuffer = await pdfService.generateDocument(docType, breederData, saleData, animalData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${docType}_${animalData.name}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).send('Erreur lors de la création du document légal.');
  }
};
