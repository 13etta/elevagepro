const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const {
  defaultWebsiteSettings,
  buildWebsiteSettings,
  buildServices,
  websiteTemplatePalettes,
  textSettingKeys,
  checkboxSettingKeys,
} = require('../src/services/website-settings.service');

test('tous les textes visibles du configurateur sont enregistrés', () => {
  const current = defaultWebsiteSettings();
  const body = {
    template: 'heritage',
    primaryColor: current.primaryColor,
    secondaryColor: current.secondaryColor,
    accentColor: current.accentColor,
    backgroundColor: current.backgroundColor,
    textColor: current.textColor,
    heroTitle: 'Des Hautes Quêtes',
    siteSlogan: 'Le beau et le bon',
    serviceSectionKicker: 'Notre savoir-faire',
    serviceSectionTitle: 'Nos activités',
    introTitle: 'Notre philosophie',
    introText: 'Setter Anglais de chasse et de compétition.',
    strengthsKicker: 'Nos engagements',
    contactPanelTitle: 'Parlons de votre projet',
    contactPanelText: 'Contact direct avec l’éleveur.',
    footerText: 'Des Hautes Quêtes — Setter Anglais',
    openingHours: 'Sur rendez-vous',
    instagram: '@hautesquetes',
    facebook: 'Des Hautes Quêtes',
    showIntro: 'on',
    showServices: 'on',
    showDogs: 'on',
    showContact: 'on',
    serviceBreedingEnabled: 'on',
  };

  const settings = buildWebsiteSettings(body, current);

  assert.equal(settings.heroTitle, 'Des Hautes Quêtes');
  assert.equal(settings.siteSlogan, 'Le beau et le bon');
  assert.equal(settings.serviceSectionTitle, 'Nos activités');
  assert.equal(settings.instagram, '@hautesquetes');
  assert.equal(settings.facebook, 'Des Hautes Quêtes');
  assert.equal(settings.footerText, 'Des Hautes Quêtes — Setter Anglais');
  assert.equal(settings.showIntro, true);
  assert.equal(settings.showGallery, false);
  assert.equal(settings.servicePensionEnabled, false);
});

test('un champ ancien absent du formulaire n’est plus effacé à la sauvegarde', () => {
  const current = {
    ...defaultWebsiteSettings(),
    newsTitle: 'Actualité conservée',
    newsText: 'Texte conservé',
  };

  const settings = buildWebsiteSettings({
    template: current.template,
    primaryColor: current.primaryColor,
    secondaryColor: current.secondaryColor,
    accentColor: current.accentColor,
    backgroundColor: current.backgroundColor,
    textColor: current.textColor,
  }, current);

  assert.equal(settings.newsTitle, 'Actualité conservée');
  assert.equal(settings.newsText, 'Texte conservé');
});

test('changer de template applique une palette cohérente', () => {
  const settings = buildWebsiteSettings({ template: 'luxury' }, defaultWebsiteSettings());

  assert.equal(settings.primaryColor, websiteTemplatePalettes.luxury.primaryColor);
  assert.equal(settings.backgroundColor, websiteTemplatePalettes.luxury.backgroundColor);
  assert.equal(settings.textColor, websiteTemplatePalettes.luxury.textColor);
});

test('les trois services restent présents dans l’aperçu même lorsqu’ils sont masqués', () => {
  const settings = { ...defaultWebsiteSettings(), servicePensionEnabled: false };
  const services = buildServices(settings);

  assert.deepEqual(services.map((service) => service.key), ['pension', 'training', 'breeding']);
  assert.equal(services[0].enabled, false);
});

test('les panneaux publics existent toujours et suivent leur case à cocher', async () => {
  const templatePath = path.resolve(__dirname, '../src/views/website/public-site.ejs');
  const settings = {
    ...defaultWebsiteSettings(),
    showIntro: false,
    showDogs: true,
    showLitters: true,
    showPuppies: true,
    showGallery: true,
  };

  const html = await ejs.renderFile(templatePath, {
    title: 'Test vitrine',
    breeder: { company_name: 'Des Hautes Quêtes' },
    websiteSettings: settings,
    publicServices: buildServices(settings),
    dogsByBreed: {},
    puppiesByBreed: {},
    littersByBreed: {},
    formatDate: () => '-',
  });

  assert.match(html, /id="intro"[^>]*display:none/);
  assert.match(html, /id="selection"/);
  assert.match(html, /Aucun chien adulte n’est encore publié/);
  assert.match(html, /Aucune portée n’est encore publiée/);
  assert.match(html, /Aucun chiot n’est actuellement publié/);
  assert.match(html, /La galerie sera visible/);
  assert.match(html, /data-service-key="pension"/);
});

test('les jointures du site public restent isolées par élevage', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/website.routes.js'), 'utf8');

  assert.match(source, /l\.breeder_id = p\.breeder_id/);
  assert.match(source, /mother\.breeder_id = p\.breeder_id/);
  assert.match(source, /mother\.breeder_id = l\.breeder_id/);
});

test('chaque réglage visible possède un traitement de sauvegarde explicite', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/views/settings/index.ejs'), 'utf8');
  const websiteForm = source.match(/<form id="website-settings-form"([\s\S]*?)<\/form>/)?.[1] || '';
  const visibleNames = Array.from(websiteForm.matchAll(/name="([^"]+)"/g), (match) => match[1]);
  const handledNames = new Set([
    ...textSettingKeys,
    ...checkboxSettingKeys,
    'template', 'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor',
    '_csrf', 'hero_image', 'clearHeroImage', 'gallery_images', 'removeGallery',
    'service_pension_image', 'service_training_image', 'service_breeding_image',
    'clear_service_pension_image', 'clear_service_training_image', 'clear_service_breeding_image',
  ]);

  assert.deepEqual(visibleNames.filter((name) => !handledNames.has(name)), []);
});
