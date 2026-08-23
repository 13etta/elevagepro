const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const viewsRoot = path.resolve(__dirname, '../src/views');

function locals(overrides = {}) {
  return {
    __: (key) => key,
    currentLang: 'fr',
    csrfToken: 'test-csrf',
    user: { name: 'Éleveur' },
    modules: [],
    moduleGroups: [],
    currentPath: '/selection-agent',
    theme: 'prestige',
    flash: null,
    formatDate: () => '23/08/2026',
    ...overrides,
  };
}

test('les nouveaux écrans de portée virtuelle se rendent avec des dossiers vides ou complets', async () => {
  const individual = {
    node_id: 'dog-1',
    name: 'Setter test',
    registration_number: 'LOF 1/1',
    sex: 'M',
    sire_id: null,
    dam_id: null,
    generation: 0,
  };
  const pedigree = { target_id: 'dog-1', individuals: [individual] };
  const analysis = {
    id: '11111111-1111-4111-8111-111111111111',
    subject_name: 'Setter test',
    source_filename: 'test.pdf',
    status: 'validated',
    coi_percent: 0,
    coi_method: 'Wright',
    completeness: { percent: 100, known_ancestors: 0, expected_ancestors: 0, is_partial: false },
    extraction: { individuals: [individual], warnings: [] },
    validated_pedigree: pedigree,
    extraction_model: 'test',
  };

  const cases = [
    ['selection-agent/index.ejs', locals({ analyses: [], validatedAnalyses: [], virtualLitters: [], aiConfigured: true })],
    ['selection-agent/show.ejs', locals({ analysis, pedigree, individuals: [individual], target: individual, warnings: [] })],
    ['selection-agent/virtual-litter-new.ejs', locals({ analyses: [], sire: null, dam: null, selectedSireId: '', selectedDamId: '', candidates: [], preview: null, sireAncestors: [], damAncestors: [] })],
    ['selection-agent/virtual-litter-show.ejs', locals({
      litter: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Portée test',
        sire_name: 'Mâle',
        dam_name: 'Femelle',
        sire_analysis_id: analysis.id,
        dam_analysis_id: '33333333-3333-4333-8333-333333333333',
        coi_percent: 0,
        coi_method: 'Wright',
        explained_percent: 0,
        completeness: { is_partial: false },
        created_at: new Date(),
      },
      commonAncestors: [],
      warnings: [],
    })],
  ];

  for (const [template, data] of cases) {
    const html = await ejs.renderFile(path.join(viewsRoot, template), data);
    assert.match(html, /ElevagePro/);
  }
});
