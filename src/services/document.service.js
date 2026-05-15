const PDFDocument = require('pdfkit');

const DOCUMENT_TYPES = {
  reservation: { label: 'Contrat de réservation', prefix: 'contrat_reservation' },
  facture: { label: 'Facture', prefix: 'facture' },
  'recu-acompte': { label: 'Reçu d’acompte', prefix: 'recu_acompte' },
  cession: { label: 'Attestation de cession', prefix: 'attestation_cession' },
  'attestation-cession': { label: 'Attestation de cession', prefix: 'attestation_cession', alias: 'cession' },
  'contrat-vente': { label: 'Contrat de vente', prefix: 'contrat_vente' },
  information: { label: 'Document d’information', prefix: 'information_besoins' },
  'fiche-depart': { label: 'Fiche de départ', prefix: 'fiche_depart' },
  'certificat-bonne-sante': { label: 'Fiche sanitaire de départ', prefix: 'fiche_sanitaire_depart', alias: 'fiche-depart' },
};

function resolveType(type) {
  const config = DOCUMENT_TYPES[type];
  if (!config) return null;
  if (config.alias) return { ...DOCUMENT_TYPES[config.alias], type: config.alias, requestedType: type };
  return { ...config, type, requestedType: type };
}

function text(value, fallback = '-') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function money(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
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

function drawHeader(doc, breeder, sale) {
  doc.font('Helvetica-Bold').fontSize(11).text(text(breeder.company_name || breeder.name, 'Élevage'), 50, 42);
  doc.font('Helvetica').fontSize(9);
  if (breeder.affix_name) doc.text(`Affixe : ${breeder.affix_name}`);
  if (breeder.siret) doc.text(`SIRET : ${breeder.siret}`);
  if (breeder.producer_number) doc.text(`N° producteur : ${breeder.producer_number}`);
  if (breeder.address) doc.text(breeder.address, { width: 250 });

  doc.rect(350, 42, 195, 72).stroke();
  doc.font('Helvetica-Bold').fontSize(9).text('ACQUÉREUR', 360, 50);
  doc.font('Helvetica').fontSize(9).text(text(sale.buyer_name), 360, 66, { width: 170 });
  if (sale.buyer_address) doc.text(sale.buyer_address, { width: 170 });

  doc.moveTo(50, 132).lineTo(545, 132).stroke();
  doc.y = 152;
}

function drawTitle(doc, label) {
  doc.font('Helvetica-Bold').fontSize(17).text(label.toUpperCase(), { align: 'center' });
  doc.moveDown(1.5);
}

function section(doc, label) {
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(11).text(label.toUpperCase());
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9);
}

function drawAnimal(doc, animal) {
  section(doc, 'Animal');
  doc.text(`Nom : ${text(animal.name || animal.animal_name)}`);
  doc.text(`Sexe : ${sexLabel(animal.sex || animal.animal_sex)}`);
  if (animal.color || animal.animal_color) doc.text(`Robe : ${animal.color || animal.animal_color}`);
  doc.text(`Identification : ${text(animal.chip_number || animal.animal_chip_number, 'En attente')}`);
}

function drawSale(doc, sale) {
  section(doc, 'Transaction');
  doc.text(`Date : ${dateFr(sale.sale_date)}`);
  doc.text(`Prix : ${money(sale.price)}`);
  if (Number(sale.deposit_amount || 0) > 0) doc.text(`Acompte : ${money(sale.deposit_amount)}`);
  doc.text(`Paiement : ${text(sale.payment_method)}`);
}

function drawSignatures(doc) {
  doc.moveDown(3);
  doc.font('Helvetica-Bold').fontSize(10).text('Signature éleveur', 50, doc.y);
  doc.text('Signature acquéreur', 350, doc.y - 12);
}

function drawNotes(doc, sale) {
  if (!sale.notes) return;
  section(doc, 'Notes');
  doc.text(sale.notes, { align: 'justify' });
}

function drawInformation(doc) {
  section(doc, 'Informations générales');
  [
    'Alimentation adaptée à l’âge, à l’état de santé et à l’activité.',
    'Eau propre disponible en permanence.',
    'Suivi vétérinaire régulier : vaccins, vermifuges, antiparasitaires.',
    'Socialisation progressive et cadre éducatif cohérent.',
    'Environnement propre, sécurisé et adapté aux besoins du chien.',
  ].forEach((line) => doc.text(`• ${line}`));
  doc.moveDown();
  doc.font('Helvetica-Oblique').fontSize(8).text('Document informatif. Ne remplace pas un avis vétérinaire individualisé.', { align: 'justify' });
}

function drawDeparture(doc) {
  section(doc, 'Fiche de départ');
  [
    'Conserver une alimentation stable les premiers jours.',
    'Effectuer toute transition alimentaire progressivement.',
    'Prévoir une visite vétérinaire de contrôle.',
    'Limiter les sollicitations excessives pendant l’adaptation.',
  ].forEach((line) => doc.text(`• ${line}`));
  doc.moveDown();
  doc.font('Helvetica-Oblique').fontSize(8).text('Cette fiche ne remplace pas le certificat vétérinaire officiel lorsqu’il est requis.', { align: 'justify' });
}

function renderBody(doc, template, breeder, sale, animal) {
  drawTitle(doc, template.label);
  drawAnimal(doc, animal);
  drawSale(doc, sale);

  if (template.type === 'information') drawInformation(doc);
  if (template.type === 'fiche-depart') drawDeparture(doc);
  if (template.type === 'recu-acompte') {
    section(doc, 'Reçu');
    doc.text(`Somme reçue : ${money(sale.deposit_amount || 0)}`);
    doc.text(`Reste à régler : ${money(Math.max(Number(sale.price || 0) - Number(sale.deposit_amount || 0), 0))}`);
  }

  drawNotes(doc, sale);
  drawSignatures(doc);
}

exports.getAllowedDocumentTypes = () => Object.keys(DOCUMENT_TYPES);

exports.getDocumentFilename = (docType, animal) => {
  const template = resolveType(docType) || DOCUMENT_TYPES.facture;
  return `${template.prefix}_${safeName(animal.name || animal.animal_name)}.pdf`;
};

exports.generateDocument = async (docType, breeder, sale, animal) => {
  const template = resolveType(docType);
  if (!template) throw new Error('Type de document non reconnu');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      drawHeader(doc, breeder || {}, sale || {});
      renderBody(doc, template, breeder || {}, sale || {}, animal || {});
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
