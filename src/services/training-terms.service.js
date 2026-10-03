const template = require('./training-quote-template.json');
const { dateFr } = require('./documents/pdf.helpers');

// Values belong to each training job. The shared template contains no breeder data.
const variableGroups = [
  { title: 'Identité du professionnel', fields: [
    ['legal_status', 'Statut / forme juridique'], ['capital', 'Capital ou sans objet'],
    ['registration', 'Immatriculation et ville'], ['head_office', 'Siège social ou identique'],
    ['vat_number', 'Numéro de TVA ou sans objet'], ['professional_signatory', 'Nom et qualité du signataire'],
  ] },
  { title: 'Organisation et frais convenus', fields: [
    ['training_location', 'Adresse / terrains de travail'], ['session_volume', 'Nombre et durée des séances / jours'],
    ['work_organization', 'Fréquence, durée, repos, méthodes et matériel'],
    ['birds_cost', 'Oiseaux / terrain : inclus, non prévus ou prix TTC'],
    ['transport_cost', 'Transport : trajet, kilomètres et tarif TTC'],
    ['competition_cost', 'Engagements et déplacement du conducteur'], ['other_cost', 'Autres frais : nature, calcul et plafond TTC'],
    ['deposit_due', 'Échéance de l’acompte', 'date'], ['balance_due', 'Échéance du solde', 'date'],
    ['payment_methods', 'Moyens de paiement acceptés'],
  ] },
  { title: 'Santé, sécurité et prise en charge', fields: [
    ['vaccination_requirements', 'Vaccinations et antiparasitaires requis'],
    ['behavior_notes', 'Comportement, morsure, fugue, peur du coup de feu'],
    ['emergency_contact', 'Contact d’urgence : nom et téléphone'], ['supplied_items', 'Documents et effets remis'],
    ['emergency_limit', 'Plafond autorisé des soins urgents (€ TTC)', 'number'],
    ['conclusion_date', 'Date de conclusion du contrat', 'date'], ['signature_place', 'Lieu de conclusion / signature'],
    ['early_start_date', 'Date de démarrage anticipé demandée', 'date'],
  ] },
  { title: 'Programme de travail détaillé', fields: [
    ['break_in_schedule', 'Débourrage : durée, cadence, période et repos'],
    ['break_in_exercises', 'Débourrage : exercices retenus'], ['break_in_equipment', 'Débourrage : terrain et matériel'],
    ['break_in_objective', 'Objectif observable en fin de séjour'],
    ['birds_setup', 'Mise en présence : animaux et dispositif'], ['birds_sequences', 'Nombre indicatif de séquences'],
    ['birds_package', 'Séances ou forfait incluant la mise en présence'], ['birds_safety', 'Terrain, vent et conditions de sécurité'],
    ['boarding_program', 'Pension : nuits, alimentation, soins et visites'], ['boarding_work', 'Pension : séances et rythme'],
    ['competition_program', 'Préparation TAN / field : exercices et séances'], ['competition_included', 'Inscription, transport, présentation : inclus ou exclus'],
    ['progress_updates', 'Point d’étape : fréquence et moyen'], ['final_report', 'Format du bilan final'],
  ] },
  { title: 'Assurance, médiation et données personnelles', fields: [
    ['insurance', 'RC professionnelle : assureur, adresse, police, activités et territoire'],
    ['mediator_name', 'Médiateur effectivement conventionné'], ['mediator_address', 'Adresse postale du médiateur'],
    ['mediator_website', 'Site internet du médiateur'], ['withdrawal_link', 'Lien de rétractation en ligne ou sans objet'],
    ['privacy_email', 'Email de contact pour les données personnelles', 'email'],
  ] },
];

const variableFields = variableGroups.flatMap(group => group.fields);
const labels = {
  ...Object.fromEntries(variableFields.map(([key, label]) => [key, label])),
  client_full_name: 'Nom et prénom du client', client_address: 'Adresse du client',
  client_email: 'Email du client', client_phone: 'Téléphone du client', signature_date: 'Date de signature',
  company_name: 'Nom du professionnel', trade_name: 'Enseigne', siret: 'SIRET',
  address: 'Adresse du professionnel', phone: 'Téléphone du professionnel', email: 'Email du professionnel',
  dog_name: 'Nom du chien', dog_breed: 'Race', dog_chip: 'Identification', dog_lof: 'LOF si applicable',
  dog_sex: 'Sexe du chien', dog_birth_date: 'Date de naissance', training_objectives: 'Objectifs et niveau initial',
  feeding_notes: 'Alimentation et ration', handover_location: 'Remise du chien et bilan',
  health_notes: 'Santé et précautions', veterinarian: 'Vétérinaire habituel',
};
const defaultTerms = template.pages.slice(3).map(page => [page.title, ...page.blocks.map(block => block.text)].join('\n\n')).join('\n\n');

