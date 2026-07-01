const { pool } = require('../db');

const SELECTION_COLLECTIONS = ['dogs', 'males', 'females', 'assignableDogs'];
const ARCHIVE_VIEWS = new Set(['dogs/index', 'dogs/show', 'dogs/archives/index', 'dogs/archives/show']);

function filterCollection(items, archivedIds) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => !item?.id || !archivedIds.has(String(item.id)));
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
      if (!ARCHIVE_VIEWS.has(view) && options && typeof options === 'object') {
        SELECTION_COLLECTIONS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(options, key)) {
            options[key] = filterCollection(options[key], archivedIds);
          }
        });
      }
      return originalRender(view, options, callback);
    };

    return next();
  } catch (error) {
    console.error('Erreur filtrage chiens archivés:', error);
    return next();
  }
};
