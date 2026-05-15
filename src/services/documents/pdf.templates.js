const {
  clean,
  money,
  dateFr,
  invoiceNumber,
  animalName,
  animalChip,
  header,
  section,
  paragraph,
  bulletList,
  animalIdentityTable,
  signatures,
  simpleTable,
  addFooter,
} = require('./pdf.helpers');

function renderInvoice(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: sale.is_reservation ? 'Facture pro forma' : 'Facture acquittée',
    subtitle: `N° ${invoiceNumber(sale)} - Date : ${dateFr(sale.sale_date)}`,
  });

  section(doc, 'Objet');
  paragraph(doc, `Facturation relative à la cession ou réservation de l’animal ${animalName(animal)}, identifié sous le numéro ${animalChip(animal)}.`);

  section(doc, 'Détail financier');
  const total = Number(sale.price || 0);
  const deposit = Number(sale.deposit_amount || 0);
  const balance = Math.max(total - deposit, 0);
  simpleTable(
    doc,
    ['Désignation', 'Qté', 'Montant'],
    [
      [`Animal : ${animalName(animal)}`, '1', money(total)],
      deposit > 0 ? ['Acompte / arrhes déjà versé', '1', `-${money(deposit)}`] : null,
      [sale.is_reservation ? 'Reste à régler' : 'Net à payer', '', sale.is_reservation ? money(balance) : money(0)],
    ].filter(Boolean),
    [315, 55, 125],
  );

  section(doc, 'Règlement');
  paragraph(doc, `Mode de paiement : ${clean(sale.payment_method)}. ${sale.is_reservation ? 'Ce document accompagne une réservation et ne vaut pas cession définitive.' : 'Le règlement est réputé acquitté sous réserve d’encaissement effectif.'}`);
  paragraph(doc, 'TVA non applicable, art. 293 B du CGI, sauf régime fiscal différent indiqué par l’éleveur.', { font: 'Helvetica-Oblique', size: 8 });
  addFooter(doc);
}

function renderDepositReceipt(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Reçu d’acompte / arrhes',
    subtitle: `Réservation de ${animalName(animal)} - ${dateFr(sale.sale_date)}`,
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Somme reçue');
  paragraph(doc, `L’éleveur reconnaît avoir reçu de ${clean(sale.buyer_name, 'l’acquéreur')} la somme de ${money(sale.deposit_amount || 0)} au titre de la réservation de l’animal désigné ci-dessus.`);
  simpleTable(
    doc,
    ['Prix total convenu', 'Acompte reçu', 'Reste à régler'],
    [[money(sale.price), money(sale.deposit_amount || 0), money(Math.max(Number(sale.price || 0) - Number(sale.deposit_amount || 0), 0))]],
    [165, 165, 165],
  );

  section(doc, 'Conditions de réservation');
  bulletList(doc, [
    'La réservation engage les parties selon les conditions convenues au jour de la signature.',
    'La cession définitive sera établie au départ de l’animal, sous réserve du dossier administratif et sanitaire.',
    'Toute condition particulière doit être mentionnée dans les notes ou dans un avenant signé par les parties.',
  ]);
  signatures(doc);
  addFooter(doc);
}

function renderTransferCertificate(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Attestation de cession',
    subtitle: 'Document de transfert entre le cédant et l’acquéreur',
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Déclaration de cession');
  paragraph(doc, `Le cédant atteste céder à ${clean(sale.buyer_name, 'l’acquéreur')} l’animal désigné ci-dessus, à la date du ${dateFr(sale.sale_date)}, pour le montant convenu de ${money(sale.price)}.`);

  section(doc, 'Pièces et informations associées');
  bulletList(doc, [
    'Identification de l’animal ou procédure d’identification en cours selon le dossier.',
    'Informations relatives aux besoins essentiels de l’animal remises à l’acquéreur.',
    'Documents sanitaires et administratifs disponibles remis ou transmis selon le dossier réel.',
    'Conditions particulières éventuelles mentionnées dans le dossier de vente.',
  ]);

  section(doc, 'Engagement de l’acquéreur');
  paragraph(doc, 'L’acquéreur déclare recevoir les informations nécessaires à l’accueil de l’animal et s’engage à lui assurer des conditions de vie compatibles avec ses besoins physiologiques, comportementaux et sanitaires.');
  signatures(doc);
  addFooter(doc);
}

function renderSaleContract(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Contrat de vente d’un chien',
    subtitle: 'Contrat à compléter, vérifier et signer par les parties',
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Article 1 - Objet');
  paragraph(doc, `Le présent contrat a pour objet la vente de l’animal ${animalName(animal)}, identifié sous le numéro ${animalChip(animal)}, par l’éleveur à ${clean(sale.buyer_name, 'l’acquéreur')}.`);

  section(doc, 'Article 2 - Prix et règlement');
  paragraph(doc, `Le prix convenu est fixé à ${money(sale.price)}. Le mode de paiement déclaré est : ${clean(sale.payment_method)}.`);
  if (Number(sale.deposit_amount || 0) > 0) {
    paragraph(doc, `Un acompte / arrhes de ${money(sale.deposit_amount)} a été versé. Le solde restant dû est de ${money(Math.max(Number(sale.price || 0) - Number(sale.deposit_amount || 0), 0))}.`);
  }

  section(doc, 'Article 3 - Remise de l’animal');
  bulletList(doc, [
    'La remise de l’animal intervient à la date convenue entre les parties.',
    'L’acquéreur reconnaît avoir pu obtenir les informations nécessaires concernant l’animal, son état connu, son alimentation et ses besoins.',
    'Les documents disponibles sont remis selon l’état du dossier : identification, éléments sanitaires, fiche de départ et informations de besoins.',
  ]);

  section(doc, 'Article 4 - Obligations de l’acquéreur');
  bulletList(doc, [
    'Assurer à l’animal un logement propre, sécurisé et adapté.',
    'Assurer nourriture, abreuvement, soins vétérinaires et suivi sanitaire.',
    'Respecter les besoins comportementaux et sociaux du chien.',
    'Informer l’éleveur de toute difficulté majeure lorsqu’un suivi a été convenu.',
  ]);

  section(doc, 'Article 5 - Conditions particulières');
  paragraph(doc, clean(sale.notes, 'Aucune condition particulière renseignée.'), { align: 'left' });
  signatures(doc);
  addFooter(doc);
}

