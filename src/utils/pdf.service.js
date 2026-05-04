const PDFDocument = require('pdfkit');

const generateInvoiceNumber = (saleId, date) => {
    const d = new Date(date);
    return `FA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${saleId.substring(0, 4).toUpperCase()}`;
};

function paragraph(doc, title, lines) {
    doc.moveDown(0.6);
    doc.fontSize(10).font('Helvetica-Bold').text(title);
    doc.font('Helvetica').fontSize(9);
    lines.forEach((line) => doc.text(`- ${line}`, { align: 'left' }));
}

exports.generateDocument = async (docType, breeder, sale, puppy) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            if (breeder?.logo_url) {
                try {
                    const response = await fetch(breeder.logo_url);
                    if (response.ok) {
                        const logoBuffer = Buffer.from(await response.arrayBuffer());
                        doc.image(logoBuffer, 50, 40, { fit: [80, 80] });
                    }
                } catch (e) { console.error('Logo ignoré'); }
            }

            doc.fontSize(10).font('Helvetica-Bold').text(breeder?.company_name || 'Élevage', 150, 40);
            doc.font('Helvetica').fontSize(9);
            if (breeder?.affix_name) doc.text(`Affixe: ${breeder.affix_name}`);
            if (breeder?.siret) doc.text(`SIRET: ${breeder.siret}`);
            doc.text(breeder?.address || '');

            doc.rect(350, 40, 200, 60).stroke();
            doc.font('Helvetica-Bold').text('CLIENT / ACQUÉREUR', 360, 45);
            doc.font('Helvetica').text(sale?.buyer_name || '', 360, 60);

            doc.moveDown(5);

            switch (docType) {
               case 'facture': {
                    const isReservation = sale.is_reservation === true || sale.is_reservation === 'true';
                    const totalPrice = parseFloat(sale.price || 0);
                    const depositPaid = parseFloat(sale.deposit_amount || 0);
                    const amountDue = isReservation ? Math.max(totalPrice - depositPaid, 0) : 0;
                    const animalKind = puppy?.sex === 'M' ? 'mâle' : puppy?.sex === 'F' ? 'femelle' : '';

                    doc.fontSize(16).font('Helvetica-Bold').text(isReservation ? 'FACTURE PROVISOIRE / RÉSERVATION' : 'FACTURE ACQUITTÉE', 50, doc.y, { align: 'center' });
                    doc.fontSize(10).font('Helvetica').text(`N° ${generateInvoiceNumber(sale.id, sale.sale_date)}`, { align: 'center' });
                    doc.moveDown(2);

                    doc.text(`Date de facturation : ${new Date(sale.sale_date).toLocaleDateString('fr-FR')}`);
                    doc.moveDown();

                    doc.rect(50, doc.y, 495, 20).fillAndStroke('#f0f0f0', '#000');
                    doc.fillColor('#000').font('Helvetica-Bold').text('Désignation', 60, doc.y - 15);
                    doc.text('Montant TTC', 450, doc.y - 15);

                    doc.moveDown(1);
                    doc.font('Helvetica').text(`${animalKind ? `Chiot ${animalKind}` : 'Animal'} - Nom : ${puppy?.name || '-'}`, 60, doc.y);
                    doc.text(`Identification : ${puppy?.chip_number || 'En attente'}`, 60, doc.y + 15);

                    doc.font('Helvetica-Bold').text(`${totalPrice.toFixed(2)} €`, 450, doc.y - 15);
                    doc.moveDown(3);

                    if (depositPaid > 0) {
                        doc.font('Helvetica').text(`Acompte / arrhes déjà versé : - ${depositPaid.toFixed(2)} €`, 300, doc.y, { align: 'right' });
                        doc.moveDown(0.5);
                    }

                    if (isReservation) {
                        doc.font('Helvetica-Bold').fontSize(12).text(`RESTE À PAYER AU DÉPART : ${amountDue.toFixed(2)} €`, 200, doc.y, { align: 'right' });
                    } else {
                        doc.font('Helvetica-Bold').fontSize(12).text('SOLDE : 0.00 €', 200, doc.y, { align: 'right' });
                        doc.moveDown(0.5);
                        doc.fontSize(14).fillColor('#198754').text('PAYÉ / ACQUITTÉ', 200, doc.y, { align: 'right' });
                        doc.fillColor('#000');
                    }

                    doc.moveDown(3);
                    doc.font('Helvetica').fontSize(9).text(`Moyen de paiement : ${sale.payment_method || '-'}`);
                    doc.text('TVA non applicable, art. 293 B du CGI.');
                    break;
                }

                case 'information': {
                    const sexLabel = puppy?.sex === 'M' ? 'Mâle' : puppy?.sex === 'F' ? 'Femelle' : '-';

                    doc.fontSize(15).font('Helvetica-Bold').text("DOCUMENT D'INFORMATION SUR LES BESOINS DE L'ANIMAL", 50, doc.y, { align: 'center' });
                    doc.fontSize(9).font('Helvetica').text('Document remis à l’acquéreur avant ou au moment de la cession, afin de l’informer sur les besoins essentiels de l’animal.', { align: 'center' });
                    doc.moveDown(1.4);

                    doc.fontSize(11).font('Helvetica-Bold').text('IDENTIFICATION DE L’ANIMAL');
                    doc.font('Helvetica').fontSize(9);
                    doc.text(`Nom : ${puppy?.name || '-'}`);
                    doc.text(`Sexe : ${sexLabel}`);
                    doc.text(`Identification : ${puppy?.chip_number || 'Non renseignée / en attente'}`);
                    if (puppy?.color) doc.text(`Robe / signes particuliers : ${puppy.color}`);

                    paragraph(doc, '1. Besoins alimentaires', [
                        'L’animal doit recevoir une alimentation adaptée à son espèce, son âge, son état physiologique, son activité et son état de santé.',
                        'Toute transition alimentaire doit être progressive afin de limiter les troubles digestifs.',
                        'De l’eau propre et fraîche doit être disponible en permanence.'
                    ]);

                    paragraph(doc, '2. Besoins sanitaires et suivi vétérinaire', [
                        'L’acquéreur doit assurer un suivi vétérinaire régulier, notamment vaccination, identification, vermifugation et protection antiparasitaire selon les recommandations du vétérinaire.',
                        'Toute modification importante de comportement, d’appétit, de locomotion ou d’état général doit conduire à consulter un vétérinaire.',
                        'Les documents sanitaires remis lors de la cession doivent être conservés.'
                    ]);

                    paragraph(doc, '3. Besoins comportementaux et sociaux', [
                        'Le chien est un animal social : il a besoin de contacts réguliers, d’éducation cohérente, de repères stables et d’interactions positives.',
                        'La socialisation doit être poursuivie progressivement avec les humains, les congénères, les environnements et les situations de vie courante.',
                        'Les méthodes brutales ou coercitives inadaptées peuvent nuire au bien-être et à l’équilibre comportemental de l’animal.'
                    ]);

                    paragraph(doc, '4. Besoins d’activité, d’exercice et d’environnement', [
                        'L’animal doit disposer d’un espace de vie propre, sécurisé, ventilé, protégé des intempéries et compatible avec ses besoins.',
                        'Il doit bénéficier de sorties, d’activité physique et de stimulations mentales adaptées à son âge, sa race, son niveau d’énergie et son état de santé.',
                        'Un chien ne doit pas être maintenu durablement dans des conditions d’isolement, d’attache ou de confinement incompatibles avec son bien-être.'
                    ]);

                    paragraph(doc, '5. Engagements et responsabilités de l’acquéreur', [
                        'L’acquéreur reconnaît avoir été informé des besoins essentiels de l’animal et s’engage à lui assurer des conditions de vie compatibles avec son bien-être.',
                        'L’acquéreur s’engage à respecter les obligations relatives à l’identification, à la garde, à la sécurité et à la protection de l’animal.',
                        'L’acquisition d’un animal engage sur plusieurs années et implique des frais réguliers : alimentation, soins vétérinaires, matériel, éducation et entretien.'
                    ]);

                    doc.moveDown(1.2);
                    doc.fontSize(9).font('Helvetica-Oblique').text('Ce document constitue une information générale. Il ne remplace pas les conseils individualisés d’un vétérinaire, d’un éducateur canin compétent ou d’un professionnel qualifié.', { align: 'justify' });

                    doc.moveDown(2);
                    doc.font('Helvetica-Bold').fontSize(10);
                    doc.text('Signature de l’Éleveur', 50, doc.y);
                    doc.text('Signature de l’Acquéreur', 350, doc.y - 10);
                    break;
                }

                case 'cession':
                    doc.fontSize(16).font('Helvetica-Bold').text('ATTESTATION DE CESSION', 50, doc.y, { align: 'center' });
                    doc.moveDown(2);

                    doc.fontSize(11).font('Helvetica-Bold').text("L'ANIMAL CÉDÉ :");
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Nom : ${puppy?.name || '-'} | Sexe : ${puppy?.sex === 'M' ? 'Mâle' : puppy?.sex === 'F' ? 'Femelle' : '-'}`);
                    doc.text(`Identification : ${puppy?.chip_number || 'Non pucé'}`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text('CONDITIONS DE CESSION :');
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Cédé le : ${new Date(sale.sale_date).toLocaleDateString('fr-FR')}`);
                    doc.text(`Prix convenu : ${sale?.price} € (${sale?.payment_method || '-'})`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text('GARANTIES LÉGALES ET DOCUMENTS REMIS :');
                    doc.font('Helvetica').fontSize(9);
                    doc.text("- Le vendeur atteste avoir remis à l'acquéreur ce jour : un certificat vétérinaire de bonne santé, un document d'information sur les besoins de l'animal, et la carte d'identification (I-CAD).");
                    doc.text("- L'animal est couvert par les vices rédhibitoires prévus par l'article L213-1 et suivants du Code rural.");
                    doc.moveDown(4);

                    doc.font('Helvetica-Bold').text('Signature du Vendeur', 50, doc.y);
                    doc.text("Signature de l'Acquéreur", 350, doc.y - 10);
                    break;

               case 'reservation':
                    doc.fontSize(16).font('Helvetica-Bold').text('CONTRAT DE RÉSERVATION', 50, doc.y, { align: 'center' });
                    doc.moveDown(2);

                    doc.fontSize(11).font('Helvetica-Bold').text('OBJET DE LA RÉSERVATION :');
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Nom provisoire : ${puppy?.name || '-'} | Sexe : ${puppy?.sex === 'M' ? 'Mâle' : puppy?.sex === 'F' ? 'Femelle' : '-'}`);
                    if (puppy?.color) doc.text(`Robe / Signes particuliers : ${puppy.color}`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text('CONDITIONS FINANCIÈRES :');
                    doc.font('Helvetica').fontSize(10);
                    doc.text(`Prix total convenu : ${sale?.price} €`);
                    doc.text(`Acompte / arrhes versé ce jour : ${sale?.deposit_amount || 0} €`);
                    doc.font('Helvetica-Bold').text(`Solde à régler au départ du chiot : ${parseFloat(sale.price || 0) - parseFloat(sale.deposit_amount || 0)} €`);
                    doc.moveDown();

                    doc.fontSize(11).font('Helvetica-Bold').text('CONDITIONS LÉGALES :');
                    doc.font('Helvetica').fontSize(9);
                    doc.text("- Cet acompte constitue un engagement ferme. En cas de désistement de l'acquéreur, l'acompte reste acquis à l'éleveur à titre de dédommagement.");
                    doc.text("- Si l'animal venait à décéder ou développer un défaut non acceptable avant la cession, l'éleveur s'engage à restituer l'intégralité de l'acompte.");
                    doc.moveDown(4);

                    doc.font('Helvetica-Bold').fontSize(10);
                    doc.text("Signature de l'Éleveur", 50, doc.y);
                    doc.text("Signature de l'Acquéreur", 350, doc.y - 10);
                    doc.font('Helvetica-Oblique').fontSize(8).text("(Faire précéder de la mention 'Bon pour accord')", 350, doc.y + 15);
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