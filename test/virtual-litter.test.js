const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateVirtualLitter,
  manualMatchCandidate,
  matchCandidates,
  selectedCandidates,
} = require('../src/services/selection/virtual-litter.service');

function dog(nodeId, name, registration, sireId = null, damId = null, generation = 0, sex = 'U') {
  return {
    node_id: nodeId,
    name,
    registration_number: registration,
    sire_id: sireId,
    dam_id: damId,
    generation,
    sex,
  };
}

test('une portée entre frère et sœur germains produit 25 % avec deux ancêtres communs', () => {
  const sirePedigree = {
    target_id: 'male',
    individuals: [
      dog('male', 'Mâle', 'LOF 100/1', 'sire-a', 'sire-b', 0, 'M'),
      dog('sire-a', 'Ancêtre A', 'LOF 200/2', null, null, 1, 'M'),
      dog('sire-b', 'Ancêtre B', 'LOF 300/3', null, null, 1, 'F'),
    ],
  };
  const damPedigree = {
    target_id: 'female',
    individuals: [
      dog('female', 'Femelle', 'LOF 101/1', 'dam-a', 'dam-b', 0, 'F'),
      dog('dam-a', 'Ancêtre A', '200/2', null, null, 1, 'M'),
      dog('dam-b', 'Ancêtre B', 'LOF 300/3', null, null, 1, 'F'),
    ],
  };

  const candidates = matchCandidates(sirePedigree, damPedigree);
  const matches = selectedCandidates(candidates, candidates.map((candidate) => candidate.token));
  const result = calculateVirtualLitter(sirePedigree, damPedigree, matches);

  assert.equal(candidates.length, 2);
  assert.equal(result.coi_percent, 25);
  assert.equal(result.common_ancestors.length, 2);
  assert.deepEqual(result.common_ancestors.map((ancestor) => ancestor.contribution_percent), [12.5, 12.5]);
  assert.equal(result.explained_percent, 25);
});

test('un ancêtre commun à deux générations contribue pour 3,125 %', () => {
  const sirePedigree = {
    target_id: 'male',
    individuals: [
      dog('male', 'Mâle', 'M-1', 'male-parent', null, 0, 'M'),
      dog('male-parent', 'Père mâle', 'M-2', 'common-sire', null, 1, 'M'),
      dog('common-sire', 'Ancêtre commun', 'LOF 999/9', null, null, 2, 'M'),
    ],
  };
  const damPedigree = {
    target_id: 'female',
    individuals: [
      dog('female', 'Femelle', 'F-1', null, 'female-parent', 0, 'F'),
      dog('female-parent', 'Mère femelle', 'F-2', 'common-dam', null, 1, 'F'),
      dog('common-dam', 'Ancêtre commun', 'LOF 999/9', null, null, 2, 'M'),
    ],
  };

  const candidates = matchCandidates(sirePedigree, damPedigree);
  const result = calculateVirtualLitter(sirePedigree, damPedigree, candidates);

  assert.equal(result.coi_percent, 3.125);
  assert.equal(result.common_ancestors[0].sire_depth, 2);
  assert.equal(result.common_ancestors[0].dam_depth, 2);
  assert.equal(result.common_ancestors[0].contribution_percent, 3.125);
});

test('une identité commune fondée seulement sur le nom exige une sélection explicite', () => {
  const sirePedigree = {
    target_id: 'male',
    individuals: [dog('male', 'Mâle', '', 'a', null, 0, 'M'), dog('a', 'Même ancêtre', '', null, null, 1)],
  };
  const damPedigree = {
    target_id: 'female',
    individuals: [dog('female', 'Femelle', '', 'b', null, 0, 'F'), dog('b', 'Même ancêtre', '', null, null, 1)],
  };

  const candidates = matchCandidates(sirePedigree, damPedigree);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].match_type, 'name_exact');
  assert.equal(candidates[0].default_confirmed, false);

  const withoutConfirmation = calculateVirtualLitter(sirePedigree, damPedigree, []);
  assert.equal(withoutConfirmation.coi_percent, 0);
});

test('un rapprochement manuel corrige deux graphies différentes du même ancêtre', () => {
  const sirePedigree = {
    target_id: 'male',
    individuals: [dog('male', 'Mâle', '', 'a', null, 0, 'M'), dog('a', 'Kapo', '', null, null, 1)],
  };
  const damPedigree = {
    target_id: 'female',
    individuals: [dog('female', 'Femelle', '', 'b', null, 0, 'F'), dog('b', 'CAPO', '', null, null, 1)],
  };

  assert.equal(matchCandidates(sirePedigree, damPedigree).length, 0);
  const manualMatch = manualMatchCandidate(sirePedigree, damPedigree, 'a', 'b');
  const result = calculateVirtualLitter(sirePedigree, damPedigree, [manualMatch]);

  assert.equal(result.coi_percent, 12.5);
  assert.equal(result.common_ancestors[0].match_type, 'operator_manual');
});
