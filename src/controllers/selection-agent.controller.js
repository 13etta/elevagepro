const crypto = require('crypto');
const { pool } = require('../db');
const { calculateCoi, normalizePedigree } = require('../services/selection/coi.service');
const {
  extractPedigree,
  researchPedigree,
} = require('../services/selection/openai-selection.service');
const { loadValidatedAnalyses } = require('./selection-virtual-litter.controller');

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function values(value) {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

async function findAnalysis(breederId, analysisId) {
  const result = await pool.query(
    `SELECT * FROM selection_analyses WHERE id = $1 AND breeder_id = $2 LIMIT 1`,
    [analysisId, breederId],
  );
  return result.rows[0] || null;
}

function pedigreeFromForm(body) {
  const nodeIds = values(body.node_id);
  const names = values(body.name);
  const registrations = values(body.registration_number);
  const sexes = values(body.sex);
  const sireIds = values(body.sire_id);
  const damIds = values(body.dam_id);
  const generations = values(body.generation);

  if (!nodeIds.length || nodeIds.length > 127) {
    throw new Error('Le pedigree validé doit contenir entre 1 et 127 individus.');
  }

  const individuals = nodeIds.map((nodeId, index) => ({
    node_id: clean(nodeId, 100),
    name: clean(names[index], 180) || '[À COMPLÉTER]',
    registration_number: clean(registrations[index], 120),
    sex: ['M', 'F', 'U'].includes(clean(sexes[index], 1).toUpperCase())
      ? clean(sexes[index], 1).toUpperCase()
      : 'U',
    sire_id: clean(sireIds[index], 100) || null,
    dam_id: clean(damIds[index], 100) || null,
    generation: Number.isFinite(Number(generations[index])) ? Number(generations[index]) : null,
  }));

  const knownIds = new Set(individuals.map((individual) => individual.node_id));
  for (const individual of individuals) {
    if (individual.sire_id && !knownIds.has(individual.sire_id)) individual.sire_id = null;
    if (individual.dam_id && !knownIds.has(individual.dam_id)) individual.dam_id = null;
  }

  return normalizePedigree({
    target_id: clean(body.target_id, 100),
    individuals,
  });
}

exports.index = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const [result, validatedAnalyses, virtualLitterResult] = await Promise.all([
      pool.query(
        `SELECT id, subject_name, source_filename, status, coi_percent, completeness, created_at
         FROM selection_analyses
         WHERE breeder_id = $1
         ORDER BY created_at DESC
         LIMIT 30`,
        [breederId],
      ),
      loadValidatedAnalyses(breederId),
      pool.query(
        `SELECT vl.id, vl.name, vl.coi_percent, vl.common_ancestors, vl.created_at,
                sire.subject_name AS sire_name, dam.subject_name AS dam_name
         FROM selection_virtual_litters vl
         INNER JOIN selection_analyses sire
           ON sire.id = vl.sire_analysis_id AND sire.breeder_id = vl.breeder_id
         INNER JOIN selection_analyses dam
           ON dam.id = vl.dam_analysis_id AND dam.breeder_id = vl.breeder_id
         WHERE vl.breeder_id = $1
         ORDER BY vl.created_at DESC
         LIMIT 20`,
        [breederId],
      ),
    ]);

    return res.render('selection-agent/index', {
      title: 'Sélection IA',
      analyses: result.rows,
      validatedAnalyses,
      virtualLitters: virtualLitterResult.rows,
      aiConfigured: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    });
  } catch (error) {
    console.error('Erreur chargement Sélection IA :', error);
    setFlash(req, 'error', 'Impossible de charger les dossiers de sélection. La migration 022 est-elle appliquée ?');
    return res.redirect('/dashboard');
  }
};

exports.analyze = async (req, res) => {
  if (!req.file) {
    setFlash(req, 'error', 'Sélectionnez un pedigree au format PDF.');
    return res.redirect('/selection-agent');
  }

  const breederId = req.session.user.breeder_id;
  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  try {
    const { extraction, model } = await extractPedigree(req.file);
    const normalized = normalizePedigree(extraction);
    const target = normalized.individuals.find((individual) => individual.node_id === normalized.target_id);
    const storedExtraction = {
      ...extraction,
      target_id: normalized.target_id,
      individuals: normalized.individuals,
    };

    const inserted = await pool.query(
      `INSERT INTO selection_analyses
        (breeder_id, subject_name, source_filename, source_sha256, status, extraction, extraction_model)
       VALUES ($1, $2, $3, $4, 'review_required', $5::jsonb, $6)
       RETURNING id`,
      [
        breederId,
        target?.name || '[À COMPLÉTER]',
        clean(req.file.originalname, 255) || 'pedigree.pdf',
        sha256,
        JSON.stringify(storedExtraction),
        model,
      ],
    );

    setFlash(
      req,
      'warning',
      'Extraction terminée. Contrôlez les noms, doublons et liens père/mère avant de valider le calcul.',
    );
    return res.redirect(`/selection-agent/${inserted.rows[0].id}`);
  } catch (error) {
    console.error('Erreur analyse pedigree :', error);
    setFlash(req, 'error', error.message || 'Le pedigree n’a pas pu être analysé.');
    return res.redirect('/selection-agent');
  }
};

