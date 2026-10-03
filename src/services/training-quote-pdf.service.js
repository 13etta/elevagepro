const { template, variablesFor, resolve, defaultTerms } = require('./training-terms.service');

const LEFT = 52;
const WIDTH = 508;
const TOP = 47;
const BOTTOM = 732;
const BRONZE = '#75552B';
const INK = '#000000';

function render(doc, data) {
  const variables = variablesFor(data.job, data.breeder);
  let pageNumber = 0;
  let currentTitle = '';
  const pageReferences = {};

  function footer() {
    const savedY = doc.y;
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 20;
    doc.font('Times-Roman').fontSize(8).fillColor('#666666');
    doc.text(`${data.job.quote_number} · ${pageNumber}`, LEFT, 756, { width: WIDTH, align: 'right', lineBreak: false });
    doc.y = savedY;
    doc.page.margins.bottom = savedBottom;
  }

  function newPage(title, continuation = false) {
    if (pageNumber) { footer(); doc.addPage(); }
    pageNumber++;
    if (!continuation) {
      const sourceIndex = template.pages.findIndex(page => page.title === title);
      if (sourceIndex >= 0) pageReferences[sourceIndex + 1] = pageNumber;
    }
    currentTitle = title;
    doc.font('Times-Bold').fontSize(23).fillColor(INK).text(title, LEFT, TOP, { width: WIDTH });
    if (continuation) doc.font('Times-Roman').fontSize(9).text('Suite', { width: WIDTH });
    doc.moveDown(0.45);
  }

  function write(text, heading = false, bold = false) {
    text = String(text).replace(/\bpage ([1-5])\b/g, (_, number) => 'page ' + (data.pageReferences?.[number] || number))
      .replace('les cinq pages du devis', `les ${data.documentPageCount || 5} pages du devis`);
    const size = heading ? 12 : 9.6;
    const font = heading || bold ? 'Times-Bold' : 'Times-Roman';
    doc.font(font).fontSize(size);
    const parts = String(text).split(/(\{\{[a-z_]+\}\})/g).filter(Boolean);
    const lines = [[]];
    let lineWidth = 0;
    for (const part of parts) {
      const dynamic = /^\{\{/.test(part);
      for (const word of resolve(part, variables).replace(/☐/g, '[ ]').split(/(\n|[^\S\n]+)/)) {
        if (!word) continue;
        if (word === '\n') { lines.push([]); lineWidth = 0; continue; }
        let chunks = [word];
        if (doc.widthOfString(word) > WIDTH) {
          chunks = [];
          let chunk = '';
          for (const character of word) {
            if (doc.widthOfString(chunk + character) > WIDTH) { chunks.push(chunk); chunk = ''; }
            chunk += character;
          }
          if (chunk) chunks.push(chunk);
        }
        for (const chunk of chunks) {
          const width = doc.widthOfString(chunk);
          if (lineWidth + width > WIDTH && lineWidth > 0) { lines.push([]); lineWidth = 0; }
          if (!lineWidth && /^\s+$/.test(chunk)) continue;
          lines.at(-1).push({ text: chunk, dynamic, width });
          lineWidth += width;
        }
      }
    }
    const lineHeight = size * 1.18 + (heading ? 0 : 1.5);
    const height = lines.length * lineHeight;
    if (doc.y + height + (heading ? 30 : 4) > BOTTOM && height < BOTTOM - TOP - 70) newPage(currentTitle, true);
    for (const line of lines) {
      if (doc.y + lineHeight > BOTTOM) newPage(currentTitle, true);
      const y = doc.y;
      let x = LEFT;
      for (const run of line) {
        doc.font(font).fontSize(size).fillColor(run.dynamic ? BRONZE : INK).text(run.text, x, y, { lineBreak: false });
        x += run.width;
      }
      doc.y = y + lineHeight;
    }
    doc.x = LEFT;
    doc.y += heading ? 4 : 5;
    doc.fillColor(INK);
  }

  function priceTable() {
    const job = data.job;
    const totalHt = Math.round(job.price_cents / (1 + Number(job.vat_rate || 0) / 100));
    const rows = [
      ['Prestations retenues et contenu', 'Qté / unité', 'PU HT €', 'TVA %', 'Total TTC €'],
      [job.service_label, '1 forfait', (totalHt / 100).toFixed(2), String(job.vat_rate), (job.price_cents / 100).toFixed(2)],
    ];
    const widths = [244, 65, 66, 52, 81];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      doc.font(rowIndex === 0 ? 'Times-Bold' : 'Times-Roman').fontSize(9);
      const height = Math.max(...row.map((cell, i) => doc.heightOfString(String(cell), { width: widths[i] - 12 }))) + 16;
      if (doc.y + height > BOTTOM) newPage(currentTitle, true);
      const y = doc.y;
      let x = LEFT;
      row.forEach((cell, i) => {
        doc.rect(x, y, widths[i], height).fillAndStroke(rowIndex === 0 ? '#EEECE7' : '#FFFFFF', '#D9D9D9');
        doc.fillColor(rowIndex === 0 ? INK : BRONZE).text(String(cell), x + 6, y + 7, { width: widths[i] - 12 });
        x += widths[i];
      });
      doc.y = y + height;
    }
    doc.x = LEFT;
    doc.moveDown(0.6);
    if (job.details?.included_services) write('Inclus dans le forfait : ' + job.details.included_services);
  }

  // Use the source's first three annexes; stored CGV remain editable on each job.
  for (const page of template.pages.slice(0, 3)) {
    newPage(page.title);
    for (const block of page.blocks) {
      // Do not select a tax regime or record a client's consent automatically.
      if (block.index === 13) {
        write(data.job.tax_note || 'Régime fiscal à renseigner dans le dossier.');
      } else {
        write(block.text, block.kind === 'heading', block.index === 4 || block.index === 12);
      }
      if (block.index === 10) priceTable();
    }
    if (page === template.pages[1] && data.job.notes) {
      write('Observations complémentaires', true);
      write(data.job.notes);
    }
  }

  const terms = data.job.terms || defaultTerms;
  const secondTitle = template.pages[4].title;
  const marker = '\n\n' + secondTitle + '\n\n';
  const splitAt = terms.indexOf(marker);
  const annexes = splitAt < 0
    ? [{ title: template.pages[3].title, text: terms }]
    : [{ title: template.pages[3].title, text: terms.slice(0, splitAt) }, { title: secondTitle, text: terms.slice(splitAt + marker.length) }];
  for (const annex of annexes) {
    newPage(annex.title);
    const text = annex.text.replace(new RegExp('^' + annex.title + '\\s*'), '');
    text.split(/\n\s*\n/).filter(Boolean).forEach(paragraph => {
      const heading = /^(9  Droit de rétractation|10  Données personnelles|Formulaire de rétractation)$/.test(paragraph);
      write(paragraph, heading);
    });
  }
  footer();
  return { pageReferences, documentPageCount: pageNumber };
}

module.exports = { render };

