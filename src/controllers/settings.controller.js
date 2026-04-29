const { pool } = require('../db');
const supabase = require('../utils/supabase');

const allowedThemes = ['prestige', 'clinical', 'nature'];
const allowedLangs = ['fr', 'en'];
const websiteTemplates = ['heritage', 'field', 'luxury', 'minimal', 'breeder'];

function defaultWebsiteSettings() {
  return {
    template: 'heritage',
    primaryColor: '#6d7c45',
    secondaryColor: '#c8b397',
    accentColor: '#2b2014',
    backgroundColor: '#f6f1e8',
    textColor: '#2b2014',
    heroTitle: '',
    heroSubtitle: 'Élevage canin familial, sélection, passion et accompagnement.',
    heroImageUrl: '',
    introTitle: 'Une sélection lisible, suivie et assumée',
    introText: 'Nous privilégions une sélection cohérente : santé, tempérament, aptitude naturelle, équilibre familial et accompagnement durable des adoptants.',
    showIntro: true,
    showPuppies: true,
    showLitters: true,
    showDogs: true,
    showServices: true,
    showGallery: true,
    showContact: true,
    service1Title: 'Élevage canin',
    service1Text: 'Sélection raisonnée, suivi des portées et accompagnement des familles.',
    service2Title: 'Conseil & accompagnement',
    service2Text: 'Aide au choix du chiot, socialisation et suivi après départ.',
    service3Title: 'Sélection cynotechnique',
    service3Text: 'Travail sur la santé, le tempérament, le type et les aptitudes naturelles.',
    newsTitle: 'Actualités de l’élevage',
    newsText: 'Retrouvez nos disponibilités, projets de portées et nouvelles de l’élevage.',
    strengths: 'Sélection raisonnée\nSuivi sanitaire structuré\nAccompagnement après départ\nPassion cynophile',
    phone: '',
    publicEmail: '',
    instagram: '',
    facebook: '',
    gallery: [],
    litterGallery: {},
  };
}

function mergeWebsiteSettings(settings) {
  return { ...defaultWebsiteSettings(), ...(settings || {}) };
}

async function ensureSettingsSchema() {
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS affix_name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS address TEXT').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS slug VARCHAR(180)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS logo_url TEXT').catch(() => {});
  await pool.query("ALTER TABLE breeder ADD COLUMN IF NOT EXISTS website_settings JSONB DEFAULT '{}'::jsonb").catch(() => {});
}

function filesByField(files) {
  return (files || []).reduce((acc, file) => {
    if (!acc[file.fieldname]) acc[file.fieldname] = [];
    acc[file.fieldname].push(file);
    return acc;
  }, {});
}