exports.show = async (req, res) => {
  try {
    const analysis = await findAnalysis(req.session.user.breeder_id, req.params.id);
    if (!analysis) return res.status(404).render('errors/404', { title: 'Dossier introuvable' });

    const displayedPedigree = analysis.validated_pedigree || analysis.extraction;
    const target = displayedPedigree?.individuals?.find(
      (individual) => individual.node_id === displayedPedigree.target_id,
    ) || null;
    return res.render('selection-agent/show', {
      title: `${analysis.subject_name || 'Pedigree'} · Sélection IA`,
      analysis,
      pedigree: displayedPedigree,
      individuals: displayedPedigree?.individuals || [],
      target,
      warnings: analysis.extraction?.warnings || [],
    });
  } catch (error) {
    console.error('Erreur affichage analyse :', error);
    setFlash(req, 'error', 'Impossible d’ouvrir ce dossier de sélection.');
    return res.redirect('/selection-agent');
  }
};

exports.validate = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  try {
    if (req.body.operator_confirmation !== 'yes') {
      throw new Error('La confirmation de contrôle du pedigree est obligatoire avant le calcul.');
    }

    const analysis = await findAnalysis(breederId, req.params.id);
    if (!analysis) return res.status(404).render('errors/404', { title: 'Dossier introuvable' });

    const pedigree = pedigreeFromForm(req.body);
    const result = calculateCoi(pedigree);
    const target = result.pedigree.individuals.find((individual) => individual.node_id === result.target_id);

    await pool.query(
      `UPDATE selection_analyses
       SET subject_name = $1,
           status = 'validated',
           validated_pedigree = $2::jsonb,
           coi_percent = $3,
           coi_method = $4,
           completeness = $5::jsonb,
           research = NULL,
           research_model = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND breeder_id = $7`,
      [
        target?.name || '[À COMPLÉTER]',
        JSON.stringify(result.pedigree),
        result.percent,
        result.method,
        JSON.stringify({ ...result.completeness, is_partial: result.is_partial }),
        analysis.id,
        breederId,
      ],
    );

    setFlash(
      req,
      'success',
      `Pedigree validé. COI calculé : ${result.percent.toLocaleString('fr-FR', { maximumFractionDigits: 5 })} %.`,
    );
    return res.redirect(`/selection-agent/${analysis.id}`);
  } catch (error) {
    console.error('Erreur validation pedigree :', error);
    setFlash(req, 'error', error.message || 'Le pedigree corrigé ne peut pas être validé.');
    return res.redirect(`/selection-agent/${req.params.id}`);
  }
};

exports.research = async (req, res) => {
  const breederId = req.session.user.breeder_id;
  try {
    const analysis = await findAnalysis(breederId, req.params.id);
    if (!analysis) return res.status(404).render('errors/404', { title: 'Dossier introuvable' });
    if (!analysis.validated_pedigree) {
      setFlash(req, 'error', 'Validez d’abord l’identité et les liens de parenté extraits du PDF.');
      return res.redirect(`/selection-agent/${analysis.id}`);
    }

    const { research, model } = await researchPedigree(analysis.validated_pedigree);
    await pool.query(
      `UPDATE selection_analyses
       SET status = 'researched', research = $1::jsonb, research_model = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND breeder_id = $4`,
      [JSON.stringify(research), model, analysis.id, breederId],
    );

    setFlash(req, 'success', 'Recherche terminée. Chaque information reste à rapprocher de sa preuve officielle.');
    return res.redirect(`/selection-agent/${analysis.id}`);
  } catch (error) {
    console.error('Erreur recherche cynophile :', error);
    setFlash(req, 'error', error.message || 'La recherche cynophile n’a pas pu aboutir.');
    return res.redirect(`/selection-agent/${req.params.id}`);
  }
};
