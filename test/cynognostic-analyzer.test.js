const assert = require('node:assert/strict');
const test = require('node:test');

const { analyzeCynognostic } = require('../src/services/cynognostic/analyzer');

test('une annonce ne transforme jamais une mention de résultat en fait officiel', () => {
  const analysis = analyzeCynognostic({
    announcementText: 'Setter Anglais présenté comme trialer, TAN, EXCELLENT et CACIT dans une annonce.',
  });

  assert.equal(analysis.findings.resultSignalsBySource.announcement.CACIT, 1);
  assert.equal(analysis.findings.resultSignalsBySource.announcement.TAN, 1);
  assert.deepEqual(analysis.findings.evidenceAssessment.officialFacts, []);
  assert.equal(analysis.findings.evidenceAssessment.status, 'À vérifier');
  assert.match(analysis.findings.evidenceAssessment.caution, /n.est considéré comme officiel/i);
  assert.ok(analysis.findings.missingData.some((item) => item.includes('Justificatifs officiels')));
});

test('les mentions de résultats restent rattachées à leur provenance', () => {
  const analysis = analyzeCynognostic({
    pedigreeText: 'Pedigree communiqué avec la mention CACT.',
    observations: 'Observation du conducteur : arrêt ferme et style de race. Résultat TAN rapporté.',
    announcementText: 'Annonce indiquant CACIB.',
  });

  assert.equal(analysis.findings.resultSignalsBySource.pedigree.CACT, 1);
  assert.equal(analysis.findings.resultSignalsBySource.observations.TAN, 1);
  assert.equal(analysis.findings.resultSignalsBySource.announcement.CACIB, 1);
  assert.equal(analysis.findings.resultSignals.CACT, 1);
  assert.equal(analysis.findings.resultSignals.TAN, 1);
  assert.equal(analysis.findings.resultSignals.CACIB, 1);
});

test('le registre des preuves distingue documents, déclarations et observations', () => {
  const analysis = analyzeCynognostic({
    pedigreeText: 'Ascendance transmise par le propriétaire.',
    announcementText: 'Présentation commerciale du chien.',
    observations: 'Observation datée sur le terrain.',
    sourceUrl: 'https://example.test/fiche-chien',
  });

  const sources = Object.fromEntries(
    analysis.findings.evidenceAssessment.available.map((source) => [source.key, source]),
  );

  assert.equal(sources.pedigree.evidenceType, 'Document transmis');
  assert.equal(sources.announcement.verification, 'Non vérifiée');
  assert.equal(sources.observations.evidenceType, 'Observation du sélectionneur');
  assert.equal(sources.sourceUrl.verification, 'Source à consulter et à dater');
});

test('les données absentes sont explicitement signalées comme à compléter', () => {
  const analysis = analyzeCynognostic({});

  assert.ok(analysis.findings.missingData.length >= 5);
  assert.ok(analysis.findings.missingData.every((item) => item.startsWith('[À COMPLÉTER]')));
});
