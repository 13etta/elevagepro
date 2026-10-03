const COLORS = { ink: '#000000', muted: '#666666', line: '#D5D5D5', soft: '#EEECE8', accent: '#75552B', danger: '#B42318' };
const PAGE = { left: 52, right: 560, top: 47, bottom: 732, width: 508 };

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


function geometry(doc) {
  const { margins, width, height } = doc.page;
  return { left: margins.left, width: width - margins.left - margins.right, bottom: height - margins.bottom };
}
function docInit(doc) {
  doc.font('Times-Roman').fontSize(10.5).fillColor(COLORS.ink);
}
function addFooter(doc) {
  // Run once after rendering: include pages PDFKit creates for long paragraphs.
  const range = doc.bufferedPageRange(), original = { x: doc.x, y: doc.y };
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const g = geometry(doc), bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Times-Roman').fontSize(8).fillColor(COLORS.muted)
      .text(`${doc._documentReference || 'ElevagePro'} · ${index + 1} / ${range.count}`,
        g.left, doc.page.height - 35, { width: g.width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.switchToPage(range.start + range.count - 1);
  doc.x = original.x; doc.y = original.y;
  docInit(doc);
}
function addPageIfNeeded(doc, height = 90) {
  if (doc.y + height <= geometry(doc).bottom) return;
  doc.addPage();
  docInit(doc);
}
function title(doc, main, subtitle) {
  const g = geometry(doc);
  doc.font('Times-Bold').fontSize(25).fillColor(COLORS.ink)
    .text(String(main || ''), g.left, doc.y, { width: g.width });
  doc.moveDown(0.35);
  if (subtitle) paragraph(doc, subtitle, { color: COLORS.accent, size: 10, after: 0.5 });
}
function line(doc) {
  const g = geometry(doc);
  doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(g.left, doc.y).lineTo(g.left + g.width, doc.y).stroke();
  doc.y += 8;
}
function kv(doc, label, value, x, y, width = 220) {
  doc.font('Times-Roman').fontSize(10.5).fillColor(COLORS.ink)
    .text(`${label} : `, x, y, { width, continued: true })
    .fillColor(COLORS.accent).text(clean(value));
}
function header(doc, breeder, sale, options = {}) {
  docInit(doc);
  doc._variableValues = [sale.buyer_name, sale.payment_method, dateFr(sale.sale_date),
    money(sale.price), money(sale.deposit_amount || 0),
    money(Math.max(Number(sale.price || 0) - Number(sale.deposit_amount || 0), 0))].filter(Boolean);
  doc._documentReference = invoiceNumber(sale);
  title(doc, options.title, options.subtitle);
  section(doc, 'Le professionnel et le client');
  const seller = [
    clean(breeder.company_name || breeder.name, 'Élevage'),
    breeder.affix_name ? `Affixe : ${breeder.affix_name}` : null,
    breeder.siret ? `SIRET : ${breeder.siret}` : null,
    breeder.producer_number ? `N° producteur : ${breeder.producer_number}` : null,
    breeder.address, breeder.email, breeder.phone,
  ].filter(Boolean);
  const buyer = [clean(sale.buyer_name, 'Acquéreur non renseigné'), sale.buyer_address, sale.buyer_email, sale.buyer_phone].filter(Boolean);
  paragraph(doc, `${options.sellerLabel || 'Éleveur / cédant'} : ${seller.join(' · ')}`, { color: COLORS.accent, after: 0.35 });
  paragraph(doc, `${options.buyerLabel || 'Acquéreur'} : ${buyer.join(' · ')}`, { color: COLORS.accent, after: 0.5 });
}
function section(doc, label) {
  addPageIfNeeded(doc, 65);
  const g = geometry(doc);
  doc.font('Times-Bold').fontSize(13).fillColor(COLORS.ink)
    .text(String(label), g.left, doc.y, { width: g.width });
  doc.moveDown(0.3);
  docInit(doc);
}
function paragraph(doc, value, options = {}) {
  addPageIfNeeded(doc, options.minHeight || 35);
  const g = geometry(doc);
  const fonts = { 'Helvetica-Oblique': 'Times-Italic', 'Helvetica-Bold': 'Times-Bold', Helvetica: 'Times-Roman' };
  doc.fillColor(options.color || COLORS.ink).font(fonts[options.font] || options.font || 'Times-Roman').fontSize(options.size || 10.5);
  const text = String(value || '');
  const values = [...new Set([...(doc._variableValues || []), ...(options.variables || [])])].filter(value => value !== '-').sort((a, b) => b.length - a.length);
  const escaped = values.map(value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = !options.color && escaped.length ? text.split(new RegExp('(' + escaped.join('|') + ')', 'g')).filter(Boolean) : [text];
  parts.forEach((part, index) => {
    doc.fillColor(options.color || (values.includes(part) ? COLORS.accent : COLORS.ink));
    const config = { width: g.width, align: options.align || 'left', lineGap: options.lineGap ?? 2, continued: index < parts.length - 1 };
    if (index === 0) doc.text(part, g.left, doc.y, config);
    else doc.text(part, config);
  });
  doc.moveDown(options.after ?? 0.5);
}
function bulletList(doc, items) {
  const g = geometry(doc);
  doc.font('Times-Roman').fontSize(10.5);
  const height = items.filter(Boolean).reduce((sum, item) => sum + doc.heightOfString(`- ${item}`, { width: g.width, lineGap: 2 }) + 4, 0);
  if (height < g.bottom - doc.page.margins.top) addPageIfNeeded(doc, height + 8);
  items.filter(Boolean).forEach(item => paragraph(doc, `- ${item}`, { after: 0.25 }));
  doc.y += 4;
}
function animalIdentityTable(doc, animal) {
  doc._variableValues = [...(doc._variableValues || []), animalName(animal), animalChip(animal)];
  section(doc, 'Identification de l’animal');
  doc._variableValues.push(animalBreed(animal), animalSex(animal), clean(animal.color || animal.animal_color), animal.animal_type === 'dog' ? 'Chien adulte' : 'Chiot / jeune');
  paragraph(doc, `Nom : ${animalName(animal)} · Race : ${animalBreed(animal)} · Sexe : ${animalSex(animal)}`, { after: 0.25 });
  paragraph(doc, `Identification : ${animalChip(animal)} · Robe : ${clean(animal.color || animal.animal_color)}`, { after: 0.25 });
  paragraph(doc, `Catégorie : ${animal.animal_type === 'dog' ? 'Chien adulte' : 'Chiot / jeune'}`, { after: 0.5 });
}
function signatures(doc, labels = ['Le cédant / éleveur', 'L’acquéreur']) {
  addPageIfNeeded(doc, 105);
  const g = geometry(doc), y = doc.y + 8, gap = 24, width = (g.width - gap) / 2;
  labels.forEach((label, i) => {
    const x = g.left + i * (width + gap);
    doc.font('Times-Bold').fontSize(10.5).fillColor(COLORS.ink).text(label, x, y, { width });
    doc.font('Times-Roman').fontSize(9).text('Date, mention et signature', x, y + 20, { width });
    doc.strokeColor(COLORS.line).moveTo(x, y + 78).lineTo(x + width, y + 78).stroke();
  });
  doc.y = y + 92;
}
function simpleTable(doc, headers, rows, requestedWidths) {
  const g = geometry(doc), total = requestedWidths.reduce((sum, width) => sum + width, 0);
  const widths = requestedWidths.map(width => width / total * g.width);
  const heightOf = (row, bold) => {
    doc.font(bold ? 'Times-Bold' : 'Times-Roman').fontSize(10);
    return Math.max(26, ...row.map((value, i) => doc.heightOfString(clean(value), { width: widths[i] - 14, lineGap: 2 }) + 14));
  };
  const draw = (row, bold) => {
    const height = heightOf(row, bold), y = doc.y;
    if (bold) doc.fillColor(COLORS.soft).rect(g.left, y, g.width, height).fill();
    let x = g.left;
    row.forEach((value, i) => {
      doc.strokeColor(COLORS.line).lineWidth(0.5).rect(x, y, widths[i], height).stroke();
      doc.fillColor(bold ? COLORS.ink : COLORS.accent)
        .text(clean(value), x + 7, y + 7, { width: widths[i] - 14, lineGap: 2 });
      x += widths[i];
    });
    doc.y = y + height;
  };
  // Split oversized cells into lines so a single long value cannot cross a table border.
  const splitCell = (value, width) => {
    doc.font('Times-Roman').fontSize(10);
    const lines = []; let line = '';
    for (const token of clean(value).split(/(\s+)/)) {
      for (const char of token) {
        if (char === '\n') { lines.push(line); line = ''; continue; }
        if (doc.widthOfString(line + char) > width && line) { lines.push(line.trimEnd()); line = ''; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
    return lines;
  };
  const headerHeight = heightOf(headers, true);
  addPageIfNeeded(doc, headerHeight + 30);
  draw(headers, true);
  for (const row of rows) {
    const height = heightOf(row, false);
    if (height <= geometry(doc).bottom - doc.page.margins.top - headerHeight) {
      if (doc.y + height > geometry(doc).bottom) { doc.addPage(); draw(headers, true); }
      draw(row, false);
    } else {
      const lines = row.map((value, i) => splitCell(value, widths[i] - 14));
      let offset = 0;
      const count = Math.max(...lines.map(cell => cell.length));
      while (offset < count) {
        if (doc.y + 45 > geometry(doc).bottom) { doc.addPage(); draw(headers, true); }
        const capacity = Math.max(1, Math.floor((geometry(doc).bottom - doc.y - 16) / 15));
        const part = lines.map(cell => cell.slice(offset, offset + capacity).join('\n'));
        draw(part, false); offset += capacity;
      }
    }
  }
  doc.y += 10;
}
module.exports = { COLORS, PAGE, clean, money, dateFr, sexLabel, safeName, invoiceNumber,
  animalName, animalChip, animalBreed, animalSex, docInit, addFooter, addPageIfNeeded,
  header, title, line, section, paragraph, bulletList, kv, animalIdentityTable, signatures, simpleTable };

