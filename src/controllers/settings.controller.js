const { pool } = require('../db');
const supabase = require('../utils/supabase');

const allowedThemes = ['prestige', 'clinical', 'nature'];
const allowedLangs = ['fr', 'en'];

exports.getSettings = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);

    res.render('settings/index', {
      title: res.__('settings.title'),
      breeder: result.rows[0],
    });
  } catch (error) {
    console.error('Erreur lecture paramètres:', error);
    res.status(500).send('Erreur lors du chargement des paramètres.');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const { company_name, affix_name, siret, address } = req.body;

    await pool.query(
      `
        UPDATE breeder
        SET company_name = $1,
            affix_name = $2,
            siret = $3,
            address = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `,
      [company_name, affix_name, siret, address, breederId],
    );

    res.redirect('/settings');
  } catch (error) {
    console.error('Erreur mise à jour paramètres:', error);
    res.status(500).send('Erreur lors de la sauvegarde.');
  }
};

exports.updatePreferences = async (req, res) => {
  const requestedLang = allowedLangs.includes(req.body.lang) ? req.body.lang : 'fr';
  const requestedTheme = allowedThemes.includes(req.body.theme) ? req.body.theme : 'prestige';

  if (!req.session.preferences) req.session.preferences = {};
  req.session.preferences.lang = requestedLang;
  req.session.preferences.theme = requestedTheme;

  res.cookie('lang', requestedLang, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: 'lax' });
  res.cookie('theme', requestedTheme, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: 'lax' });

  res.redirect('/settings');
};

exports.uploadLogo = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const file = req.file;

    if (!file) {
      return res.status(400).send('Aucun fichier détecté.');
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${breederId}-${Date.now()}.${fileExtension}`;

    const { error } = await supabase.storage
      .from('logos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
    const logoUrl = publicUrlData.publicUrl;

    await pool.query('UPDATE breeder SET logo_url = $1 WHERE id = $2', [logoUrl, breederId]);

    res.redirect('/settings');
  } catch (error) {
    console.error('Erreur upload logo:', error);
    res.status(500).send('Erreur lors de la sauvegarde du logo.');
  }
};
