const PDFDocument = require('pdfkit');
const { pool } = require('../db');

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

function safeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeType(value) {
  const key = String(value || '').toLowerCase();
  const labels = {
    vaccin: 'Vaccination',
    vermifuge: 'Vermifuge',
    antiparasitaire: 'Antiparasitaire',
    veterinaire: 'Visite vétérinaire',
    vétérinaire: 'Visite vétérinaire',
    desinfection: 'Désinfection',
    désinfection: 'Désinfection',
    chirurgie: 'Chirurgie',
    analyse: 'Analyse',
    radiographie: 'Radiographie',
    autre: 'Autre',
  };
  return labels[key] || safeText(value, 'Autre');
}

function filenamePart(value) {
  return safeText(value, 'elevage')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function addPageNumbering(doc) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    doc.font('Helvetica').fontSize(8).fillColor('#666666');
    doc.text(
      `ElevagePro — Registre sanitaire — Page ${index + 1} / ${range.count}`,
      45,
      doc.page.height - 34,
      { width: doc.page.width - 90, align: 'center', lineBreak: false },
    );
  }
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - 62) doc.addPage();
}

function drawRule(doc) {
  doc.moveTo(45, doc.y).lineTo(doc.page.width - 45, doc.y).strokeColor('#D8DEE6').stroke();
  doc.moveDown(0.55);
}

function drawAnimalHeader(doc, group) {
  ensureSpace(doc, 115);
  const boxY = doc.y;
  doc.roundedRect(45, boxY, doc.page.width - 90, 88, 6).fillAndStroke('#F4F7FA', '#D8DEE6');
  const top = boxY + 12;
  doc.fillColor('#17212B').font('Helvetica-Bold').fontSize(15)
    .text(group.animal_name, 58, top, { width: doc.page.width - 116 });
  doc.font('Helvetica').fontSize(9).fillColor('#3D4A57');
  const details = [
    group.animal_category,
    group.breed ? `Race : ${group.breed}` : null,
    group.sex ? `Sexe : ${group.sex}` : null,
    group.birth_date ? `Né(e) le : ${formatDate(group.birth_date)}` : null,
    group.chip_number ? `Identification : ${group.chip_number}` : null,
    group.lof_number ? `LOF : ${group.lof_number}` : null,
    group.status ? `Statut : ${group.status}` : null,
  ].filter(Boolean).join('   •   ');
  doc.text(details || 'Soin général de l’élevage', 58, top + 28, {
    width: doc.page.width - 116,
    height: 42,
    ellipsis: false,
  });
  doc.y = boxY + 102;
}

function drawCare(doc, care) {
  const contentWidth = doc.page.width - 90;
  const notes = safeText(care.notes, '');
  doc.font('Helvetica').fontSize(9);
  const notesHeight = notes
    ? doc.heightOfString(notes, { width: contentWidth - 46, lineGap: 2 }) + 39
    : 0;
  ensureSpace(doc, 60 + Math.min(notesHeight, 180));

  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#17212B')
    .text(formatDate(care.event_date), 45, startY, { width: 70 });
  doc.fillColor('#234B6B').text(normalizeType(care.type), 120, startY, { width: 115 });
  doc.fillColor('#17212B').text(safeText(care.label), 240, startY, { width: contentWidth - 195 });

  doc.font('Helvetica').fontSize(8.5).fillColor('#596675')
    .text(`Prochaine échéance : ${care.next_due ? formatDate(care.next_due) : 'non renseignée'}`, 120, startY + 20, {
      width: contentWidth - 75,
    });
  doc.y = startY + 45;

  if (notes) {
    const noteY = doc.y;
    doc.roundedRect(57, noteY, contentWidth - 24, notesHeight - 8, 4).fill('#F8FAFC');
    doc.fillColor('#3D4A57').font('Helvetica-Bold').fontSize(8.5)
      .text('Observations complètes', 68, noteY + 9, { width: contentWidth - 46 });
    doc.font('Helvetica').fontSize(9).fillColor('#17212B')
      .text(notes, 68, noteY + 25, { width: contentWidth - 46, lineGap: 2 });
    doc.y = noteY + notesHeight;
  }

  drawRule(doc);
}

