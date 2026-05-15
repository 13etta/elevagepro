const COLORS = {
  ink: '#182033',
  muted: '#667085',
  line: '#D0D5DD',
  soft: '#F4F7FB',
  accent: '#B88746',
  danger: '#B42318',
};

const PAGE = {
  left: 50,
  right: 545,
  top: 42,
  bottom: 790,
  width: 495,
};

function clean(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function money(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} EUR`;
}

function dateFr(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

function sexLabel(value) {
  if (value === 'M') return 'Mâle';
  if (value === 'F') return 'Femelle';
  return '-';
}

function safeName(value) {
  return String(value || 'animal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'animal';
}

function invoiceNumber(sale) {
  const raw = clean(sale.invoice_number, '');
  if (raw) return raw;
  const date = new Date(sale.sale_date || Date.now());
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const id = clean(sale.id, '000000').replace(/-/g, '').slice(0, 6).toUpperCase();
  return `DOC-${year}-${id}`;
}

function animalName(animal) {
  return clean(animal.name || animal.animal_name, 'Animal non nommé');
}

function animalChip(animal) {
  return clean(animal.chip_number || animal.animal_chip_number, 'En attente');
}

function animalBreed(animal) {
  return clean(animal.breed || animal.animal_breed, 'Non renseignée');
}

function animalSex(animal) {
  return sexLabel(animal.sex || animal.animal_sex);
}

function docInit(doc) {
  doc.info.Title = 'Document ElevagePro';
  doc.font('Helvetica');
  doc.fillColor(COLORS.ink);
}

function addFooter(doc) {
  const y = 806;
  doc.save();
  doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(PAGE.left, y - 12).lineTo(PAGE.right, y - 12).stroke();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7);
  doc.text('Document généré par ElevagePro - à vérifier et compléter selon le dossier réel.', PAGE.left, y, { width: PAGE.width, align: 'center' });
  doc.restore();
}

function addPageIfNeeded(doc, height = 90) {
  if (doc.y + height <= PAGE.bottom) return;
  addFooter(doc);
  doc.addPage();
  doc.y = PAGE.top;
}

function title(doc, main, subtitle) {
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9).text('ELEVAGEPRO DOCUMENTS', PAGE.left, doc.y);
  doc.moveDown(0.6);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(19).text(String(main || '').toUpperCase(), PAGE.left, doc.y, { width: PAGE.width });
  if (subtitle) {
    doc.moveDown(0.25);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(subtitle, { width: PAGE.width });
  }
  doc.moveDown(1.2);
}

function line(doc) {
  doc.strokeColor(COLORS.line).lineWidth(0.7).moveTo(PAGE.left, doc.y).lineTo(PAGE.right, doc.y).stroke();
  doc.moveDown(0.8);
}

function kv(doc, label, value, x, y, width = 220) {
  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text(String(label).toUpperCase(), x, y, { width });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(clean(value), x, y + 11, { width });
}

function box(doc, x, y, width, height, label, lines = []) {
  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke(COLORS.soft, COLORS.line);
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(8).text(String(label).toUpperCase(), x + 12, y + 10, { width: width - 24 });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.5);
  let cy = y + 28;
  lines.filter(Boolean).forEach((lineText) => {
    doc.text(String(lineText), x + 12, cy, { width: width - 24 });
    cy += 12;
  });
  doc.restore();
}

function header(doc, breeder, sale, options = {}) {
  docInit(doc);
  const sellerLines = [
    clean(breeder.company_name || breeder.name, 'Élevage'),
    breeder.affix_name ? `Affixe : ${breeder.affix_name}` : null,
    breeder.siret ? `SIRET : ${breeder.siret}` : null,
    breeder.producer_number ? `N° producteur : ${breeder.producer_number}` : null,
    breeder.address || null,
  ];
  const buyerLines = [
    clean(sale.buyer_name, 'Acquéreur non renseigné'),
    sale.buyer_address || null,
    sale.buyer_email || null,
    sale.buyer_phone || null,
  ];

  box(doc, PAGE.left, 38, 238, 96, 'Éleveur / cédant', sellerLines);
  box(doc, 307, 38, 238, 96, 'Acquéreur', buyerLines);
  doc.y = 154;
  title(doc, options.title, options.subtitle);
}

function section(doc, label) {
  addPageIfNeeded(doc, 70);
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(10).text(String(label).toUpperCase(), PAGE.left, doc.y);
  doc.moveDown(0.25);
  doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(PAGE.left, doc.y).lineTo(PAGE.right, doc.y).stroke();
  doc.moveDown(0.55);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9);
}

function paragraph(doc, textValue, options = {}) {
  addPageIfNeeded(doc, options.minHeight || 50);
  doc.fillColor(options.color || COLORS.ink).font(options.font || 'Helvetica').fontSize(options.size || 9);
  doc.text(String(textValue || ''), PAGE.left, doc.y, { width: PAGE.width, align: options.align || 'justify', lineGap: options.lineGap || 2 });
  doc.moveDown(options.after ?? 0.7);
}

function bulletList(doc, items) {
  items.filter(Boolean).forEach((item) => {
    addPageIfNeeded(doc, 30);
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(`- ${item}`, PAGE.left + 10, doc.y, { width: PAGE.width - 10, lineGap: 1 });
    doc.moveDown(0.35);
  });
  doc.moveDown(0.3);
}

function animalIdentityTable(doc, animal) {
  section(doc, 'Identification de l’animal');
  const startY = doc.y;
  const rowH = 24;
  const rows = [
    ['Nom', animalName(animal), 'Race', animalBreed(animal)],
    ['Sexe', animalSex(animal), 'Identification', animalChip(animal)],
    ['Robe', clean(animal.color || animal.animal_color), 'Catégorie', animal.animal_type === 'dog' ? 'Chien adulte' : 'Chiot / jeune'],
  ];
  rows.forEach((row, index) => {
    const y = startY + index * rowH;
    doc.rect(PAGE.left, y, PAGE.width, rowH).strokeColor(COLORS.line).stroke();
    kv(doc, row[0], row[1], PAGE.left + 8, y + 5, 220);
    kv(doc, row[2], row[3], PAGE.left + 260, y + 5, 220);
  });
  doc.y = startY + rows.length * rowH + 14;
}

function signatures(doc, labels = ['Le cédant / éleveur', 'L’acquéreur']) {
  addPageIfNeeded(doc, 135);
  doc.moveDown(1.2);
  const y = doc.y;
  doc.roundedRect(PAGE.left, y, 220, 100, 8).strokeColor(COLORS.line).stroke();
  doc.roundedRect(325, y, 220, 100, 8).strokeColor(COLORS.line).stroke();
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9).text(labels[0], PAGE.left + 12, y + 12, { width: 196 });
  doc.text(labels[1], 337, y + 12, { width: 196 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text('Date, mention et signature', PAGE.left + 12, y + 32, { width: 196 });
  doc.text('Date, mention et signature', 337, y + 32, { width: 196 });
  doc.y = y + 120;
}

function simpleTable(doc, headers, rows, widths) {
  addPageIfNeeded(doc, 50 + rows.length * 22);
  let y = doc.y;
  let x = PAGE.left;
  doc.fillColor(COLORS.soft).rect(PAGE.left, y, PAGE.width, 22).fill();
  doc.strokeColor(COLORS.line).rect(PAGE.left, y, PAGE.width, 22).stroke();
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(8);
  headers.forEach((headerText, i) => {
    doc.text(headerText, x + 6, y + 7, { width: widths[i] - 10 });
    x += widths[i];
  });
  y += 22;
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row) => {
    x = PAGE.left;
    doc.strokeColor(COLORS.line).rect(PAGE.left, y, PAGE.width, 28).stroke();
    row.forEach((cell, i) => {
      doc.fillColor(COLORS.ink).text(clean(cell), x + 6, y + 8, { width: widths[i] - 10 });
      x += widths[i];
    });
    y += 28;
  });
  doc.y = y + 10;
}

module.exports = {
  COLORS,
  PAGE,
  clean,
  money,
  dateFr,
  sexLabel,
  safeName,
  invoiceNumber,
  animalName,
  animalChip,
  animalBreed,
  animalSex,
  docInit,
  addFooter,
  addPageIfNeeded,
  header,
  line,
  section,
  paragraph,
  bulletList,
  animalIdentityTable,
  signatures,
  simpleTable,
};
