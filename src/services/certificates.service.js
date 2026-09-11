const path = require('node:path');
const fs = require('node:fs/promises');
const { pool } = require('../db');

const privateRoot = path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(__dirname, '..', '..', 'private-uploads'));
const legacyRoot = path.resolve(__dirname, '..', 'public', 'uploads', 'health-tests');

async function serveCertificate(req, res, next) {
  try {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9-]+\.(pdf|jpg|png|webp)$/.test(filename)) return res.sendStatus(404);
    const result = await pool.query(
      'SELECT id FROM health_tests WHERE breeder_id = $1 AND certificate_url = $2 LIMIT 1',
      [req.session.user.breeder_id, `/uploads/health-tests/${filename}`],
    );
    if (!result.rows.length) return res.sendStatus(404);
    // Old URLs remain valid, but every download now verifies ownership.
    let root = path.join(privateRoot, 'health-tests');
    try { await fs.access(path.join(root, filename)); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      root = legacyRoot;
    }
    res.set('Cache-Control', 'no-store');
    return res.download(filename, 'justificatif' + path.extname(filename), { root, dotfiles: 'deny' }, error => {
      if (!error) return;
      if (res.headersSent) return next(error);
      if (error.code === 'ENOENT' || error.status === 404) return res.sendStatus(404);
      return next(error);
    });
  } catch (error) { return next(error); }
}

module.exports = { privateRoot, serveCertificate };
