const allowedWebsiteTemplates = ['heritage', 'field', 'luxury', 'minimal', 'breeder'];

const websiteTemplatePalettes = {
  heritage: { primaryColor: '#29422c', secondaryColor: '#bda66f', accentColor: '#f4efe2', backgroundColor: '#f6f1e8', textColor: '#24301f' },
  field: { primaryColor: '#41552b', secondaryColor: '#9a7444', accentColor: '#1f2a1d', backgroundColor: '#eef1e8', textColor: '#1f2a1d' },
  luxury: { primaryColor: '#c79a45', secondaryColor: '#7a4b28', accentColor: '#0f0b08', backgroundColor: '#17120d', textColor: '#fff4df' },
  minimal: { primaryColor: '#111827', secondaryColor: '#d1d5db', accentColor: '#ffffff', backgroundColor: '#f8fafc', textColor: '#111827' },
  breeder: { primaryColor: '#9a3412', secondaryColor: '#fed7aa', accentColor: '#fff7ed', backgroundColor: '#fff7ed', textColor: '#431407' },
};

const textSettingKeys = [
  'heroEyebrow', 'dogsTitle', 'puppiesTitle', 'littersTitle', 'galleryTitle', 'publicEmail', 'phone',
  'heroTitle', 'heroSubtitle', 'siteSlogan',
  'contactStripTitle', 'contactStripText',
  'primaryCtaLabel', 'secondaryCtaLabel',
  'serviceSectionTitle', 'serviceSectionKicker',
  'servicePensionTitle', 'servicePensionText', 'servicePensionButton',
  'serviceTrainingTitle', 'serviceTrainingText', 'serviceTrainingButton',
  'serviceBreedingTitle', 'serviceBreedingText', 'serviceBreedingButton',
  'introTitle', 'introText',
  'strengthsTitle', 'strengthsKicker', 'strengths',
  'contactPanelTitle', 'contactPanelText',
  'footerText', 'openingHours', 'instagram', 'facebook',
  'newsTitle', 'newsText',
];

const checkboxSettingKeys = [
  'isPublished',
  'showIntro', 'showPuppies', 'showLitters', 'showDogs',
  'showServices', 'showGallery', 'showContact', 'showStrengths',
  'servicePensionEnabled', 'serviceTrainingEnabled', 'serviceBreedingEnabled',
];

function defaultWebsiteSettings() {
  return {
    heroEyebrow: 'Une rencontre. Une histoire.',
    heroLayout: 'editorial', headingFont: 'serif', imagePosition: 'center',
    dogsTitle: 'Les compagnons de notre histoire', puppiesTitle: 'Votre histoire commence ici',
    littersTitle: 'Les nouvelles générations', galleryTitle: 'Instants de vie à l’élevage',
    publicEmail: '', phone: '',
    primaryInk: '#ffffff', accentInk: '#111111',
    isPublished: true, // Preserve existing published sites; registration explicitly starts in draft.
    template: 'heritage', kennelBoxCapacity: 12,
    primaryColor: '#29422c', secondaryColor: '#bda66f', accentColor: '#f4efe2', backgroundColor: '#f6f1e8', textColor: '#24301f',
    heroTitle: 'Élevage et Dressage de prestige',
    heroSubtitle: 'Excellence canine au cœur de la nature.',
    heroImageUrl: '',
    siteSlogan: 'Élevage canin familial, sélection et accompagnement.',
    contactStripTitle: 'La saison est ouverte : contactez l’élevage pour les disponibilités.',
    contactStripText: 'Portées, pension, dressage, conseils et accompagnement.',
    primaryCtaLabel: 'Nos services', secondaryCtaLabel: 'Contactez-nous',
    serviceSectionTitle: 'Nos services', serviceSectionKicker: 'Savoir-faire',
    strengthsTitle: 'Pourquoi nous choisir', strengthsKicker: 'Engagements',
    contactPanelTitle: 'Contact direct', contactPanelText: 'Un élevage sérieux transmet une lignée, une méthode et un suivi.',
    footerText: 'Élevage canin familial.', openingHours: '', instagram: '', facebook: '',
    introTitle: 'Une sélection lisible, suivie et assumée',
    introText: 'Nous privilégions une sélection cohérente : santé, tempérament, aptitude naturelle, équilibre familial et accompagnement durable des adoptants.',
    showIntro: true, showPuppies: true, showLitters: true, showDogs: true, showServices: true, showGallery: true, showContact: true, showStrengths: true,
    servicesEnabled: true, newsEnabled: true, strengthsEnabled: true, galleryEnabled: true, contactEnabled: true,
    servicePensionEnabled: true,
    serviceTrainingEnabled: true,
    serviceBreedingEnabled: true,
    servicePensionTitle: 'Pension Canine',
    servicePensionText: 'Accueil structuré, cadre propre, suivi quotidien et respect du rythme de chaque chien.',
    servicePensionButton: 'Découvrir la pension',
    servicePensionImageUrl: '',
    serviceTrainingTitle: 'Dressage et Éducation',
    serviceTrainingText: 'Travail progressif, conduite, obéissance, préparation terrain et accompagnement du binôme.',
    serviceTrainingButton: 'Programmes de dressage',
    serviceTrainingImageUrl: '',
    serviceBreedingTitle: 'Élevage de Sélection',
    serviceBreedingText: 'Sélection des reproducteurs, suivi sanitaire, portées raisonnées et accompagnement durable.',
    serviceBreedingButton: 'Nos portées actuelles',
    serviceBreedingImageUrl: '',
    service1Title: 'Pension Canine', service1Text: 'Accueil structuré, cadre propre, suivi quotidien et respect du rythme de chaque chien.',
    service2Title: 'Dressage et Éducation', service2Text: 'Travail progressif, conduite, obéissance, préparation terrain et accompagnement du binôme.',
    service3Title: 'Élevage de Sélection', service3Text: 'Sélection des reproducteurs, suivi sanitaire, portées raisonnées et accompagnement durable.',
    newsTitle: 'Actualités de l’élevage', newsText: 'Retrouvez nos disponibilités, projets de portées et nouvelles de l’élevage.',
    strengths: 'Expérience & Expertise\nQualité & Bien-être\nNutrition & Santé',
    gallery: [], litterGallery: {},
  };
}

