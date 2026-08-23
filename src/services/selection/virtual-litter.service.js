const { calculateCoi, normalizePedigree } = require('./coi.service');

function clean(value) {
  return String(value || '').trim();
}

function normalizeRegistration(value) {
  const normalized = clean(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^LOF(?=\d)/, '');
  return normalized.length >= 5 ? normalized : '';
}

function normalizeName(value) {
  const normalized = clean(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized || normalized.includes('A COMPLETER')) return '';
  return normalized;
}

function reachableIds(pedigree) {
  const byId = new Map(pedigree.individuals.map((individual) => [individual.node_id, individual]));
  const reached = new Set();

  function visit(nodeId) {
    if (!nodeId || reached.has(nodeId) || !byId.has(nodeId)) return;
    reached.add(nodeId);
    const individual = byId.get(nodeId);
    visit(individual.sire_id);
    visit(individual.dam_id);
  }

  visit(pedigree.target_id);
  return reached;
}

function encodeMatch(sireNodeId, damNodeId) {
  return Buffer.from(JSON.stringify([sireNodeId, damNodeId]), 'utf8').toString('base64url');
}

function matchCandidates(rawSirePedigree, rawDamPedigree) {
  const sirePedigree = normalizePedigree(rawSirePedigree);
  const damPedigree = normalizePedigree(rawDamPedigree);
  const sireReachable = reachableIds(sirePedigree);
  const damReachable = reachableIds(damPedigree);
  const candidates = [];

  for (const sireIndividual of sirePedigree.individuals) {
    if (!sireReachable.has(sireIndividual.node_id)) continue;
    for (const damIndividual of damPedigree.individuals) {
      if (!damReachable.has(damIndividual.node_id)) continue;
      if (
        sireIndividual.node_id === sirePedigree.target_id
        && damIndividual.node_id === damPedigree.target_id
      ) continue;

      const sireRegistration = normalizeRegistration(sireIndividual.registration_number);
      const damRegistration = normalizeRegistration(damIndividual.registration_number);
      const sireName = normalizeName(sireIndividual.name);
      const damName = normalizeName(damIndividual.name);
      let matchType = null;

      if (sireRegistration && sireRegistration === damRegistration) matchType = 'registration';
      else if ((!sireRegistration || !damRegistration) && sireName && sireName === damName) matchType = 'name_exact';
      if (!matchType) continue;

      candidates.push({
        token: encodeMatch(sireIndividual.node_id, damIndividual.node_id),
        sire_node_id: sireIndividual.node_id,
        dam_node_id: damIndividual.node_id,
        name: sireIndividual.name || damIndividual.name,
        sire_name: sireIndividual.name,
        dam_name: damIndividual.name,
        sire_registration_number: sireIndividual.registration_number || '',
        dam_registration_number: damIndividual.registration_number || '',
        match_type: matchType,
        default_confirmed: matchType === 'registration',
        ambiguous: false,
      });
    }
  }

  const sireCounts = new Map();
  const damCounts = new Map();
  for (const candidate of candidates) {
    sireCounts.set(candidate.sire_node_id, (sireCounts.get(candidate.sire_node_id) || 0) + 1);
    damCounts.set(candidate.dam_node_id, (damCounts.get(candidate.dam_node_id) || 0) + 1);
  }

  return candidates.map((candidate) => {
    const ambiguous = sireCounts.get(candidate.sire_node_id) > 1 || damCounts.get(candidate.dam_node_id) > 1;
    return { ...candidate, ambiguous, default_confirmed: candidate.default_confirmed && !ambiguous };
  });
}

function selectedCandidates(candidates, selectedTokens) {
  const selected = new Set(Array.isArray(selectedTokens) ? selectedTokens : selectedTokens ? [selectedTokens] : []);
  const validCandidates = candidates.filter((candidate) => selected.has(candidate.token));
  const usedSireNodes = new Set();
  const usedDamNodes = new Set();

  for (const candidate of validCandidates) {
    if (usedSireNodes.has(candidate.sire_node_id) || usedDamNodes.has(candidate.dam_node_id)) {
      throw new Error('Un ancêtre ne peut pas être associé à plusieurs individus du pedigree opposé.');
    }
    usedSireNodes.add(candidate.sire_node_id);
    usedDamNodes.add(candidate.dam_node_id);
  }
  return validCandidates;
}

