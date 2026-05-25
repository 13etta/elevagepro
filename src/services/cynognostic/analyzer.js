const WORK_TERMS = ['cact', 'cacit', 'rcact', 'rcacit', 'excellent', 'exc', 'trialer', 'field', 'becasse', 'becassine', 'quete', 'arret', 'coule', 'nez', 'style', 'rasant', 'fluide', 'passion', 'initiative', 'contact'];
const BEAUTY_TERMS = ['cacs', 'cacib', 'rcacs', 'rcacib', 'champion beaute', 'confirmation', 'confirme', 'standard', 'construction', 'aplombs', 'angulations', 'ligne de dos', 'type racial'];
const HEALTH_TERMS = ['adn', 'identification genetique', 'dysplasie a', 'dys a', 'dysplasie b', 'dys b', 'apr sain', 'ncl sain', 'teste', 'testee'];

const RISK_RULES = [
  { key: 'fouet_haut', label: 'Port de fouet haut ou enroule', severity: 'Serieuse', terms: ['fouet haut', 'queue haute', 'port de queue haut', 'enroule', 'sacrum'] },
  { key: 'sagesse_fragile', label: 'Sagesse fragile a l envol ou au feu', severity: 'Serieuse', terms: ['sagesse fragile', 'part a l envol', 'poursuite', 'casse l arret', 'avance au feu'] },
  { key: 'mental_chaud', label: 'Mental chaud ou instabilite emotionnelle', severity: 'Moderee', terms: ['mental chaud', 'nerveux', 'instable', 'excitable', 'recupere mal'] },
  { key: 'quete_desordonnee', label: 'Quete desordonnee ou manque de methode', severity: 'Moderee', terms: ['quete desordonnee', 'manque de methode', 'decousu'] },
  { key: 'nez_insuffisant', label: 'Doute sur le nez ou la prise d emanation', severity: 'Serieuse', terms: ['manque de nez', 'nez insuffisant', 'ne sent pas', 'prend trop tard', 'passe le gibier'] },
  { key: 'sante_dysplasie', label: 'Signal sanitaire a verifier', severity: 'Critique', terms: ['dysplasie c', 'dys c', 'dysplasie d', 'dys d', 'dysplasie e', 'dys e', 'collateraux c'] },
  { key: 'tests_absents', label: 'Tests sante ou justificatifs absents', severity: 'Moderee', terms: ['non teste', 'pas de test', 'radios absentes', 'adn absent', 'pas adn'] },
  { key: 'resultats_flous', label: 'Resultats annonces mais non verifiables', severity: 'Moderee', terms: ['resultats unverifiables', 'annonce comme champion', 'sans preuve', 'pas de lien'] },
];

const SIGNAL_RULES = [
  { key: 'style_fort', label: 'Style racial marque', terms: ['style', 'stylee', 'rasant', 'fluide', 'expressif', 'ligne de dos'] },
  { key: 'nez_fort', label: 'Nez valorise', terms: ['nez', 'prise d emanation', 'remonte l emanation'] },
  { key: 'quete_ample', label: 'Quete ample ou prise de terrain', terms: ['grosse prise de terrain', 'grand parcours', 'ouverture', 'amplitude', 'grande quete'] },
  { key: 'mental_equilibre', label: 'Mental equilibre', terms: ['equilibre', 'calme', 'sociable', 'proche humain', 'recupere bien'] },
  { key: 'arret_qualite', label: 'Qualite d arret', terms: ['arret ferme', 'arret intense', 'bloque', 'coule'] },
];

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'");
}

function countMatches(text, terms) {
  const clean = normalize(text);
  return terms.reduce((total, term) => total + (clean.includes(normalize(term)) ? 1 : 0), 0);
}

