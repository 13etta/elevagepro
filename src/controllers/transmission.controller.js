const { searchSourceCandidates, fetchDogSheet, parseDescendantsText } = require('../services/cynognostic/lineageClient');
const { analyzeTransmission } = require('../services/cynognostic/transmissionAnalyzer');
const { runAutoTransmissionPipeline } = require('../services/cynognostic/autoTransmissionPipeline');

function buildPedigreeAroundUrl(url) {
  const raw = String(url || '');
  const match = raw.match(/[?&]id=(\d+)/i);
  if (!match) return '';
  return `https://pedigree.setter-anglais.fr/genealogie/arbre_autour.php?id=${match[1]}`;
}

function pickAutoDogUrl(sourceResult) {
  const candidates = sourceResult?.candidates || [];
  const pedigreeCandidate = candidates.find((candidate) => buildPedigreeAroundUrl(candidate.url));
  if (pedigreeCandidate) return buildPedigreeAroundUrl(pedigreeCandidate.url);
  const firstCandidate = candidates[0];
  return firstCandidate ? firstCandidate.url : '';
}

exports.form = async (req, res) => {
  res.render('cynognostic/transmission', {
    title: 'Transmission Cynognostic',
    dogName: '',
    dogUrl: '',
    descendantsText: '',
    sourceResult: null,
    sheetResult: null,
    transmissionResult: null,
    autoResult: null,
  });
};

exports.auto = async (req, res) => {
  const dogName = req.body.dog_name || '';

  try {
    const autoResult = await runAutoTransmissionPipeline(dogName, {
      statgesconBaseUrl: req.body.statgescon_base_url || process.env.STATGESCON_BASE_URL || 'https://statgescon.onrender.com',
    });

    return res.render('cynognostic/transmission', {
      title: 'Transmission Cynognostic',
      dogName,
      dogUrl: autoResult.dogUrl || '',
      descendantsText: (autoResult.descendants || []).join('\n'),
      sourceResult: null,
      sheetResult: autoResult.sheetResult,
      transmissionResult: autoResult.transmissionResult,
      autoResult,
    });
  } catch (error) {
    console.error('Erreur pipeline transmission autonome:', error);
    req.session.flash = { type: 'error', message: 'Pipeline autonome impossible.' };
    return res.redirect('/cynognostic/transmission');
  }
};

exports.searchDog = async (req, res) => {
  const dogName = req.body.dog_name || '';

  try {
    const sourceResult = await searchSourceCandidates(dogName, req.body.source || 'all');
    const dogUrl = pickAutoDogUrl(sourceResult);

    return res.render('cynognostic/transmission', {
      title: 'Transmission Cynognostic',
      dogName,
      dogUrl,
      descendantsText: '',
      sourceResult,
      sheetResult: null,
      transmissionResult: null,
      autoResult: null,
    });
  } catch (error) {
    console.error('Erreur recherche fiche chien:', error);
    req.session.flash = { type: 'error', message: 'Recherche de fiche chien impossible.' };
    return res.redirect('/cynognostic/transmission');
  }
};

exports.fetchSheet = async (req, res) => {
  const dogName = req.body.dog_name || '';
  const dogUrl = req.body.dog_url || '';

  try {
    const sheetResult = await fetchDogSheet(dogUrl);
    return res.render('cynognostic/transmission', {
      title: 'Transmission Cynognostic',
      dogName,
      dogUrl,
      descendantsText: sheetResult.possibleNames.join('\n'),
      sourceResult: null,
      sheetResult,
      transmissionResult: null,
      autoResult: null,
    });
  } catch (error) {
    console.error('Erreur lecture fiche chien:', error);
    req.session.flash = { type: 'error', message: 'Lecture de fiche chien impossible.' };
    return res.redirect('/cynognostic/transmission');
  }
};

exports.analyze = async (req, res) => {
  const dogName = req.body.dog_name || '';
  const dogUrl = req.body.dog_url || '';
  const descendantsText = req.body.descendants_text || '';

  try {
    const descendants = parseDescendantsText(descendantsText);
    const transmissionResult = await analyzeTransmission(descendants, {
      statgesconBaseUrl: req.body.statgescon_base_url || process.env.STATGESCON_BASE_URL || 'https://statgescon.onrender.com',
    });

    return res.render('cynognostic/transmission', {
      title: 'Transmission Cynognostic',
      dogName,
      dogUrl,
      descendantsText,
      sourceResult: null,
      sheetResult: null,
      transmissionResult,
      autoResult: null,
    });
  } catch (error) {
    console.error('Erreur analyse transmission:', error);
    req.session.flash = { type: 'error', message: 'Analyse de transmission impossible.' };
    return res.redirect('/cynognostic/transmission');
  }
};
