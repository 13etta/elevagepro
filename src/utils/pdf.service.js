const PDFDocument = require('pdfkit');

// Fonction d'aide pour générer un numéro de facture unique basé sur la date et l'ID
const generateInvoiceNumber = (saleId, date) => {
    const d = new Date(date);
    return `FA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${saleId.substring(0, 4).toUpperCase()}`;
};

exports.generateDocument = async (docType, breeder, sale, puppy) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // --- 1. EN-TÊTE COMMUN À TOUS LES DOCUMENTS ---
            if (breeder?.logo_url) {
                try {
                    const response = await fetch(breeder.logo_url);
                    if (response.ok) {
                        const logoBuffer = Buffer.from(await response.arrayBuffer());
                        doc.image(logoBuffer, 50, 40, { fit: [80, 80] });
                    }
                } catch (e) { console.error('Logo ignoré'); }
            }

            // Coordonnées de l'élevage (en haut à gauche)
            doc.fontSize(10).font('Helvetica-Bold').text(breeder?.company_name || 'Élevage', 150, 40);
            doc.font('Helvetica').fontSize(9);
            if (breeder?.affix_name) doc.text(`Affixe: ${breeder.affix_name}`);
            if (breeder?.siret) doc.text(`SIRET: ${breeder.siret}`);
            doc.text(breeder?.address || '');

            // Coordonnées de l'acquéreur (encadré en haut à droite)
            doc.rect(350, 40, 200, 60).stroke();
            doc.font('Helvetica-Bold').text('CLIENT / ACQUÉREUR', 360, 45);
            doc.font('Helvetica').text(sale?.buyer_name || '', 360, 60);

            doc.moveDown(5); // On descend sous l'en-tête

            // --- 2. CONTENU SPÉCIFIQUE SELON LE TYPE DEMANDÉ ---
            switch (docType) {
                
                case 'facture':
                    doc.fontSize(16).font('Helvetica-Bold').text('FACTURE DE VENTE', 50, doc.y, { align: 'center' });
                    doc.fontSize(10).font('Helvetica').text(`N° ${generateInvoiceNumber(sale.id, sale.sale_date)}`, { align: 'center' });
                    doc.moveDown(2);
                    
                    doc.text(`Date de facturation : ${new Date(sale.sale_date).toLocaleDateString('fr-FR')}`);
                    doc.moveDown();
                    
                    // Tableau de facturation basique
                    doc.rect(50, doc.y, 495, 20).fillAndStroke('#f0f0f0', '#000');
                    doc.fillColor('#000').font('Helvetica-Bold').text('Désignation', 60, doc.y - 15);
                    doc.text('Montant TTC', 450, doc.y - 15);
                    
                    doc.moveDown(1);
                    doc.font('Helvetica').text(`Chiot ${puppy?.sex === 'M'?'mâle':'femelle'} - Nom : ${puppy?.name}`, 60, doc.y);
                    doc.text(`Identification : ${puppy?.chip_number}`, 60, doc.y + 15);
                    doc.font('Helvetica-Bold').text(`${sale.price} €`, 450, doc.y - 15);
                    doc.moveDown(3);

                    doc.font('Helvetica').fontSize(9).text(`Moyen de paiement : ${sale.payment_method}`);
                    doc.text("TVA non applicable, art. 293 B du CGI. (À modifier si vous êtes assujetti).");
                    break;

                case 'cession':
                    doc.fontSize(16).font('Helvetica-Bold').text('ATTESTATION DE CESSION', 50, doc.y, { align: 'center' });
                    doc.moveDown(2);
                    
                    doc.fontSize(11).font('Helvetica-Bold').text("L'ANIMAL CÉDÉ :");
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Nom : ${puppy?.name} | Sexe : ${puppy?.sex === 'M' ? 'Mâle' : 'Femelle'}`);
                    doc.text(`Identification : ${puppy?.chip_number || 'Non pucé'}`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text("CONDITIONS DE CESSION :");
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Cédé le : ${new Date(sale.sale_date).toLocaleDateString('fr-FR')}`);
                    doc.text(`Prix convenu : ${sale?.price} € (${sale?.payment_method})`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text("GARANTIES LÉGALES ET DOCUMENTS REMIS :");
                    doc.font('Helvetica').fontSize(9);
                    doc.text("- Le vendeur atteste avoir remis à l'acquéreur ce jour : un certificat vétérinaire de bonne santé, un document d'information sur les besoins de l'animal, et la carte d'identification (I-CAD).");
                    doc.text("- L'animal est couvert par les vices rédhibitoires prévus par l'article L213-1 et suivants du Code rural.");
                    doc.moveDown(4);

                    doc.font('Helvetica-Bold').text("Signature du Vendeur", 50, doc.y);
                    doc.text("Signature de l'Acquéreur", 350, doc.y - 10);
                    break;

                case 'reservation':
                    // À implémenter : Ajouter la gestion d'acompte dans la base de données
                    doc.fontSize(16).font('Helvetica-Bold').text('CONTRAT DE RÉSERVATION', 50, doc.y, { align: 'center' });
                    doc.moveDown(2);
                    doc.font('Helvetica').fontSize(10).text("Ce document atteste de la réservation du chiot...");
                    // ...
                    break;

                default:
                    throw new Error('Type de document non reconnu');
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};