function renderReservationContract(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Contrat de réservation',
    subtitle: 'Document préalable à la cession définitive',
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Réservation');
  paragraph(doc, `${clean(sale.buyer_name, 'L’acquéreur')} réserve l’animal désigné ci-dessus. Cette réservation ne vaut pas cession définitive tant que le départ de l’animal, les documents et le solde éventuel ne sont pas régularisés.`);
  simpleTable(
    doc,
    ['Prix convenu', 'Acompte / arrhes', 'Reste dû'],
    [[money(sale.price), money(sale.deposit_amount || 0), money(Math.max(Number(sale.price || 0) - Number(sale.deposit_amount || 0), 0))]],
    [165, 165, 165],
  );

  section(doc, 'Conditions');
  bulletList(doc, [
    'L’animal est réservé au profit de l’acquéreur nommé dans le présent document.',
    'Le départ définitif suppose un dossier administratif et sanitaire conforme aux obligations applicables.',
    'En cas d’impossibilité majeure, les parties conviennent d’une restitution ou d’un report selon accord écrit.',
  ]);
  signatures(doc);
  addFooter(doc);
}

function renderInformationDocument(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Document d’information sur les besoins de l’animal',
    subtitle: 'Support pédagogique remis à l’acquéreur',
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Besoins physiologiques');
  bulletList(doc, [
    'Alimentation adaptée à l’âge, au format, à l’activité et à l’état de santé.',
    'Eau propre et fraîche disponible en permanence.',
    'Repos suffisant dans un espace calme, propre et sécurisé.',
    'Suivi vétérinaire régulier : vaccination, vermifugation, antiparasitaires, contrôle de l’état général.',
  ]);

  section(doc, 'Besoins comportementaux');
  bulletList(doc, [
    'Socialisation progressive et respect du rythme d’adaptation.',
    'Éducation cohérente, stable et sans brutalité.',
    'Activité physique adaptée à l’âge et à la race.',
    'Stimulation mentale régulière et prévention de l’isolement prolongé.',
  ]);

  section(doc, 'Recommandations au départ');
  bulletList(doc, [
    'Conserver les habitudes alimentaires les premiers jours.',
    'Prévoir une visite vétérinaire de contrôle.',
    'Éviter les sollicitations excessives pendant la période d’intégration.',
    'Contacter l’éleveur ou un vétérinaire en cas de doute important.',
  ]);
  paragraph(doc, 'Ce document est informatif et ne remplace pas un avis vétérinaire individualisé.', { font: 'Helvetica-Oblique', size: 8 });
  signatures(doc, ['Éleveur - document remis', 'Acquéreur - document reçu']);
  addFooter(doc);
}

function renderDepartureSheet(doc, breeder, sale, animal) {
  header(doc, breeder, sale, {
    title: 'Fiche de départ',
    subtitle: 'Suivi pratique remis lors du départ de l’animal',
  });

  animalIdentityTable(doc, animal);
  section(doc, 'Départ');
  simpleTable(
    doc,
    ['Élément', 'Information'],
    [
      ['Date de départ / transaction', dateFr(sale.sale_date)],
      ['Acquéreur', clean(sale.buyer_name)],
      ['Mode de règlement', clean(sale.payment_method)],
      ['Prix déclaré', money(sale.price)],
    ],
    [185, 310],
  );

  section(doc, 'Conseils de transition');
  bulletList(doc, [
    'Maintenir une alimentation identique les premiers jours, puis transitionner progressivement si nécessaire.',
    'Installer l’animal dans un espace calme, propre et sécurisé.',
    'Surveiller appétit, transit, comportement et état général durant la première semaine.',
    'Prévoir un contrôle vétérinaire selon les délais recommandés.',
  ]);

  section(doc, 'Suivi sanitaire');
  bulletList(doc, [
    'Les vaccins, vermifuges, antiparasitaires et soins doivent être poursuivis selon les recommandations vétérinaires.',
    'Cette fiche ne remplace pas le certificat vétérinaire officiel lorsqu’il est requis.',
    'Les documents sanitaires disponibles doivent être remis ou transmis avec le dossier de l’animal.',
  ]);
  if (sale.notes) {
    section(doc, 'Observations particulières');
    paragraph(doc, sale.notes, { align: 'left' });
  }
  signatures(doc, ['Éleveur', 'Acquéreur']);
  addFooter(doc);
}

module.exports = {
  facture: renderInvoice,
  'recu-acompte': renderDepositReceipt,
  cession: renderTransferCertificate,
  'contrat-vente': renderSaleContract,
  reservation: renderReservationContract,
  information: renderInformationDocument,
  'fiche-depart': renderDepartureSheet,
};
