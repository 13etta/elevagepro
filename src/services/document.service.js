const PDFDocument = require('pdfkit');
const templates = require('./documents/pdf.templates');
const { safeName } = require('./documents/pdf.helpers');

const DOCUMENT_TYPES = {
  reservation: { label: 'Contrat de réservation', prefix: 'contrat_reservation', renderer: 'reservation' },
  facture: { label: 'Facture', prefix: 'facture', renderer: 'facture' },
  'recu-acompte': { label: 'Reçu d’acompte', prefix: 'recu_acompte', renderer: 'recu-acompte' },
  cession: { label: 'Attestation de cession', prefix: 'attestation_cession', renderer: 'cession' },
  'attestation-cession': { label: 'Attestation de cession', prefix: 'attestation_cession', alias: 'cession' },
  'contrat-vente': { label: 'Contrat de vente', prefix: 'contrat_vente', renderer: 'contrat-vente' },
  information: { label: 'Document d’information', prefix: 'information_besoins', renderer: 'information' },
  'fiche-depart': { label: 'Fiche de départ', prefix: 'fiche_depart', renderer: 'fiche-depart' },
  'certificat-bonne-sante': { label: 'Fiche sanitaire de départ', prefix: 'fiche_sanitaire_depart', alias: 'fiche-depart' },
};

function resolveType(type) {
  const config = DOCUMENT_TYPES[type];
  if (!config) return null;
  if (config.alias) {
    const target = DOCUMENT_TYPES[config.alias];
    return { ...target, requestedType: type, type: config.alias };
  }
  return { ...config, requestedType: type, type };
}

function animalDocumentName(animal) {
  return animal?.name || animal?.animal_name || 'animal';
}

exports.getAllowedDocumentTypes = () => Object.keys(DOCUMENT_TYPES);

exports.getDocumentFilename = (docType, animal) => {
  const template = resolveType(docType) || DOCUMENT_TYPES.facture;
  return `${template.prefix}_${safeName(animalDocumentName(animal))}.pdf`;
};

exports.generateDocument = async (docType, breeder, sale, animal) => {
  const template = resolveType(docType);
  if (!template) throw new Error('Type de document non reconnu');

  const renderer = templates[template.renderer];
  if (!renderer) throw new Error('Modèle PDF introuvable');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: template.label,
          Author: 'ElevagePro',
          Subject: `${template.label} - ${animalDocumentName(animal)}`,
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      renderer(doc, breeder || {}, sale || {}, animal || {});
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
