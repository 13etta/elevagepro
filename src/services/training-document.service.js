const PDFDocument = require('pdfkit');
const {header,section,paragraph,simpleTable,signatures,addFooter,dateFr,money} = require('./documents/pdf.helpers');
const titles={quote:'Devis de dressage',contract:'Contrat de dressage','deposit-invoice':'Facture d’acompte',invoice:'Facture de dressage',credit:'Avoir de remboursement'};
function render(doc,data) {
  const {job,breeder,total,kind,number,payments}=data;
  const details=job.details||{};
  header(doc,breeder,{buyer_name:[details.client_first_name,job.client_name].filter(Boolean).join(' '),buyer_address:job.client_address,buyer_email:job.client_email,buyer_phone:job.client_phone},{title:titles[kind],subtitle:`N° ${number} — ${dateFr(kind==='quote'?job.quote_date||data.issued_on:data.issued_on)} — Référence ${job.quote_number}`,sellerLabel:'Prestataire',buyerLabel:'Client'});
  if(kind==='quote' && job.valid_until) paragraph(doc,`Devis valable jusqu’au ${dateFr(job.valid_until)}.`);
  section(doc,'Chien et prestation');
  paragraph(doc,`${job.dog_name} • ${job.dog_breed || 'Race non renseignée'} • Identification : ${job.dog_chip || 'Non renseignée'}`);
  if(details.dog_sex||details.dog_birth_date||details.dog_lof) paragraph(doc,[details.dog_sex?`Sexe : ${details.dog_sex==='M'?'mâle':'femelle'}`:null,details.dog_birth_date?`Né le ${dateFr(details.dog_birth_date)}`:null,details.dog_lof?`LOF : ${details.dog_lof}`:null].filter(Boolean).join(' • '));
  paragraph(doc,`${job.service_label} du ${dateFr(job.start_date)} au ${dateFr(job.end_date)}, ${String(job.start_time).slice(0,5)}–${String(job.end_time).slice(0,5)}. Jours : ${job.weekdays.map(d=>['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][d]).join(', ')}.`);
  section(doc,'Détail financier');
  const refund = data.creditPayment?.amount_cents || 0;
  const amount = kind==='deposit-invoice' ? total.deposits : kind==='credit' ? refund : job.price_cents;
  const ht = Math.round(amount/(1+Number(job.vat_rate)/100));
  simpleTable(doc,['Désignation','Montant'],[[kind==='deposit-invoice'?'Acompte':kind==='credit'?'Remboursement':job.service_label,money(amount/100)],['Total HT',money(ht/100)],[`TVA ${job.vat_rate} %`,money((amount-ht)/100)],['Total TTC',money(amount/100)]],[345,150]);
  if(kind==='quote'||kind==='contract') paragraph(doc,`Acompte exigé : ${money(job.deposit_cents/100)}. Solde après acompte : ${money((job.price_cents-job.deposit_cents)/100)}.`);
  if(kind==='invoice') paragraph(doc,`Règlements reçus : ${money(total.received/100)}. Reste à payer à l’émission : ${money((job.price_cents-total.received)/100)}. L’acompte est compris dans les règlements reçus.`);
  if(job.tax_note) paragraph(doc,job.tax_note);
  if(details.training_objectives){section(doc,'Travail convenu');paragraph(doc,details.training_objectives);}
  if(details.accommodation||details.included_services||details.handover_location){section(doc,'Accueil et contenu de la prestation');
    if(details.accommodation) paragraph(doc,`Accueil : ${details.accommodation}`);
    if(details.included_services) paragraph(doc,`Inclus : ${details.included_services}`);
    if(details.handover_location) paragraph(doc,`Lieu de remise : ${details.handover_location}`);
  }
  if(details.health_notes||details.feeding_notes||details.veterinarian){section(doc,'Informations sur le chien confié');
    if(details.health_notes) paragraph(doc,`Santé et précautions : ${details.health_notes}`);
    if(details.feeding_notes) paragraph(doc,`Alimentation : ${details.feeding_notes}`);
    if(details.veterinarian) paragraph(doc,`Vétérinaire habituel : ${details.veterinarian}`);
  }
  if(details.payment_terms){section(doc,'Modalités de règlement');paragraph(doc,details.payment_terms);}
  if(job.notes){section(doc,'Objectifs et observations');paragraph(doc,job.notes);}
  if(job.terms){section(doc,'Conditions convenues');paragraph(doc,job.terms);}
  if(kind==='quote'||kind==='contract') signatures(doc,['Le prestataire','Le client — bon pour accord']);
  addFooter(doc);
}
async function generate(data) {
  return new Promise((resolve,reject)=>{
    const doc = new PDFDocument({size:'A4',margin:50,bufferPages:true,info:{Title:titles[data.kind],Author:data.breeder.company_name || 'ElevagePro'}});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    try {render(doc,data);doc.end();}catch(error){reject(error);}
  });
}
module.exports={generate,render};
