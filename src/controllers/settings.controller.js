const { pool } = require('../db');
const supabase = require('../utils/supabase');
const {
  allowedWebsiteTemplates,
  mergeWebsiteSettings,
  normalizeBoxCapacity,
  buildWebsiteSettings,
} = require('../services/website-settings.service');

const allowedThemes = ['prestige', 'clinical', 'nature'];
const allowedLangs = ['fr', 'en'];
async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function getLittersForSettings(breederId) {
  const motherColumn = await columnExists('litters', 'mother_id')
    ? 'mother_id'
    : await columnExists('litters', 'female_id')
      ? 'female_id'
      : null;
  const countExpression = await columnExists('litters', 'puppies_count_total')
    ? 'l.puppies_count_total'
    : await columnExists('litters', 'puppies_count')
      ? 'l.puppies_count'
      : await columnExists('litters', 'nb_puppies')
        ? 'l.nb_puppies'
        : 'NULL';
  const statusExpression = await columnExists('litters', 'status') ? 'l.status' : 'NULL::text';
  const motherSelect = motherColumn ? 'mother.name' : 'NULL::text';
  const motherJoin = motherColumn ? `LEFT JOIN dogs mother ON l.${motherColumn} = mother.id` : '';

  const result = await pool.query(
    `
      SELECT
        l.id,
        l.birth_date,
        ${statusExpression} AS status,
        ${countExpression} AS puppies_count,
        ${countExpression} AS nb_puppies,
        ${motherSelect} AS mother_name
      FROM litters l
      ${motherJoin}
      WHERE l.breeder_id = $1
      ORDER BY l.birth_date DESC NULLS LAST
      LIMIT 20
    `,
    [breederId],
  );

  return result.rows;
}

async function ensureSettingsSchema() {
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS address TEXT').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS phone VARCHAR(50)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS email VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS producer_number VARCHAR(100)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS slug VARCHAR(180)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS logo_url TEXT').catch(() => {});
  await pool.query("ALTER TABLE breeder ADD COLUMN IF NOT EXISTS website_settings JSONB DEFAULT '{}'::jsonb").catch(() => {});
}

async function uploadPublicImage(breederId, file, folder) {
  if (!file) return null;
  const ext = file.originalname.split('.').pop();
  const fileName = `${folder}/${breederId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from('logos').upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

function groupedFiles(files) {
  const map = {};
  for (const file of files || []) {
    if (!map[file.fieldname]) map[file.fieldname] = [];
    map[file.fieldname].push(file);
  }
  return map;
}

function arrayFromBody(value) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

exports.getSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);
    const breeder = result.rows[0] || {
      id: breederId,
      company_name: req.session.user.company_name || 'ElevagePro',
      website_settings: {},
    };
    const litters = await getLittersForSettings(breederId).catch((error) => {
      console.error('Erreur chargement portees parametres:', error);
      return [];
    });

    res.render('settings/index', {
      title: res.__('settings.title'),
      breeder,
      websiteSettings: mergeWebsiteSettings(breeder.website_settings),
      publicSiteUrl: `/site/${breeder.slug || breeder.id}`,
      websiteTemplates: allowedWebsiteTemplates,
      litters,
      activeSettingsTab: req.query.tab === 'vitrine' ? 'vitrine' : 'application',
    });
  } catch (error) {
    res.status(500).send('Erreur lors du chargement des paramètres.');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const { company_name, affix_name, siret, producer_number, address, phone, email } = req.body;

    const currentResult = await pool.query('SELECT website_settings FROM breeder WHERE id = $1', [breederId]);
    const currentSettings = mergeWebsiteSettings(currentResult.rows[0]?.website_settings);
    const settings = mergeWebsiteSettings({
      ...currentSettings,
      kennelBoxCapacity: normalizeBoxCapacity(req.body.kennelBoxCapacity, currentSettings.kennelBoxCapacity),
    });

    await pool.query(`
        UPDATE breeder
        SET company_name = $1, name = $1, affix_name = $2, siret = $3, producer_number = $4, address = $5, phone = $6, email = $7, website_settings = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
      `, [company_name, affix_name, siret, producer_number, address, phone, email, settings, breederId]);

    res.redirect('/settings?tab=application');
  } catch (error) {
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
  res.redirect('/settings?tab=application');
};

exports.uploadLogo = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const file = req.file;
    if (!file) return res.status(400).send('Aucun fichier détecté.');
    const logoUrl = await uploadPublicImage(breederId, file, 'logos');
    await pool.query('UPDATE breeder SET logo_url = $1 WHERE id = $2', [logoUrl, breederId]);
    res.redirect('/settings?tab=application');
  } catch (error) {
    res.status(500).send('Erreur lors de la sauvegarde du logo.');
  }
};

exports.updateWebsiteSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT website_settings FROM breeder WHERE id = $1', [breederId]);
    const current = mergeWebsiteSettings(result.rows[0]?.website_settings);
    const files = groupedFiles(req.files);
    const settings = buildWebsiteSettings(req.body, current);

    if (req.body.clearHeroImage === 'on') settings.heroImageUrl = '';
    const heroUrl = await uploadPublicImage(breederId, files.hero_image?.[0], 'hero');
    if (heroUrl) settings.heroImageUrl = heroUrl;

    const serviceImageMap = [
      ['service_pension_image', 'servicePensionImageUrl', 'services/pension'],
      ['service_training_image', 'serviceTrainingImageUrl', 'services/training'],
      ['service_breeding_image', 'serviceBreedingImageUrl', 'services/breeding'],
    ];

    for (const [fieldName, settingKey, folder] of serviceImageMap) {
      if (req.body[`clear_${fieldName}`] === 'on') settings[settingKey] = '';
      const serviceUrl = await uploadPublicImage(breederId, files[fieldName]?.[0], folder);
      if (serviceUrl) settings[settingKey] = serviceUrl;
    }

    const removeGallery = arrayFromBody(req.body.removeGallery);
    let gallery = Array.isArray(settings.gallery) ? settings.gallery : [];
    gallery = gallery.filter((image) => !removeGallery.includes(image.url));
    for (const file of files.gallery_images || []) {
      const url = await uploadPublicImage(breederId, file, 'gallery');
      if (url) gallery.push({ url, title: file.originalname });
    }
    settings.gallery = gallery.slice(-48);

    const removeLitterImages = arrayFromBody(req.body.removeLitterImage);
    const litterGallery = { ...(settings.litterGallery || {}) };
    for (const litterId of Object.keys(litterGallery)) {
      litterGallery[litterId] = (litterGallery[litterId] || []).filter((image) => !removeLitterImages.includes(image.url));
    }

    for (const [fieldName, litterFiles] of Object.entries(files)) {
      if (!fieldName.startsWith('litter_images_')) continue;
      const litterId = fieldName.replace('litter_images_', '');
      if (!litterGallery[litterId]) litterGallery[litterId] = [];
      for (const file of litterFiles) {
        const url = await uploadPublicImage(breederId, file, `litters/${litterId}`);
        if (url) litterGallery[litterId].push({ url, title: file.originalname });
      }
      litterGallery[litterId] = litterGallery[litterId].slice(-12);
    }
    settings.litterGallery = litterGallery;

    await pool.query('UPDATE breeder SET website_settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [settings, breederId]);
    req.session.flash = { type: 'success', message: 'Site vitrine enregistré. Les panneaux et contenus publics sont à jour.' };
    res.redirect('/settings?tab=vitrine');
  } catch (error) {
    console.error('Erreur sauvegarde vitrine:', error);
    res.status(500).send('Erreur lors de la sauvegarde de la vitrine.');
  }
};
