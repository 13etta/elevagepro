const { pool } = require('../db');
const supabase = require('../utils/supabase');

const allowedThemes = ['prestige', 'clinical', 'nature'];
const allowedLangs = ['fr', 'en'];

function defaultWebsiteSettings() {
  return {
    primaryColor: '#3f6212',
    secondaryColor: '#b45309',
    heroTitle: '',
    heroSubtitle: 'Élevage canin familial, sélection, passion et accompagnement.',
    heroImageUrl: '',
    servicesEnabled: true,
    newsEnabled: true,
    strengthsEnabled: true,
    galleryEnabled: true,
    contactEnabled: true,
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
    gallery: []
  };
}

function mergeWebsiteSettings(settings) {
  return { ...defaultWebsiteSettings(), ...(settings || {}) };
}

async function ensureSettingsSchema() {
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS name VARCHAR(255)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS slug VARCHAR(180)').catch(() => {});
  await pool.query('ALTER TABLE breeder ADD COLUMN IF NOT EXISTS logo_url TEXT').catch(() => {});
  await pool.query(`ALTER TABLE breeder ADD COLUMN IF NOT EXISTS website_settings JSONB DEFAULT '{}'::jsonb`).catch(() => {});
}

async function uploadPublicImage(breederId, file, folder) {
  if (!file) return null;
  const ext = file.originalname.split('.').pop();
  const fileName = `${folder}/${breederId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('logos')
    .upload(fileName, file.buffer, {
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

    res.render('settings/index', {
      title: res.__('settings.title'),
      breeder,
      websiteSettings: mergeWebsiteSettings(breeder.website_settings),
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
    const { company_name, affix_name, siret, address } = req.body;

    await pool.query(
      `
        UPDATE breeder
        SET company_name = $1,
            name = $1,
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
    await ensureSettingsSchema();
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

exports.updateWebsiteSettings = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query('SELECT website_settings FROM breeder WHERE id = $1', [breederId]);
    const current = mergeWebsiteSettings(result.rows[0]?.website_settings);

    const settings = mergeWebsiteSettings({
      ...current,
      primaryColor: req.body.primaryColor || current.primaryColor,
      secondaryColor: req.body.secondaryColor || current.secondaryColor,
      heroTitle: req.body.heroTitle || '',
      heroSubtitle: req.body.heroSubtitle || '',
      servicesEnabled: req.body.servicesEnabled === 'on',
      newsEnabled: req.body.newsEnabled === 'on',
      strengthsEnabled: req.body.strengthsEnabled === 'on',
      galleryEnabled: req.body.galleryEnabled === 'on',
      contactEnabled: req.body.contactEnabled === 'on',
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

    const heroFile = req.files?.hero_image?.[0];
    const heroUrl = await uploadPublicImage(breederId, heroFile, 'hero');
    if (heroUrl) settings.heroImageUrl = heroUrl;

    const galleryFiles = req.files?.gallery_images || [];
    const gallery = Array.isArray(settings.gallery) ? settings.gallery : [];
    for (const file of galleryFiles) {
      const url = await uploadPublicImage(breederId, file, 'gallery');
      if (url) gallery.push({ url, title: file.originalname });
    }
    settings.gallery = gallery.slice(-24);

    await pool.query('UPDATE breeder SET website_settings = $1 WHERE id = $2', [settings, breederId]);
    res.redirect('/settings');
  } catch (error) {
    console.error('Erreur paramètres vitrine:', error);
    res.status(500).send('Erreur lors de la sauvegarde de la vitrine.');
  }
};
