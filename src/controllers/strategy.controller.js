const { pool } = require('../db');

function classifyCoi(coi) {
  const value = Number(coi || 0);
  if (value < 3) return { level: 'excellent', label: 'Très ouvert', recommendation: 'Accouplement génétiquement prudent. À analyser ensuite sur le type, les qualités de travail et la complémentarité morphologique.' };
  if (value < 6.25) return { level: 'good', label: 'Maîtrisé', recommendation: 'Consanguinité acceptable si les qualités recherchées sont solides et les défauts connus.' };
  if (value < 12.5) return { level: 'warning', label: 'À surveiller', recommendation: 'Accouplement à réserver à un objectif précis. Vérifier les défauts communs et la santé.' };
  return { level: 'danger', label: 'Risque élevé', recommendation: 'Accouplement déconseillé sans justification de sélection forte et connaissance approfondie de la lignée.' };
}

async function getPedigree(dogId, maxGenerations = 5) {
  const query = `
    WITH RECURSIVE tree AS (
      SELECT id, name, father_id, mother_id, 0 AS generation
      FROM dogs
      WHERE id = $1
      UNION ALL
      SELECT d.id, d.name, d.father_id, d.mother_id, t.generation + 1
      FROM dogs d
      JOIN tree t ON d.id = t.father_id OR d.id = t.mother_id
      WHERE t.generation < $2
    )
    SELECT * FROM tree WHERE generation > 0
  `;
  const result = await pool.query(query, [dogId, maxGenerations]);
  return result.rows;
}

async function calculateCoi(sireId, damId) {
  const sirePedigree = await getPedigree(sireId, 5);
  const damPedigree = await getPedigree(damId, 5);
  let coi = 0;
  const commonAncestors = [];

  sirePedigree.forEach((sireAncestor) => {
    damPedigree.forEach((damAncestor) => {
      if (sireAncestor.id === damAncestor.id) {
        const contribution = Math.pow(0.5, sireAncestor.generation + damAncestor.generation + 1);
        coi += contribution;
        commonAncestors.push({
          name: sireAncestor.name,
          sireGeneration: sireAncestor.generation,
          damGeneration: damAncestor.generation,
          contribution: contribution * 100,
        });
      }
    });
  });

  return {
    coi: coi * 100,
    commonAncestors,
    classification: classifyCoi(coi * 100),
  };
}

exports.getStrategy = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

    const males = await pool.query(`
      SELECT id, name, breed, status, notes
      FROM dogs
      WHERE breeder_id = $1 AND sex = 'M'
      ORDER BY name ASC
    `, [breederId]);

    const females = await pool.query(`
      SELECT id, name, breed, status, notes
      FROM dogs
      WHERE breeder_id = $1 AND sex = 'F'
      ORDER BY name ASC
    `, [breederId]);

    res.render('strategy/index', {
      title: 'Stratégie de reproduction',
      males: males.rows,
      females: females.rows,
      result: null,
    });
  } catch (error) {
    console.error('Erreur stratégie reproduction:', error);
    res.status(500).send('Erreur lors du chargement de la stratégie de reproduction.');
  }
};

exports.runStrategy = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const { sire_id, dam_id, objective } = req.body;

    const males = await pool.query(`
      SELECT id, name, breed, status, notes
      FROM dogs
      WHERE breeder_id = $1 AND sex = 'M'
      ORDER BY name ASC
    `, [breederId]);

    const females = await pool.query(`
      SELECT id, name, breed, status, notes
      FROM dogs
      WHERE breeder_id = $1 AND sex = 'F'
      ORDER BY name ASC
    `, [breederId]);

    const sire = males.rows.find((dog) => String(dog.id) === String(sire_id));
    const dam = females.rows.find((dog) => String(dog.id) === String(dam_id));

    if (!sire || !dam) {
      return res.render('strategy/index', {
        title: 'Stratégie de reproduction',
        males: males.rows,
        females: females.rows,
        result: { error: 'Sélection incomplète ou incohérente.' },
      });
    }

    const genetic = await calculateCoi(sire_id, dam_id);

    const strengths = [];
    const risks = [];

    if (sire.breed && dam.breed && sire.breed !== dam.breed) {
      risks.push('Races différentes : vérifier l’objectif réel, la cohérence commerciale et le cadre de sélection.');
    }

    if (sire.status !== 'Actif') risks.push(`L’étalon est en statut ${sire.status || 'non défini'}.`);
    if (dam.status !== 'Actif') risks.push(`La lice est en statut ${dam.status || 'non défini'}.`);

    if (genetic.coi < 6.25) strengths.push('Consanguinité maîtrisée sur les générations connues.');
    if (objective) strengths.push(`Objectif déclaré : ${objective}.`);

    const recommendation = genetic.coi < 6.25 && !risks.length
      ? 'Accouplement intéressant à étudier. Valider maintenant le type, les qualités de travail, la santé et les défauts communs.'
      : 'Accouplement possible mais à approfondir. Ne pas décider uniquement sur le COI : confronter santé, morphologie, mental, style et objectifs de sélection.';

    res.render('strategy/index', {
      title: 'Stratégie de reproduction',
      males: males.rows,
      females: females.rows,
      result: {
        sire,
        dam,
        objective,
        genetic,
        strengths,
        risks,
        recommendation,
      },
    });
  } catch (error) {
    console.error('Erreur analyse stratégie:', error);
    res.status(500).send('Erreur lors de l’analyse de reproduction.');
  }
};
