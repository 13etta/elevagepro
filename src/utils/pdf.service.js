const PDFDocument = require('pdfkit');

exports.generateCessionDocument = async (breeder, sale, puppy) => {
    // Attention : la fonction interne de la Promesse devient "async"
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // 1. INJECTION DU LOGO DEPUIS SUPABASE
            if (breeder?.logo_url) {
                try {
                    // Téléchargement de l'image en mémoire vive
                    const response = await fetch(breeder.logo_url);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        const logoBuffer = Buffer.from(arrayBuffer);
                        
                        // Placement de l'image centrée en haut de page (largeur max 100px)
                        doc.image(logoBuffer, (doc.page.width - 100) / 2, 40, { 
                            fit: [100, 100], 
                            align: 'center' 
                        });
                        
                        // On force le curseur de texte à descendre sous l'image
                        doc.y = 160; 
                    }
                } catch (imgError) {
                    console.error('Avertissement: Impossible d\'intégrer le logo au PDF:', imgError);
                    // En cas de problème réseau, on ne fait pas crasher le contrat, on l'imprime sans logo.
                }
            }

            // 2. ÉCRITURE DU DOCUMENT
            doc.fontSize(20).font('Helvetica-Bold').text('ATTESTATION DE CESSION', { align: 'center' });
            doc.moveDown(2);

            // Cédant (Éleveur)
            doc.fontSize(12).font('Helvetica-Bold').text('LE CÉDANT :');
            doc.font('Helvetica').fontSize(10);
            doc.text(`Élevage : ${breeder?.company_name || 'Non renseigné'}`);
            if (breeder?.affix_name) doc.text(`Affixe : ${breeder.affix_name}`);
            if (breeder?.siret) doc.text(`SIRET : ${breeder.siret}`);
            doc.text(`Adresse : ${breeder?.address || 'Non renseignée'}`);
            doc.moveDown();

            // Acquéreur
            doc.fontSize(12).font('Helvetica-Bold').text("L'ACQUÉREUR :");
            doc.font('Helvetica').fontSize(10);
            doc.text(`Nom complet : ${sale?.buyer_name || 'Non renseigné'}`);
            doc.moveDown();

            // Animal
            doc.fontSize(12).font('Helvetica-Bold').text("L'ANIMAL :");
            doc.font('Helvetica').fontSize(10);
            doc.text(`Nom : ${puppy?.name || 'Inconnu'}`);
            doc.text(`Sexe : ${puppy?.sex === 'M' ? 'Mâle' : 'Femelle'}`);
            doc.text(`Identification : ${puppy?.chip_number || 'Non pucé'}`);
            if (puppy?.color) doc.text(`Robe : ${puppy.color}`);
            doc.moveDown();

            // Conditions
            const dateVente = sale?.sale_date ? new Date(sale.sale_date).toLocaleDateString('fr-FR') : 'Non précisée';
            doc.fontSize(12).font('Helvetica-Bold').text("CONDITIONS :");
            doc.font('Helvetica').fontSize(10);
            doc.text(`Cédé le : ${dateVente}`);
            doc.text(`Prix : ${sale?.price || 0} €`);
            doc.text(`Paiement : ${sale?.payment_method || 'Non précisé'}`);
            doc.moveDown(2);

            // Rappel juridique
            doc.fontSize(8).font('Helvetica-Oblique').text(
                "Conformément à l'article L214-8 du Code rural et de la pêche maritime, la vente de tout animal de compagnie donne lieu à la remise d'une attestation de cession et d'un certificat vétérinaire de bonne santé."
            );
            
            doc.moveDown(3);
            doc.font('Helvetica-Bold').text("Signatures", { align: 'center' });

            // Finalisation
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};