async function loadRegisterData(breederId, query) {
  const values = [breederId];
  const where = ['s.breeder_id = $1'];

  if (query.type) {
    values.push(query.type);
    where.push(`LOWER(s.type) = LOWER($${values.length})`);
  }
  if (query.from) {
    values.push(query.from);
    where.push(`s.event_date >= $${values.length}`);
  }
  if (query.to) {
    values.push(query.to);
    where.push(`s.event_date <= $${values.length}`);
  }
  if (query.animal) {
    const [kind, id] = String(query.animal).split('|');
    if ((kind === 'dog' || kind === 'puppy') && id) {
      values.push(id);
      where.push(kind === 'dog' ? `s.dog_id = $${values.length}` : `s.puppy_id = $${values.length}`);
    }
  }
  if (query.include_archived !== '1') {
    where.push(`(s.dog_id IS NULL OR COALESCE(LOWER(d.status), '') <> 'sorti')`);
  }

  const [breederResult, soinsResult] = await Promise.all([
    pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]),
    pool.query(
      `SELECT s.*,
              COALESCE(d.name, p.name, 'Soins généraux de l’élevage') AS animal_name,
              CASE WHEN s.puppy_id IS NOT NULL THEN 'Chiot'
                   WHEN s.dog_id IS NOT NULL THEN 'Chien adulte'
                   ELSE 'Général'
              END AS animal_category,
              COALESCE(d.breed, p.breed) AS breed,
              COALESCE(d.sex, p.sex) AS sex,
              COALESCE(d.birth_date, p.birth_date) AS birth_date,
              COALESCE(d.chip_number, p.chip_number) AS chip_number,
              COALESCE(d.lof_number, p.lof_number) AS lof_number,
              COALESCE(d.status, p.status) AS status
       FROM soins s
       LEFT JOIN dogs d ON s.dog_id = d.id AND d.breeder_id = s.breeder_id
       LEFT JOIN puppies p ON s.puppy_id = p.id AND p.breeder_id = s.breeder_id
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(d.name, p.name, 'ZZZ'), s.event_date ASC NULLS LAST, s.id ASC`,
      values,
    ),
  ]);

  return { breeder: breederResult.rows[0] || {}, soins: soinsResult.rows };
}

exports.exportHealthRegister = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const { breeder, soins } = await loadRegisterData(breederId, req.query || {});
    const breederName = breeder.name || breeder.kennel_name || breeder.company_name || 'Élevage';
    const filename = `registre_sanitaire_${filenamePart(breederName)}_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, right: 45, bottom: 55, left: 45 },
      bufferPages: true,
      info: {
        Title: `Registre sanitaire - ${breederName}`,
        Author: breederName,
        Subject: 'Soins, vaccinations, vermifuges, antiparasitaires et visites vétérinaires',
      },
    });
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#17212B')
      .text('REGISTRE SANITAIRE', { align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#234B6B')
      .text(breederName, { align: 'center' });
    doc.moveDown(0.7);
    doc.font('Helvetica').fontSize(9).fillColor('#3D4A57');

    const breederDetails = [
      breeder.address,
      [breeder.postal_code, breeder.city].filter(Boolean).join(' '),
      breeder.siret ? `SIRET : ${breeder.siret}` : null,
      breeder.breeder_number ? `N° éleveur : ${breeder.breeder_number}` : null,
      breeder.phone,
      breeder.email,
    ].filter(Boolean).join(' — ');
    if (breederDetails) doc.text(breederDetails, { align: 'center' });
    doc.moveDown(0.7);
    doc.text(`Document édité le ${formatDate(new Date())} — ${soins.length} acte(s) sanitaire(s)`, { align: 'center' });
    doc.moveDown(1.1);
    drawRule(doc);

    if (soins.length === 0) {
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(12).fillColor('#596675')
        .text('Aucun acte sanitaire ne correspond aux critères sélectionnés.', { align: 'center' });
    } else {
      const groups = [];
      const byAnimal = new Map();
      soins.forEach((care) => {
        const key = care.dog_id ? `dog:${care.dog_id}` : care.puppy_id ? `puppy:${care.puppy_id}` : 'general';
        if (!byAnimal.has(key)) {
          const group = { ...care, cares: [] };
          byAnimal.set(key, group);
          groups.push(group);
        }
        byAnimal.get(key).cares.push(care);
      });

      groups.forEach((group, index) => {
        if (index > 0) doc.addPage();
        drawAnimalHeader(doc, group);
        group.cares.forEach((care) => drawCare(doc, care));
      });
    }

    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#17212B')
      .text('Visa et observations de contrôle');
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).fillColor('#3D4A57')
      .text('Date du contrôle : ____________________________________________');
    doc.moveDown(1.5);
    doc.text('Nom et qualité du contrôleur / vétérinaire : _________________________________');
    doc.moveDown(1.5);
    doc.text('Observations :');
    doc.moveDown(0.6);
    for (let index = 0; index < 8; index += 1) {
      doc.moveTo(45, doc.y + 12).lineTo(doc.page.width - 45, doc.y + 12).strokeColor('#BFC7D0').stroke();
      doc.moveDown(1.5);
    }
    doc.moveDown(1);
    doc.text('Signature et cachet :');

    addPageNumbering(doc);
    doc.end();
  } catch (error) {
    console.error('Erreur génération registre sanitaire PDF:', error);
    if (!res.headersSent) return res.status(500).send('Erreur lors de la génération du registre sanitaire PDF.');
    return res.end();
  }
};
