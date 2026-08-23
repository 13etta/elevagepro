const { pool } = require('../db');
const {
  calculateVirtualLitter,
  manualMatchCandidate,
  matchCandidates,
  selectedCandidates,
} = require('../services/selection/virtual-litter.service');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value, maxLength = 220) {
  return String(value || '').trim().slice(0, maxLength);
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function values(value) {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

function targetOf(analysis) {
  const pedigree = analysis?.validated_pedigree;
  return pedigree?.individuals?.find((individual) => individual.node_id === pedigree.target_id) || null;
}

function decorateAnalysis(analysis) {
  const target = targetOf(analysis);
  return {
    ...analysis,
    target,
    target_sex: target?.sex || 'U',
    registration_number: target?.registration_number || '',
  };
}

async function loadValidatedAnalyses(breederId) {
  const result = await pool.query(
    `SELECT id, subject_name, validated_pedigree, coi_percent, completeness, status, created_at
     FROM selection_analyses
     WHERE breeder_id = $1
       AND validated_pedigree IS NOT NULL
       AND status IN ('validated', 'researched')
     ORDER BY subject_name ASC, created_at DESC`,
    [breederId],
  );
  return result.rows.map(decorateAnalysis);
}

function requireUuid(value, label) {
  const id = clean(value, 50);
  if (!UUID_PATTERN.test(id)) throw new Error(`${label} invalide ou manquant.`);
  return id;
}

async function loadPair(breederId, sireId, damId) {
  const result = await pool.query(
    `SELECT id, subject_name, validated_pedigree, coi_percent, completeness, status
     FROM selection_analyses
     WHERE breeder_id = $1
       AND id = ANY($2::uuid[])
       AND validated_pedigree IS NOT NULL
       AND status IN ('validated', 'researched')`,
    [breederId, [sireId, damId]],
  );
  const byId = new Map(result.rows.map((analysis) => [analysis.id, decorateAnalysis(analysis)]));
  const sire = byId.get(sireId);
  const dam = byId.get(damId);
  if (!sire || !dam) throw new Error('Les deux pedigrees doivent être validés et appartenir à cet élevage.');
  return { sire, dam };
}

exports.newVirtualLitter = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  try {
    const analyses = await loadValidatedAnalyses(breederId);
    const requestedSireId = clean(req.query.sire_id, 50);
    const requestedDamId = clean(req.query.dam_id, 50);
    const sire = analyses.find((analysis) => analysis.id === requestedSireId) || null;
    const dam = analyses.find((analysis) => analysis.id === requestedDamId) || null;
    let candidates = [];
    let preview = null;

    if (sire && dam && sire.id !== dam.id) {
      candidates = matchCandidates(sire.validated_pedigree, dam.validated_pedigree);
      const defaultMatches = candidates.filter((candidate) => candidate.default_confirmed);
      preview = calculateVirtualLitter(sire.validated_pedigree, dam.validated_pedigree, defaultMatches);
    }

    return res.render('selection-agent/virtual-litter-new', {
      title: 'Nouvelle portée virtuelle',
      analyses,
      sire,
      dam,
      selectedSireId: sire?.id || '',
      selectedDamId: dam?.id || '',
      candidates,
      preview,
      sireAncestors: sire?.validated_pedigree?.individuals?.filter(
        (individual) => individual.node_id !== sire.validated_pedigree.target_id,
      ) || [],
      damAncestors: dam?.validated_pedigree?.individuals?.filter(
        (individual) => individual.node_id !== dam.validated_pedigree.target_id,
      ) || [],
    });
  } catch (error) {
    console.error('Erreur préparation portée virtuelle :', error);
    setFlash(req, 'error', error.message || 'Impossible de préparer la portée virtuelle.');
    return res.redirect('/selection-agent');
  }
};

exports.createVirtualLitter = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  try {
    if (req.body.operator_confirmation !== 'yes') {
      throw new Error('Confirmez les deux reproducteurs et les ancêtres communs avant le calcul.');
    }

    const sireId = requireUuid(req.body.sire_id, 'Pedigree du mâle');
    const damId = requireUuid(req.body.dam_id, 'Pedigree de la femelle');
    if (sireId === damId) throw new Error('Le mâle et la femelle doivent provenir de deux dossiers distincts.');

    const { sire, dam } = await loadPair(breederId, sireId, damId);
    if (sire.target_sex === 'F') throw new Error(`${sire.subject_name} est identifié comme femelle dans son pedigree.`);
    if (dam.target_sex === 'M') throw new Error(`${dam.subject_name} est identifié comme mâle dans son pedigree.`);

    const automaticCandidates = matchCandidates(sire.validated_pedigree, dam.validated_pedigree);
    const manualSireIds = values(req.body.manual_sire_node_id);
    const manualDamIds = values(req.body.manual_dam_node_id);
    const manualCandidates = [];
    for (let index = 0; index < Math.max(manualSireIds.length, manualDamIds.length); index += 1) {
      const sireNodeId = clean(manualSireIds[index], 100);
      const damNodeId = clean(manualDamIds[index], 100);
      if (!sireNodeId && !damNodeId) continue;
      if (!sireNodeId || !damNodeId) throw new Error('Chaque rapprochement manuel doit contenir un ascendant de chaque lignée.');
      manualCandidates.push(manualMatchCandidate(
        sire.validated_pedigree,
        dam.validated_pedigree,
        sireNodeId,
        damNodeId,
      ));
    }

    const candidates = [...new Map(
      [...automaticCandidates, ...manualCandidates].map((candidate) => [candidate.token, candidate]),
    ).values()];
    const selectedTokens = [
      ...values(req.body.match_pair),
      ...manualCandidates.map((candidate) => candidate.token),
    ];
    const matches = selectedCandidates(candidates, selectedTokens);
    const result = calculateVirtualLitter(sire.validated_pedigree, dam.validated_pedigree, matches);
    const warnings = [...result.warnings];
    if (sire.target_sex === 'U') warnings.push(`Sexe du reproducteur ${sire.subject_name} à confirmer.`);
    if (dam.target_sex === 'U') warnings.push(`Sexe de la reproductrice ${dam.subject_name} à confirmer.`);
    if (sire.completeness?.is_partial) warnings.push(`Pedigree de ${sire.subject_name} incomplet : le COI est calculé sur l'ascendance connue.`);
    if (dam.completeness?.is_partial) warnings.push(`Pedigree de ${dam.subject_name} incomplet : le COI est calculé sur l'ascendance connue.`);

    const name = clean(req.body.name) || `${sire.subject_name} × ${dam.subject_name}`;
    const completeness = {
      offspring: result.completeness,
      sire: sire.completeness || null,
      dam: dam.completeness || null,
      is_partial: Boolean(sire.completeness?.is_partial || dam.completeness?.is_partial),
    };
    const confirmedMatches = matches.map((match) => ({
      sire_node_id: match.sire_node_id,
      dam_node_id: match.dam_node_id,
      name: match.name,
      match_type: match.match_type,
      sire_registration_number: match.sire_registration_number,
      dam_registration_number: match.dam_registration_number,
    }));

    const inserted = await pool.query(
      `INSERT INTO selection_virtual_litters
        (breeder_id, sire_analysis_id, dam_analysis_id, name, coi_percent, coi_method,
         completeness, confirmed_matches, common_ancestors, offspring_pedigree,
         explained_percent, unexplained_percent, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13::jsonb)
       RETURNING id`,
      [
        breederId,
        sire.id,
        dam.id,
        name,
        result.coi_percent,
        result.coi_method,
        JSON.stringify(completeness),
        JSON.stringify(confirmedMatches),
        JSON.stringify(result.common_ancestors),
        JSON.stringify(result.offspring_pedigree),
        result.explained_percent,
        result.unexplained_percent,
        JSON.stringify(warnings),
      ],
    );

    setFlash(req, 'success', `Portée virtuelle calculée : COI prévisionnel ${result.coi_percent.toLocaleString('fr-FR', { maximumFractionDigits: 5 })} %.`);
    return res.redirect(`/selection-agent/virtual-litters/${inserted.rows[0].id}`);
  } catch (error) {
    console.error('Erreur création portée virtuelle :', error);
    setFlash(req, 'error', error.message || 'La portée virtuelle ne peut pas être calculée.');
    const query = new URLSearchParams({
      sire_id: clean(req.body.sire_id, 50),
      dam_id: clean(req.body.dam_id, 50),
    });
    return res.redirect(`/selection-agent/virtual-litters/new?${query.toString()}`);
  }
};

