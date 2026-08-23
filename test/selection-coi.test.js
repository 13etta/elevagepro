const assert = require('node:assert/strict');
const test = require('node:test');

const { calculateCoi } = require('../src/services/selection/coi.service');

function dog(nodeId, sireId = null, damId = null) {
  return { node_id: nodeId, name: nodeId, sire_id: sireId, dam_id: damId };
}

test('COI nul avec deux parents fondateurs non apparentés', () => {
  const result = calculateCoi({
    target_id: 'C',
    individuals: [dog('C', 'A', 'B'), dog('A'), dog('B')],
  });

  assert.equal(result.percent, 0);
  assert.equal(result.is_partial, false);
});

test('COI de 25 % pour un mariage entre frère et sœur germains', () => {
  const result = calculateCoi({
    target_id: 'E',
    individuals: [
      dog('E', 'C', 'D'),
      dog('D', 'A', 'B'),
      dog('C', 'A', 'B'),
      dog('B'),
      dog('A'),
    ],
  });

  assert.equal(result.percent, 25);
  assert.equal(result.completeness.percent, 100);
});

test('COI de 25 % pour un mariage parent-descendant', () => {
  const result = calculateCoi({
    target_id: 'D',
    individuals: [dog('D', 'A', 'C'), dog('C', 'A', 'B'), dog('A'), dog('B')],
  });

  assert.equal(result.percent, 25);
});

test('refuse un pedigree comportant une boucle', () => {
  assert.throws(
    () => calculateCoi({ target_id: 'A', individuals: [dog('A', 'B'), dog('B', 'A')] }),
    /boucle de parenté/,
  );
});
