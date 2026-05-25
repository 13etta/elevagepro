const { searchStatgesconTable } = require('./statgesconClient');

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreRecord(record) {
  const haystack = normalize(JSON.stringify(record.object || record.row || record));
  let score = 0;

  if (haystack.includes('cac')) score += 18;
  if (haystack.includes('cacit')) score += 22;
  if (haystack.includes('cact')) score += 20;
  if (haystack.includes('exc') || haystack.includes('excellent')) score += 12;
  if (haystack.includes('tb') || haystack.includes('tres bon')) score += 5;

  Object.values(record.object || {}).forEach((value) => {
    const n = toNumber(value);
    if (n > 0 && n < 101) score += Math.min(n / 10, 8);
  });

  return Math.min(Math.round(score), 100);
}

function summarizeDescendant(descendantName, statgesconResult) {
  const records = statgesconResult.matchedRecords || [];
  const scores = records.map(scoreRecord);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const hasResult = records.length > 0;
  const text = statgesconResult.text || '';
  const normalized = normalize(text);

  return {
    name: descendantName,
    found: hasResult,
    recordCount: records.length,
    score: maxScore,
    hasExcellent: normalized.includes('exc') || normalized.includes('excellent'),
    hasCact: normalized.includes('cact'),
    hasCacit: normalized.includes('cacit'),
    records,
    text,
  };
}

async function analyzeTransmission(descendantNames, options = {}) {
  const cleanNames = descendantNames
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name, index, arr) => arr.findIndex((value) => normalize(value) === normalize(name)) === index)
    .slice(0, 30);

  const descendants = [];
  const attempts = [];

  for (const name of cleanNames) {
    const result = await searchStatgesconTable(name, { baseUrl: options.statgesconBaseUrl });
    descendants.push(summarizeDescendant(name, result));
    attempts.push(...(result.attempts || []).map((attempt) => ({ descendant: name, ...attempt })));
  }

  const foundCount = descendants.filter((item) => item.found).length;
  const excellentCount = descendants.filter((item) => item.hasExcellent).length;
  const cactCount = descendants.filter((item) => item.hasCact).length;
  const cacitCount = descendants.filter((item) => item.hasCacit).length;
  const totalScore = descendants.reduce((sum, item) => sum + item.score, 0);
  const avgScore = descendants.length ? Math.round(totalScore / descendants.length) : 0;
  const resultRate = descendants.length ? Math.round((foundCount / descendants.length) * 100) : 0;
  const excellentRate = descendants.length ? Math.round((excellentCount / descendants.length) * 100) : 0;
  const eliteRate = descendants.length ? Math.round(((cactCount + cacitCount) / descendants.length) * 100) : 0;
  const reliability = Math.min(100, Math.round(descendants.length * 8 + foundCount * 8));

  let verdict = 'Non évaluable : aucun descendant ou résultat exploitable.';
  if (descendants.length && foundCount === 0) verdict = 'Signal nul dans StatGescon : descendants non retrouvés ou non sortis dans les tableaux.';
  else if (reliability < 35) verdict = 'Signal faible : échantillon trop réduit pour parler de transmission.';
  else if (avgScore >= 60 && resultRate >= 50) verdict = 'Bon signal de transmission : plusieurs descendants présentent des résultats exploitables.';
  else if (avgScore >= 35) verdict = 'Signal intéressant mais à consolider par plus de descendants et de disciplines.';
  else verdict = 'Transmission non démontrée statistiquement dans les données disponibles.';

  return {
    descendants,
    metrics: {
      descendantCount: descendants.length,
      foundCount,
      resultRate,
      excellentCount,
      excellentRate,
      cactCount,
      cacitCount,
      eliteRate,
      avgScore,
      reliability,
    },
    verdict,
    attempts,
  };
}

module.exports = {
  analyzeTransmission,
};