exports.showVirtualLitter = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  try {
    const litterId = requireUuid(req.params.id, 'Portée virtuelle');
    const result = await pool.query(
      `SELECT vl.*,
              sire.subject_name AS sire_name,
              sire.validated_pedigree AS sire_pedigree,
              dam.subject_name AS dam_name,
              dam.validated_pedigree AS dam_pedigree
       FROM selection_virtual_litters vl
       INNER JOIN selection_analyses sire
         ON sire.id = vl.sire_analysis_id AND sire.breeder_id = vl.breeder_id
       INNER JOIN selection_analyses dam
         ON dam.id = vl.dam_analysis_id AND dam.breeder_id = vl.breeder_id
       WHERE vl.id = $1 AND vl.breeder_id = $2
       LIMIT 1`,
      [litterId, breederId],
    );
    const litter = result.rows[0];
    if (!litter) return res.status(404).render('errors/404', { title: 'Portée virtuelle introuvable' });

    return res.render('selection-agent/virtual-litter-show', {
      title: `${litter.name} · Portée virtuelle`,
      litter,
      commonAncestors: litter.common_ancestors || [],
      warnings: litter.warnings || [],
    });
  } catch (error) {
    console.error('Erreur affichage portée virtuelle :', error);
    setFlash(req, 'error', error.message || 'Impossible d’ouvrir cette portée virtuelle.');
    return res.redirect('/selection-agent');
  }
};

module.exports.loadValidatedAnalyses = loadValidatedAnalyses;
