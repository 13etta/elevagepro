function text(value) {
  return String(value || '').trim();
}

function normalizePedigree(pedigree) {
  const rawIndividuals = Array.isArray(pedigree?.individuals) ? pedigree.individuals : [];
  const individuals = rawIndividuals.map((individual, index) => ({
    node_id: text(individual.node_id) || `node-${index + 1}`,
    name: text(individual.name) || '[À COMPLÉTER]',
    registration_number: text(individual.registration_number),
    sex: ['M', 'F'].includes(text(individual.sex).toUpperCase())
      ? text(individual.sex).toUpperCase()
      : 'U',
    sire_id: text(individual.sire_id) || null,
    dam_id: text(individual.dam_id) || null,
    generation: Number.isFinite(Number(individual.generation))
      ? Math.max(0, Number(individual.generation))
      : null,
    page: Number.isFinite(Number(individual.page)) ? Number(individual.page) : null,
    evidence_text: text(individual.evidence_text),
    confidence: Number.isFinite(Number(individual.confidence))
      ? Math.min(1, Math.max(0, Number(individual.confidence)))
      : null,
  }));

  const ids = new Set();
  for (const individual of individuals) {
    if (ids.has(individual.node_id)) {
      throw new Error(`Identifiant de pedigree dupliqué : ${individual.node_id}`);
    }
    ids.add(individual.node_id);
  }

  return {
    target_id: text(pedigree?.target_id) || individuals[0]?.node_id || null,
    individuals,
  };
}

function topologicalOrder(individuals) {
  const byId = new Map(individuals.map((individual) => [individual.node_id, individual]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  function visit(id) {
    if (!byId.has(id) || visited.has(id)) return;
    if (visiting.has(id)) throw new Error('Le pedigree contient une boucle de parenté impossible.');

    visiting.add(id);
    const individual = byId.get(id);
    visit(individual.sire_id);
    visit(individual.dam_id);
    visiting.delete(id);
    visited.add(id);
    ordered.push(individual);
  }

  individuals.forEach((individual) => visit(individual.node_id));
  return ordered;
}

function calculateCompleteness(pedigree) {
  const byId = new Map(pedigree.individuals.map((individual) => [individual.node_id, individual]));
  const target = byId.get(pedigree.target_id);
  if (!target) return { known_ancestors: 0, expected_ancestors: 0, percent: 0, generations: 0 };

  let frontier = [target];
  let knownAncestors = 0;
  let expectedAncestors = 0;
  const declaredGenerations = pedigree.individuals
    .map((individual) => individual.generation)
    .filter((generation) => Number.isFinite(generation));
  const maxGenerations = Math.min(8, Math.max(1, ...declaredGenerations));
  let generations = 0;

  while (frontier.length && generations < maxGenerations) {
    const next = [];
    expectedAncestors += frontier.length * 2;
    for (const individual of frontier) {
      for (const parentId of [individual.sire_id, individual.dam_id]) {
        if (!parentId || !byId.has(parentId)) continue;
        knownAncestors += 1;
        // Les répétitions représentent des places généalogiques distinctes et
        // doivent compter dans la complétude, même si le même chien est commun.
        next.push(byId.get(parentId));
      }
    }
    generations += 1;
    frontier = next;
  }

  return {
    known_ancestors: knownAncestors,
    expected_ancestors: expectedAncestors,
    percent: expectedAncestors ? Number(((knownAncestors / expectedAncestors) * 100).toFixed(1)) : 0,
    generations,
  };
}

function calculateCoi(rawPedigree) {
  const pedigree = normalizePedigree(rawPedigree);
  if (!pedigree.target_id || !pedigree.individuals.length) {
    throw new Error('Le pedigree ne contient aucun individu exploitable.');
  }

  const ordered = topologicalOrder(pedigree.individuals);
  const byId = new Map(ordered.map((individual) => [individual.node_id, individual]));
  if (!byId.has(pedigree.target_id)) {
    throw new Error('Le chien cible est absent du pedigree validé.');
  }

  const relationship = new Map();
  const key = (left, right) => JSON.stringify([left, right].sort());
  const get = (left, right) => {
    if (!left || !right) return 0;
    return relationship.get(key(left, right)) || 0;
  };
  const set = (left, right, value) => relationship.set(key(left, right), value);

  ordered.forEach((individual, index) => {
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = ordered[previousIndex];
      set(
        individual.node_id,
        previous.node_id,
        0.5 * (get(individual.sire_id, previous.node_id) + get(individual.dam_id, previous.node_id)),
      );
    }

    const diagonal = individual.sire_id && individual.dam_id
      ? 1 + (0.5 * get(individual.sire_id, individual.dam_id))
      : 1;
    set(individual.node_id, individual.node_id, diagonal);
  });

  const targetRelationship = get(pedigree.target_id, pedigree.target_id);
  const coefficient = Math.max(0, targetRelationship - 1);
  const target = byId.get(pedigree.target_id);
  const missingTargetParents = [target.sire_id, target.dam_id].filter((id) => !id || !byId.has(id));
  const completeness = calculateCompleteness(pedigree);
  const individualCoi = Object.fromEntries(
    ordered.map((individual) => [
      individual.node_id,
      Math.max(0, get(individual.node_id, individual.node_id) - 1),
    ]),
  );

  return {
    coefficient,
    percent: Number((coefficient * 100).toFixed(5)),
    method: 'Matrice de parenté additive (méthode tabulaire de Wright)',
    target_id: pedigree.target_id,
    is_partial: missingTargetParents.length > 0 || completeness.percent < 100,
    completeness,
    individual_coi: individualCoi,
    pedigree,
  };
}

module.exports = {
  calculateCoi,
  normalizePedigree,
};