function manualMatchCandidate(rawSirePedigree, rawDamPedigree, sireNodeId, damNodeId) {
  const sirePedigree = normalizePedigree(rawSirePedigree);
  const damPedigree = normalizePedigree(rawDamPedigree);
  const sireReachable = reachableIds(sirePedigree);
  const damReachable = reachableIds(damPedigree);
  const sireIndividual = sirePedigree.individuals.find((individual) => individual.node_id === sireNodeId);
  const damIndividual = damPedigree.individuals.find((individual) => individual.node_id === damNodeId);

  if (!sireIndividual || !damIndividual || !sireReachable.has(sireNodeId) || !damReachable.has(damNodeId)) {
    throw new Error('Le rapprochement manuel contient un ascendant introuvable.');
  }
  if (sireNodeId === sirePedigree.target_id && damNodeId === damPedigree.target_id) {
    throw new Error('Le mâle et la femelle ne peuvent pas être déclarés comme un même individu.');
  }

  return {
    token: encodeMatch(sireNodeId, damNodeId),
    sire_node_id: sireNodeId,
    dam_node_id: damNodeId,
    name: sireIndividual.name || damIndividual.name,
    sire_name: sireIndividual.name,
    dam_name: damIndividual.name,
    sire_registration_number: sireIndividual.registration_number || '',
    dam_registration_number: damIndividual.registration_number || '',
    match_type: 'operator_manual',
    default_confirmed: false,
    ambiguous: false,
  };
}

function buildCombinedPedigree(rawSirePedigree, rawDamPedigree, matches) {
  const sirePedigree = normalizePedigree(rawSirePedigree);
  const damPedigree = normalizePedigree(rawDamPedigree);
  const sireReachable = reachableIds(sirePedigree);
  const damReachable = reachableIds(damPedigree);
  const sireById = new Map(sirePedigree.individuals.map((individual) => [individual.node_id, individual]));
  const damById = new Map(damPedigree.individuals.map((individual) => [individual.node_id, individual]));
  const damToCanonical = new Map(matches.map((match) => [match.dam_node_id, `s:${match.sire_node_id}`]));
  const sireId = (nodeId) => nodeId ? `s:${nodeId}` : null;
  const damId = (nodeId) => nodeId ? (damToCanonical.get(nodeId) || `d:${nodeId}`) : null;
  const mergedById = new Map();
  const warnings = [];

  for (const individual of sirePedigree.individuals) {
    if (!sireReachable.has(individual.node_id)) continue;
    mergedById.set(sireId(individual.node_id), {
      ...individual,
      node_id: sireId(individual.node_id),
      sire_id: sireId(individual.sire_id),
      dam_id: sireId(individual.dam_id),
      generation: Number.isFinite(individual.generation) ? individual.generation + 1 : null,
    });
  }

  for (const individual of damPedigree.individuals) {
    if (!damReachable.has(individual.node_id)) continue;
    const canonicalId = damId(individual.node_id);
    const damVersion = {
      ...individual,
      node_id: canonicalId,
      sire_id: damId(individual.sire_id),
      dam_id: damId(individual.dam_id),
      generation: Number.isFinite(individual.generation) ? individual.generation + 1 : null,
    };
    const existing = mergedById.get(canonicalId);

    if (!existing) {
      mergedById.set(canonicalId, damVersion);
      continue;
    }

    for (const parentField of ['sire_id', 'dam_id']) {
      if (existing[parentField] && damVersion[parentField] && existing[parentField] !== damVersion[parentField]) {
        warnings.push(`Ascendance contradictoire pour ${existing.name} (${parentField === 'sire_id' ? 'père' : 'mère'}). La branche du mâle a été conservée.`);
      } else if (!existing[parentField] && damVersion[parentField]) {
        existing[parentField] = damVersion[parentField];
      }
    }
    if (!existing.registration_number && damVersion.registration_number) {
      existing.registration_number = damVersion.registration_number;
    }
  }

  const sireTarget = sireById.get(sirePedigree.target_id);
  const damTarget = damById.get(damPedigree.target_id);
  const offspringId = 'virtual:offspring';
  mergedById.set(offspringId, {
    node_id: offspringId,
    name: `Portée virtuelle ${sireTarget?.name || '[À COMPLÉTER]'} × ${damTarget?.name || '[À COMPLÉTER]'}`,
    registration_number: '',
    sex: 'U',
    sire_id: sireId(sirePedigree.target_id),
    dam_id: damId(damPedigree.target_id),
    generation: 0,
  });

  return {
    pedigree: { target_id: offspringId, individuals: [...mergedById.values()] },
    sire_target_id: sireId(sirePedigree.target_id),
    dam_target_id: damId(damPedigree.target_id),
    canonical_match_ids: Object.fromEntries(matches.map((match) => [match.token, sireId(match.sire_node_id)])),
    warnings,
  };
}

