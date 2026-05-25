const { searchStatgesconTable } = require('./statgesconClient');
const { analyzeTransmission } = require('./transmissionAnalyzer');
const { extractIdentifiersFromRecords, resolveLofSelectDog, fetchDogSheet } = require('./lineageClient');

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterProbableDescendants(names, parentName) {
  const parent = normalize(parentName);
  const blacklist = [
    'centrale canine', 'lof select', 'statgescon', 'setter anglais', 'field trial',
    'descendance', 'utilisations', 'pedigree', 'recherche chien', 'identifiant',
    'resultats', 'production', 'championnat', 'contact', 'accueil'
  ];

  return (names || [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name) => normalize(name) !== parent)
    .filter((name) => !blacklist.some((bad) => normalize(name).includes(bad)))
    .filter((name, index, arr) => arr.findIndex((value) => normalize(value) === normalize(name)) === index)
    .slice(0, 40);
}

async function runAutoTransmissionPipeline(dogName, options = {}) {
  const statgesconBaseUrl = options.statgesconBaseUrl || process.env.STATGESCON_BASE_URL || 'https://statgescon.onrender.com';

  const mainStatgescon = await searchStatgesconTable(dogName, { baseUrl: statgesconBaseUrl });
  const identifiers = extractIdentifiersFromRecords(mainStatgescon.matchedRecords || []);

  const lofResolution = await resolveLofSelectDog(dogName, identifiers);
  const dogUrl = lofResolution.bestCandidate ? lofResolution.bestCandidate.url : '';

  let sheetResult = null;
  let descendants = [];
  let transmissionResult = null;

  if (dogUrl) {
    sheetResult = await fetchDogSheet(dogUrl);
    descendants = filterProbableDescendants(sheetResult.possibleNames || [], dogName);
  }

  if (descendants.length) {
    transmissionResult = await analyzeTransmission(descendants, { statgesconBaseUrl });
  }

  const warnings = [];
  if (!mainStatgescon.matchedRecords || !mainStatgescon.matchedRecords.length) warnings.push('Chien non retrouvé dans les CSV StatGescon avec ce terme exact.');
  if (!identifiers.length) warnings.push('Aucun identifiant fiable extrait depuis StatGescon.');
  if (!dogUrl) warnings.push('Aucune fiche LOF Select résolue automatiquement.');
  if (dogUrl && (!sheetResult || !sheetResult.ok)) warnings.push('Fiche LOF Select détectée mais lecture impossible.');
  if (sheetResult && !descendants.length) warnings.push('Aucun descendant exploitable extrait automatiquement depuis LOF Select.');

  return {
    dogName,
    statgesconBaseUrl,
    mainStatgescon,
    identifiers,
    lofResolution,
    dogUrl,
    sheetResult,
    descendants,
    transmissionResult,
    warnings,
  };
}

module.exports = {
  runAutoTransmissionPipeline,
};
