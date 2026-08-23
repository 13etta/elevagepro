const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractPedigree,
  normalizeResearch,
  sourceTier,
} = require('../src/services/selection/openai-selection.service');

test('une URL déclarée par le texte sans citation de recherche reste non vérifiée', () => {
  const result = normalizeResearch({
    summary: '',
    missing_information: [],
    dogs: [{
      node_id: 'dog-1',
      name: 'Chien',
      analysis: '',
      claims: [{ source_url: 'https://example.com/resultat', value: 'CACIT' }],
    }],
  }, []);

  assert.equal(result.dogs[0].claims[0].cited_by_search, false);
  assert.equal(result.dogs[0].claims[0].source_tier, 'non_verifiee');
  assert.equal(result.dogs[0].claims[0].verification_status, 'a_valider');
});

test('les domaines institutionnels et spécialisés restent distingués', () => {
  assert.equal(sourceTier('https://www.centrale-canine.fr/lofselect/chien'), 'institutionnelle');
  assert.equal(sourceTier('https://www.cunca.net/resultats.html'), 'organisme_cynophile');
  assert.equal(sourceTier('https://www.setteranglais.com/chien'), 'club_de_race');
  assert.equal(sourceTier('https://pedigree.setter-anglais.fr/genealogie/arbre.php'), 'specialisee');
  assert.equal(sourceTier('https://example.com/chien'), 'externe_a_verifier');
});

test('une citation non HTTP ne devient jamais un lien cliquable', () => {
  const result = normalizeResearch({
    summary: '',
    missing_information: [],
    dogs: [{
      node_id: 'dog-1',
      name: 'Chien',
      analysis: '',
      claims: [{ source_url: 'javascript:alert(1)', value: 'Faux résultat' }],
    }],
  }, [{ url: 'javascript:alert(1)', title: 'Piège' }]);

  assert.equal(result.citations.length, 0);
  assert.equal(result.dogs[0].claims[0].cited_by_search, false);
});

test('le pedigree PDF est envoyé à Responses sans demander sa conservation', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_SELECTION_MODEL;
  const previousFetch = global.fetch;
  let requestPayload;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_SELECTION_MODEL = 'test-model';

  global.fetch = async (url, options) => {
    requestPayload = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            target_id: 'dog-1',
            document_summary: 'Pedigree de test',
            individuals: [{
              node_id: 'dog-1',
              name: 'Test',
              registration_number: '',
              sex: 'U',
              sire_id: '',
              dam_id: '',
              generation: 0,
              page: 1,
              evidence_text: 'Test',
              confidence: 1,
            }],
            warnings: [],
          }),
        };
      },
    };
  };

  try {
    const result = await extractPedigree({ originalname: 'pedigree.pdf', buffer: Buffer.from('%PDF-test') });
    assert.equal(result.model, 'test-model');
    assert.equal(requestPayload.store, false);
    assert.equal(requestPayload.input[0].content[1].type, 'input_file');
    assert.match(requestPayload.input[0].content[1].file_data, /^data:application\/pdf;base64,/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_SELECTION_MODEL;
    else process.env.OPENAI_SELECTION_MODEL = previousModel;
  }
});