function mergeWebsiteSettings(settings) {
  const merged = { ...defaultWebsiteSettings(), ...(settings || {}) };
  if (!allowedWebsiteTemplates.includes(merged.template)) merged.template = 'heritage';
  for (const key of Object.keys(websiteTemplatePalettes.heritage)) {
    if (!/^#[0-9a-f]{6}$/i.test(merged[key])) merged[key] = websiteTemplatePalettes[merged.template][key];
  }
  for (const [key, values] of Object.entries(websiteDesignOptions)) {
    if (!values.includes(merged[key])) merged[key] = values[0];
  }
  merged.gallery = Array.isArray(merged.gallery) ? merged.gallery : [];
  merged.litterGallery = merged.litterGallery && typeof merged.litterGallery === 'object' ? merged.litterGallery : {};
  merged.primaryInk = contrastInk(merged.primaryColor);
  merged.accentInk = contrastInk(merged.accentColor);
  return merged;
}

const websiteDesignOptions = {
  heroLayout: ['editorial', 'centered'],
  headingFont: ['serif', 'sans'],
  imagePosition: ['center', 'top', 'bottom', 'left', 'right'],
};

function contrastInk(hex) {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
  const linear = rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179 ? '#111111' : '#ffffff';
}

function normalizeBoxCapacity(value, fallback = 12) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 500));
}

function textFromBody(body, current, key) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return current[key];
  return String(body[key] || '').trim();
}

function buildWebsiteSettings(body = {}, currentSettings = {}) {
  const current = mergeWebsiteSettings(currentSettings);
  const requestedTemplate = allowedWebsiteTemplates.includes(body.template) ? body.template : current.template;
  const templateChanged = requestedTemplate !== current.template;
  const palette = websiteTemplatePalettes[requestedTemplate] || websiteTemplatePalettes.heritage;
  const next = {
    ...current,
    template: requestedTemplate,
    kennelBoxCapacity: normalizeBoxCapacity(current.kennelBoxCapacity, 12),
  };

  for (const key of ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor']) {
    const submitted = textFromBody(body, current, key);
    next[key] = templateChanged && submitted === current[key] ? palette[key] : submitted;
  }

  for (const key of textSettingKeys) next[key] = textFromBody(body, current, key);
  for (const [key, values] of Object.entries(websiteDesignOptions)) {
    if (values.includes(body[key])) next[key] = body[key];
  }
  next.publicEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(next.publicEmail) ? next.publicEmail : '';
  next.phone = /^[+\d\s().-]{3,30}$/.test(next.phone) ? next.phone : '';
  for (const key of checkboxSettingKeys) next[key] = body[key] === 'on';

  next.servicesEnabled = next.showServices;
  next.galleryEnabled = next.showGallery;
  next.contactEnabled = next.showContact;
  next.strengthsEnabled = next.showStrengths;
  next.service1Title = next.servicePensionTitle;
  next.service1Text = next.servicePensionText;
  next.service2Title = next.serviceTrainingTitle;
  next.service2Text = next.serviceTrainingText;
  next.service3Title = next.serviceBreedingTitle;
  next.service3Text = next.serviceBreedingText;

  return mergeWebsiteSettings(next);
}

function buildServices(settings) {
  const services = [
    { key: 'pension', enabled: settings.servicePensionEnabled, title: settings.servicePensionTitle, text: settings.servicePensionText, button: settings.servicePensionButton, imageUrl: settings.servicePensionImageUrl, anchor: '#contact' },
    { key: 'training', enabled: settings.serviceTrainingEnabled, title: settings.serviceTrainingTitle, text: settings.serviceTrainingText, button: settings.serviceTrainingButton, imageUrl: settings.serviceTrainingImageUrl, anchor: '#contact' },
    { key: 'breeding', enabled: settings.serviceBreedingEnabled, title: settings.serviceBreedingTitle, text: settings.serviceBreedingText, button: settings.serviceBreedingButton, imageUrl: settings.serviceBreedingImageUrl, anchor: settings.showLitters ? '#portees' : settings.showPuppies ? '#chiots' : settings.showDogs ? '#selection' : settings.showIntro ? '#intro' : '#accueil' },
  ];

  return services;
}

module.exports = {
  websiteDesignOptions,
  allowedWebsiteTemplates,
  websiteTemplatePalettes,
  textSettingKeys,
  checkboxSettingKeys,
  defaultWebsiteSettings,
  mergeWebsiteSettings,
  normalizeBoxCapacity,
  buildWebsiteSettings,
  buildServices,
};