function findPaths(byId, startId, targetId, maxDepth = 12) {
  const paths = [];

  function visit(nodeId, path) {
    if (!nodeId || path.length > maxDepth + 1 || path.includes(nodeId)) return;
    const nextPath = [...path, nodeId];
    if (nodeId === targetId) {
      paths.push(nextPath);
      return;
    }
    const individual = byId.get(nodeId);
    if (!individual) return;
    visit(individual.sire_id, nextPath);
    visit(individual.dam_id, nextPath);
  }

  visit(startId, []);
  return paths;
}

function independentPaths(sirePath, damPath, ancestorId) {
  const sireNodes = new Set(sirePath.filter((nodeId) => nodeId !== ancestorId));
  return damPath.every((nodeId) => nodeId === ancestorId || !sireNodes.has(nodeId));
}

function commonAncestorDetails(matches, combined, coiResult) {
  const byId = new Map(combined.pedigree.individuals.map((individual) => [individual.node_id, individual]));

  return matches.map((match) => {
    const ancestorId = combined.canonical_match_ids[match.token];
    const ancestor = byId.get(ancestorId);
    const sirePaths = findPaths(byId, combined.sire_target_id, ancestorId);
    const damPaths = findPaths(byId, combined.dam_target_id, ancestorId);
    const ancestorCoi = coiResult.individual_coi[ancestorId] || 0;
    const pathDetails = [];

    for (const sirePath of sirePaths) {
      for (const damPath of damPaths) {
        if (!independentPaths(sirePath, damPath, ancestorId)) continue;
        const sireDepth = sirePath.length - 1;
        const damDepth = damPath.length - 1;
        const contribution = (0.5 ** (sireDepth + damDepth + 1)) * (1 + ancestorCoi);
        pathDetails.push({
          sire_depth: sireDepth,
          dam_depth: damDepth,
          sire_path: sirePath.map((nodeId) => byId.get(nodeId)?.name || nodeId),
          dam_path: damPath.map((nodeId) => byId.get(nodeId)?.name || nodeId),
          contribution_percent: Number((contribution * 100).toFixed(5)),
        });
      }
    }

    return {
      node_id: ancestorId,
      name: ancestor?.name || match.name || '[À COMPLÉTER]',
      registration_number: ancestor?.registration_number || '',
      match_type: match.match_type,
      sire_depth: sirePaths.length ? Math.min(...sirePaths.map((path) => path.length - 1)) : null,
      dam_depth: damPaths.length ? Math.min(...damPaths.map((path) => path.length - 1)) : null,
      sire_path_count: sirePaths.length,
      dam_path_count: damPaths.length,
      valid_path_pairs: pathDetails.length,
      ancestor_coi_percent: Number((ancestorCoi * 100).toFixed(5)),
      contribution_percent: Number(pathDetails.reduce((sum, detail) => sum + detail.contribution_percent, 0).toFixed(5)),
      path_details: pathDetails,
    };
  }).sort((left, right) => right.contribution_percent - left.contribution_percent);
}

function calculateVirtualLitter(rawSirePedigree, rawDamPedigree, matches) {
  const combined = buildCombinedPedigree(rawSirePedigree, rawDamPedigree, matches);
  const coiResult = calculateCoi(combined.pedigree);
  const commonAncestors = commonAncestorDetails(matches, combined, coiResult);
  const explainedPercent = Number(
    commonAncestors.reduce((sum, ancestor) => sum + ancestor.contribution_percent, 0).toFixed(5),
  );
  const unexplainedPercent = Number(Math.max(0, coiResult.percent - explainedPercent).toFixed(5));

  return {
    coi_percent: coiResult.percent,
    coi_method: coiResult.method,
    completeness: coiResult.completeness,
    offspring_pedigree: coiResult.pedigree,
    common_ancestors: commonAncestors,
    explained_percent: explainedPercent,
    unexplained_percent: unexplainedPercent,
    warnings: combined.warnings,
  };
}

module.exports = {
  calculateVirtualLitter,
  encodeMatch,
  manualMatchCandidate,
  matchCandidates,
  normalizeName,
  normalizeRegistration,
  selectedCandidates,
};