function bounded(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function extractAffixes(text) {
  const source = String(text || '').toUpperCase();
  const matches = source.match(/\b(?:DE|DU|DES|DE LA|DE L'|D'|VON|OF)\s+[A-ZÀ-ÖØ-Ý' -]{3,}/g) || [];
  const counts = new Map();
  matches.map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item.length <= 45).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);
}

function extractResultSignals(text) {
  const clean = normalize(text).toUpperCase();
  const terms = ['CACIT', 'RCACIT', 'CACT', 'RCACT', 'EXC', 'EXCELLENT', 'TB', 'TAN', 'CACS', 'CACIB'];
  return terms.reduce((acc, term) => {
    const re = new RegExp('\\b' + term + '\\b', 'g');
    acc[term] = (clean.match(re) || []).length;
    return acc;
  }, {});
}

function buildAlerts(text) {
  const clean = normalize(text);
  return RISK_RULES.map((rule) => {
    const hits = rule.terms.filter((term) => clean.includes(normalize(term)));
    return hits.length ? { key: rule.key, label: rule.label, severity: rule.severity, evidence: hits.slice(0, 5) } : null;
  }).filter(Boolean);
}

function buildSignals(text) {
  const clean = normalize(text);
  return SIGNAL_RULES.map((rule) => {
    const hits = rule.terms.filter((term) => clean.includes(normalize(term)));
    return hits.length ? { key: rule.key, label: rule.label, evidence: hits.slice(0, 5) } : null;
  }).filter(Boolean);
}

function confidenceFromInput(input) {
  let confidence = 15;
  if (input.pedigreeText && input.pedigreeText.length > 80) confidence += 25;
  if (input.observations && input.observations.length > 80) confidence += 20;
  if (input.imageNotes && input.imageNotes.length > 40) confidence += 10;
  if (input.videoNotes && input.videoNotes.length > 40) confidence += 15;
  if (input.announcementText && input.announcementText.length > 80) confidence += 15;
  if (input.sourceUrl && input.sourceUrl.length > 10) confidence += 5;
  return bounded(confidence);
}

function buildSearchQueries(input) {
  const breed = input.breed || 'race a preciser';
  const discipline = input.discipline || 'field trial';
  const zone = input.zone || 'France';
  const sex = input.sexPreference || 'chiot chien';
  return [
    `${breed} ${sex} disponible ${zone}`,
    `${breed} portee ${discipline} ${zone}`,
    `${breed} elevage field trial ${zone}`,
    `${breed} chiots LOF tests ADN dysplasie`,
    `${breed} ${discipline} CACT CACIT descendants`,
  ];
}

function verdictFromScores(scores, alerts, confidence) {
  const hasCritical = alerts.some((alert) => alert.severity === 'Critique');
  const hasSerious = alerts.some((alert) => alert.severity === 'Serieuse');
  if (hasCritical || scores.health < 35) return 'A ecarter ou a securiser avant toute decision : risque sanitaire ou documentaire prioritaire.';
  if (scores.global >= 78 && confidence >= 60 && !hasSerious) return 'A retenir en priorite : profil coherent, signaux travail-standard favorables et risque maitrise.';
  if (scores.global >= 62) return 'A approfondir : opportunite interessante, mais preuves a completer avant achat ou reproduction.';
  if (scores.global >= 45) return 'Possible mais risque : dossier insuffisamment garanti pour un projet d elevage exigeant.';
  return 'A ecarter pour une base de selection serieuse, sauf objectif strictement loisir et prix coherent.';
}

function analyzeCynognostic(input = {}) {
  const allText = [input.pedigreeText, input.observations, input.imageNotes, input.videoNotes, input.announcementText].filter(Boolean).join('\n\n');
  const workHits = countMatches(allText, WORK_TERMS);
  const beautyHits = countMatches(allText, BEAUTY_TERMS);
  const healthHits = countMatches(allText, HEALTH_TERMS);
  const alerts = buildAlerts(allText);
  const signals = buildSignals(allText);
  const affixes = extractAffixes(input.pedigreeText || '');
  const resultSignals = extractResultSignals(allText);
  const seriousPenalty = alerts.filter((alert) => alert.severity === 'Serieuse').length * 8;
  const criticalPenalty = alerts.filter((alert) => alert.severity === 'Critique').length * 18;
  const moderatePenalty = alerts.filter((alert) => alert.severity === 'Moderee').length * 4;
  const work = bounded(38 + workHits * 6 + (resultSignals.CACT || 0) * 6 + (resultSignals.CACIT || 0) * 8 + (resultSignals.EXC || 0) * 3 - seriousPenalty);
  const beauty = bounded(38 + beautyHits * 7 + (resultSignals.CACS || 0) * 6 + (resultSignals.CACIB || 0) * 8 - Math.floor(seriousPenalty / 2));
  const health = bounded(42 + healthHits * 10 - criticalPenalty - moderatePenalty);
  const pedigree = bounded(35 + affixes.length * 4 + Object.values(resultSignals).reduce((sum, value) => sum + Math.min(value, 4), 0) * 2);
  const strategic = bounded((work * 0.38) + (beauty * 0.16) + (health * 0.24) + (pedigree * 0.22));
  const confidence = confidenceFromInput(input);
  const global = bounded((strategic * 0.78) + (confidence * 0.22));
  const scores = { global, work, beauty, health, pedigree, strategic, confidence };
  const missingData = [];
  if (!input.pedigreeText || input.pedigreeText.length < 80) missingData.push('Pedigree complet sur 4 ou 5 generations');
  if (!input.sourceUrl) missingData.push('Lien source officiel ou annonce publique');
  if (!input.observations || input.observations.length < 80) missingData.push('Retour terrain structure');
  if (!input.imageNotes) missingData.push('Photos exploitables pour lecture morphologique indicative');
  if (!input.videoNotes) missingData.push('Video pour confirmer allure, quete, port de fouet et style');
  return {
    scores,
    alerts,
    findings: {
      signals,
      affixes,
      resultSignals,
      missingData,
      searchQueries: buildSearchQueries(input),
      beautyReading: beauty >= 70 ? 'Conformite beaute estimee bonne a tres bonne, a confirmer par examen reel.' : beauty >= 50 ? 'Conformite beaute possible mais non securisee.' : 'Conformite beaute insuffisamment documentee ou douteuse.',
      workReading: work >= 70 ? 'Signal travail fort.' : work >= 50 ? 'Signal travail exploitable mais a consolider.' : 'Signal travail insuffisant pour conclure serieusement.',
      transmissionReading: 'La transmission doit etre validee avec descendants identifies, volume de presentations, taux EXC/CACT/CACIT et recurrence des qualites ou defauts.',
    },
    verdict: verdictFromScores(scores, alerts, confidence),
  };
}

module.exports = { analyzeCynognostic, buildSearchQueries };