function arrayValue(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function uploadPublicImage(breederId, file, folder) {
  if (!file) return null;
  const ext = String(file.originalname || 'webp').split('.').pop();
  const fileName = `${folder}/${breederId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from('logos').upload(fileName, file.buffer, {
    contentType: file.mimetype,
    upsert: true,
  });

  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

exports.getSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);
    const breeder = result.rows[0];
    const litters = await pool.query(
      `SELECT l.id, l.birth_date, l.status, l.puppies_count, l.nb_puppies, mother.name AS mother_name
       FROM litters l
       LEFT JOIN dogs mother ON l.female_id = mother.id
       WHERE l.breeder_id = $1
       ORDER BY l.birth_date DESC NULLS LAST
       LIMIT 20`,
      [breederId],
    ).catch(() => ({ rows: [] }));

    res.render('settings/index', {
      title: res.__('settings.title'),
      breeder,
      websiteSettings: mergeWebsiteSettings(breeder.website_settings),
      websiteTemplates,
      litters: litters.rows,
      publicSiteUrl: `/site/${breeder.slug || breeder.id}`,
    });
  } catch (error) {
    console.error('Erreur lecture paramètres:', error);
    res.status(500).send('Erreur lors du chargement des paramètres.');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const { company_name, affix_name, siret, producer_number, address } = req.body;

    await pool.query(
      `UPDATE breeder
       SET company_name = $1,
           name = $1,
           affix_name = $2,
           siret = $3,
           producer_number = $4,
           address = $5
       WHERE id = $6`,
      [company_name, affix_name, siret, producer_number, address, breederId],
    );

    res.redirect('/settings?tab=application');
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
  res.redirect('/settings?tab=application');
};

exports.uploadLogo = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    if (!req.file) return res.status(400).send('Aucun fichier détecté.');

    const logoUrl = await uploadPublicImage(breederId, req.file, 'logos');
    await pool.query('UPDATE breeder SET logo_url = $1 WHERE id = $2', [logoUrl, breederId]);
    res.redirect('/settings?tab=application');
  } catch (error) {
    console.error('Erreur upload logo:', error);
    res.status(500).send('Erreur lors de la sauvegarde du logo.');
  }
};

exports.updateWebsiteSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT website_settings FROM breeder WHERE id = $1', [breederId]);
    const current = mergeWebsiteSettings(result.rows[0]?.website_settings);
    const files = filesByField(req.files);

    const settings = mergeWebsiteSettings({
      ...current,
      template: websiteTemplates.includes(req.body.template) ? req.body.template : current.template,
      primaryColor: req.body.primaryColor || current.primaryColor,
      secondaryColor: req.body.secondaryColor || current.secondaryColor,
      accentColor: req.body.accentColor || current.accentColor,
      backgroundColor: req.body.backgroundColor || current.backgroundColor,
      textColor: req.body.textColor || current.textColor,
      heroTitle: req.body.heroTitle || '',
      heroSubtitle: req.body.heroSubtitle || '',
      introTitle: req.body.introTitle || '',
      introText: req.body.introText || '',
      showIntro: req.body.showIntro === 'on',
      showPuppies: req.body.showPuppies === 'on',
      showLitters: req.body.showLitters === 'on',
      showDogs: req.body.showDogs === 'on',
      showServices: req.body.showServices === 'on',
      showGallery: req.body.showGallery === 'on',
      showContact: req.body.showContact === 'on',
      service1Title: req.body.service1Title || '',
      service1Text: req.body.service1Text || '',
      service2Title: req.body.service2Title || '',
      service2Text: req.body.service2Text || '',
      service3Title: req.body.service3Title || '',
      service3Text: req.body.service3Text || '',
      newsTitle: req.body.newsTitle || '',
      newsText: req.body.newsText || '',
      strengths: req.body.strengths || '',
      phone: req.body.phone || '',
      publicEmail: req.body.publicEmail || '',
      instagram: req.body.instagram || '',
      facebook: req.body.facebook || '',
    });

    if (req.body.clearHeroImage === 'on') settings.heroImageUrl = '';
    const heroUrl = await uploadPublicImage(breederId, files.hero_image?.[0], 'hero');
    if (heroUrl) settings.heroImageUrl = heroUrl;

    let gallery = Array.isArray(settings.gallery) ? settings.gallery : [];
    const removeGallery = arrayValue(req.body.removeGallery);
    gallery = gallery.filter((image) => !removeGallery.includes(image.url));
    for (const file of files.gallery_images || []) {
      const url = await uploadPublicImage(breederId, file, 'gallery');
      if (url) gallery.push({ url, title: file.originalname });
    }
    settings.gallery = gallery.slice(-48);

    const litterGallery = { ...(settings.litterGallery || {}) };
    const removeLitterImages = arrayValue(req.body.removeLitterImage);
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

    await pool.query('UPDATE breeder SET website_settings = $1 WHERE id = $2', [settings, breederId]);
    res.redirect('/settings?tab=vitrine');
  } catch (error) {
    console.error('Erreur paramètres vitrine:', error);
    res.status(500).send('Erreur lors de la sauvegarde de la vitrine.');
  }
};
