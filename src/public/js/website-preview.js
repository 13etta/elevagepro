(() => {
  const form = document.querySelector('#website-settings-form');
  const frame = document.querySelector('#website-preview-frame');
  if (!form || !frame) return;

  const get = (name) => form.elements[name];
  const value = (name) => get(name)?.value || '';
  const checked = (name) => Boolean(get(name)?.checked);

  const withDoc = (callback) => {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (!doc) return;
      callback(doc);
    } catch (error) {
      // Same-origin expected. If browser blocks access, keep iframe as saved preview.
    }
  };

  const setText = (doc, selector, text) => {
    const node = doc.querySelector(selector);
    if (node && text !== undefined) node.textContent = text;
  };

  const setDisplay = (doc, selector, visible) => {
    doc.querySelectorAll(selector).forEach((node) => {
      node.style.display = visible ? '' : 'none';
    });
  };

  const setHeroImage = (doc, url) => {
    if (!url) return;
    const hero = doc.querySelector('.forest-hero');
    if (!hero) return;
    hero.style.backgroundImage = `linear-gradient(90deg,rgba(0,0,0,.52),rgba(0,0,0,.18)),url('${url}')`;
  };

  const updateService = (doc, index, enabledName, titleName, textName, buttonName, imageName) => {
    const service = doc.querySelectorAll('.forest-service')[index];
    if (!service) return;
    service.style.display = checked('showServices') && checked(enabledName) ? '' : 'none';
    setText(service, 'h2', value(titleName));
    setText(service, 'p', value(textName));
    setText(service, 'a', value(buttonName) || 'Découvrir');

    const fileInput = get(imageName);
    const file = fileInput?.files?.[0];
    const img = service.querySelector('img');
    if (file && img) img.src = URL.createObjectURL(file);
  };

  const setTextInNode = (root, selector, text) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = text;
  };

  const applyPreview = () => withDoc((doc) => {
    const siteTitle = document.querySelector('input[name="company_name"]')?.value;
    if (siteTitle) {
      setText(doc, '.forest-logo strong', siteTitle);
      setText(doc, '.forest-footer strong', siteTitle);
    }

    setText(doc, '.forest-hero h1', value('heroTitle') || 'Élevage et Dressage de prestige');
    setText(doc, '.forest-hero p', value('heroSubtitle') || 'Excellence canine au cœur de la nature.');
    setText(doc, '.forest-newsbar strong', value('contactStripTitle') || 'La saison est ouverte : contactez l’élevage pour les disponibilités.');
    setText(doc, '.forest-newsbar a', value('contactStripText') || 'En savoir plus');

    const root = doc.body;
    root.style.setProperty('--forest-primary', value('primaryColor') || '#29422c');
    root.style.setProperty('--forest-secondary', value('secondaryColor') || '#bda66f');
    root.style.setProperty('--forest-bg', value('backgroundColor') || '#f6f1e8');
    root.style.setProperty('--forest-text', value('textColor') || '#24301f');

    const heroFile = get('hero_image')?.files?.[0];
    if (heroFile) setHeroImage(doc, URL.createObjectURL(heroFile));

    setDisplay(doc, '#services', checked('showServices'));
    setDisplay(doc, '#selection', checked('showDogs'));
    setDisplay(doc, '.forest-litters', checked('showLitters'));
    setDisplay(doc, '#chiots', checked('showPuppies'));
    setDisplay(doc, '#galerie', checked('showGallery'));
    setDisplay(doc, '.forest-strengths', checked('showStrengths'));
    setDisplay(doc, '#contact', checked('showContact'));

    updateService(doc, 0, 'servicePensionEnabled', 'servicePensionTitle', 'servicePensionText', 'servicePensionButton', 'service_pension_image');
    updateService(doc, 1, 'serviceTrainingEnabled', 'serviceTrainingTitle', 'serviceTrainingText', 'serviceTrainingButton', 'service_training_image');
    updateService(doc, 2, 'serviceBreedingEnabled', 'serviceBreedingTitle', 'serviceBreedingText', 'serviceBreedingButton', 'service_breeding_image');

    setText(doc, '.forest-strengths h2', value('strengthsTitle') || 'Pourquoi nous choisir');
    const strengths = value('strengths').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    doc.querySelectorAll('.forest-strengths article').forEach((article, index) => {
      article.style.display = strengths[index] ? '' : 'none';
      if (strengths[index]) setTextInNode(article, 'strong', strengths[index]);
    });
  });

  let raf = null;
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applyPreview);
  };

  frame.addEventListener('load', applyPreview);
  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
})();