function parseVariables(input) {
  const values = {};
  for (const [key, label, type] of variableFields) {
    const raw = input['cgv_' + key];
    if (raw != null && typeof raw !== 'string') throw Object.assign(new Error('Champ invalide : ' + label), { status: 400 });
    const value = (raw || '').trim();
    if (value.length > 2000) throw Object.assign(new Error('Texte trop long : ' + label), { status: 400 });
    if (value && type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      throw Object.assign(new Error('Date invalide : ' + label), { status: 400 });
    }
    if (value && type === 'number' && !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value)) {
      throw Object.assign(new Error('Montant invalide : ' + label), { status: 400 });
    }
    values[key] = value;
  }
  return values;
}

function variablesFor(job, breeder) {
  const d = job.details || {};
  const values = { ...(d.quote_variables || {}) };
  for (const [key, , type] of variableFields) if (type === 'date' && values[key]) values[key] = dateFr(values[key]);
  const euros = value => (Number(value || 0) / 100).toFixed(2);
  const totalHt = Math.round(job.price_cents / (1 + Number(job.vat_rate || 0) / 100));
  return {
    ...values,
    quote_number: job.quote_number || 'Numéro attribué à l’enregistrement',
    quote_date: dateFr(job.quote_date), valid_until: dateFr(job.valid_until),
    company_name: breeder.company_name || breeder.name || '', trade_name: breeder.affix_name || breeder.company_name || breeder.name || '',
    siret: breeder.siret || '', address: breeder.address || '', phone: breeder.phone || '', email: breeder.email || '',
    privacy_email: values.privacy_email || breeder.email || '',
    client_full_name: [d.client_first_name, job.client_name].filter(Boolean).join(' '),
    client_address: job.client_address || '', client_phone: job.client_phone || '', client_email: job.client_email || '',
    dog_name: job.dog_name || '', dog_breed: job.dog_breed || '', dog_chip: job.dog_chip || '',
    dog_sex: d.dog_sex === 'M' ? 'Mâle' : d.dog_sex === 'F' ? 'Femelle' : '',
    dog_birth_date: d.dog_birth_date ? dateFr(d.dog_birth_date) : '', dog_lof: d.dog_lof || '',
    training_objectives: d.training_objectives || '', start_date: dateFr(job.start_date), end_date: dateFr(job.end_date),
    planning: `${(job.weekdays || []).map(day => ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day]).join(', ')} · ${String(job.start_time || '').slice(0, 5)}–${String(job.end_time || '').slice(0, 5)}`,
    boarding_start: `${dateFr(job.start_date)} ${String(job.start_time || '').slice(0, 5)}`,
    boarding_end: `${dateFr(job.end_date)} ${String(job.end_time || '').slice(0, 5)}`,
    feeding_notes: d.feeding_notes || '', handover_location: d.handover_location || '',
    health_notes: d.health_notes || '', veterinarian: d.veterinarian || '',
    total_ht: euros(totalHt), total_ttc: euros(job.price_cents),
    vat_summary: `${job.vat_rate || 0} % · base ${euros(totalHt)} € · TVA ${euros(job.price_cents - totalHt)} €`,
    deposit_percent: job.price_cents ? (job.deposit_cents / job.price_cents * 100).toFixed(2) : '0.00',
    deposit_amount: euros(job.deposit_cents), balance_amount: euros(job.price_cents - job.deposit_cents),
    conclusion_date_place: [values.conclusion_date, values.signature_place].filter(Boolean).join(' · '),
    signature_date: values.conclusion_date || '',
    service_reference: [job.service_label, job.quote_number].filter(Boolean).join(' · '),
    signature_blank: '________________________', withdrawal_date_blank: '________________',
  };
}

function resolve(text, variables) {
  return String(text || '').replace(/\{\{([a-z_]+)\}\}/g, (_, key) => variables[key] || `[À compléter : ${labels[key] || key.replace(/_/g, ' ')}]`);
}

module.exports = { template, variableGroups, variableFields, defaultTerms, parseVariables, variablesFor, resolve };

