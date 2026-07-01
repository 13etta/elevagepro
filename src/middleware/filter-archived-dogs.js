const { pool } = require('../db');

const SELECTION_COLLECTIONS = ['dogs', 'males', 'females', 'assignableDogs'];
const UNFILTERED_VIEWS = new Set([
  'dogs/index',
  'dogs/show',
  'dogs/form',
  'dogs/archives/index',
  'dogs/archives/show',
]);
const MATING_SELECTION_VIEWS = new Set(['pregnancies/form', 'litters/new', 'litters/edit']);

function filterDogCollection(items, archivedIds) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => !item?.id || !archivedIds.has(String(item.id)));
}

function filterMatingCollection(items, archivedIds) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    const maleArchived = item?.male_id && archivedIds.has(String(item.male_id));
    const femaleArchived = item?.female_id && archivedIds.has(String(item.female_id));
    return !maleArchived && !femaleArchived;
  });
}

module.exports = async function filterArchivedDogs(req, res, next) {
  const breederId = req.session?.user?.breeder_id;
  if (!breederId) return next();

  try {
    const result = await pool.query(
      `SELECT id
       FROM dogs
       WHERE breeder_id = $1
         AND LOWER(COALESCE(status, 'actif')) = 'sorti'`,
      [breederId],
    );
    const archivedIds = new Set(result.rows.map((row) => String(row.id)));

    if (!archivedIds.size) return next();

    const originalRender = res.render.bind(res);
    res.render = (view, options = {}, callback) => {
      if (!UNFILTERED_VIEWS.has(view) && options && typeof options === 'object') {
        SELECTION_COLLECTIONS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(options, key)) {
            options[key] = filterDogCollection(options[key], archivedIds);
          }
        });

        if (MATING_SELECTION_VIEWS.has(view) && Object.prototype.hasOwnProperty.call(options, 'matings')) {
          options.matings = filterMatingCollection(options.matings, archivedIds);
        }
      }
      return originalRender(view, options, callback);
    };

    return next();
  } catch (error) {
    console.error('Erreur filtrage chiens archivés:', error);
    return next();
  }
};
