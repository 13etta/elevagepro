(() => {
  const form = document.querySelector('#website-settings-form');
  const frame = document.querySelector('#website-preview-frame');
  if (!form || !frame) return;

  const get = (name) => form.elements[name];
  const value = (name) => get(name)?.value || '';
  const checked = (name) => Boolean(get(name)?.checked);
  const templatePalettes = {
    heritage: { primaryColor: '#29422c', secondaryColor: '#bda66f', accentColor: '#f4efe2', backgroundColor: '#f6f1e8', textColor: '#24301f' },
    field: { primaryColor: '#41552b', secondaryColor: '#9a7444', accentColor: '#1f2a1d', backgroundColor: '#eef1e8', textColor: '#1f2a1d' },
    luxury: { primaryColor: '#c79a45', secondaryColor: '#7a4b28', accentColor: '#0f0b08', backgroundColor: '#17120d', textColor: '#fff4df' },
    minimal: { primaryColor: '#111827', secondaryColor: '#d1d5db', accentColor: '#ffffff', backgroundColor: '#f8fafc', textColor: '#111827' },
    breeder: { primaryColor: '#9a3412', secondaryColor: '#fed7aa', accentColor: '#fff7ed', backgroundColor: '#fff7ed', textColor: '#431407' },
  };

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

  const setOptionalText = (doc, selector, text) => {
    const container = doc.querySelector(selector);
    if (!container) return;
    const target = container.querySelector('span') || container;
    target.textContent = text;
    container.style.display = text ? '' : 'none';
  };

  const setHeroImage = (doc, url) => {
    if (!url) return;
    const hero = doc.querySelector('.forest-hero');
    if (!hero) return;
    hero.style.backgroundImage = `linear-gradient(90deg,rgba(0,0,0,.52),rgba(0,0,0,.18)),url('${url}')`;
  };

  const updateService = (doc, key, enabledName, titleName, textName, buttonName, imageName) => {
    const service = doc.querySelector(`.forest-service[data-service-key="${key}"]`);
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

    setText(doc, '.forest-site-slogan', value('siteSlogan'));
    setDisplay(doc, '.forest-site-slogan', Boolean(value('siteSlogan')));
    setText(doc, '.forest-hero h1', value('heroTitle') || 'Élevage et Dressage de prestige');
    setText(doc, '.forest-hero p', value('heroSubtitle') || 'Excellence canine au cœur de la nature.');
    setText(doc, '[data-cta="primary"]', value('primaryCtaLabel') || 'Nos services');
    setText(doc, '[data-cta="secondary"]', value('secondaryCtaLabel') || 'Contactez-nous');
    setText(doc, '.forest-newsbar strong', value('contactStripTitle') || 'La saison est ouverte : contactez l’élevage pour les disponibilités.');
    setText(doc, '.forest-newsbar a', value('contactStripText') || 'En savoir plus');

    const root = doc.body;
    root.style.setProperty('--forest-primary', value('primaryColor') || '#29422c');
    root.style.setProperty('--forest-secondary', value('secondaryColor') || '#bda66f');
    root.style.setProperty('--forest-accent', value('accentColor') || '#f4efe2');
    root.style.setProperty('--forest-bg', value('backgroundColor') || '#f6f1e8');
    root.style.setProperty('--forest-text', value('textColor') || '#24301f');
    const selectedTemplate = form.querySelector('input[name="template"]:checked')?.value || 'heritage';
    root.classList.remove(...Array.from(root.classList).filter((name) => name.startsWith('template-')));
    root.classList.add(`template-${selectedTemplate}`);

    const heroFile = get('hero_image')?.files?.[0];
    if (heroFile) setHeroImage(doc, URL.createObjectURL(heroFile));

    setDisplay(doc, '#services', checked('showServices'));
    setDisplay(doc, '#intro', checked('showIntro'));
    setDisplay(doc, '#selection', checked('showDogs'));
    setDisplay(doc, '.forest-litters', checked('showLitters'));
    setDisplay(doc, '#chiots', checked('showPuppies'));
    setDisplay(doc, '#galerie', checked('showGallery'));
    setDisplay(doc, '.forest-strengths', checked('showStrengths'));
    setDisplay(doc, '#contact', checked('showContact'));
    setDisplay(doc, '[data-cta="primary"]', checked('showServices'));
    setDisplay(doc, '[data-cta="secondary"]', checked('showContact'));

    updateService(doc, 'pension', 'servicePensionEnabled', 'servicePensionTitle', 'servicePensionText', 'servicePensionButton', 'service_pension_image');
    updateService(doc, 'training', 'serviceTrainingEnabled', 'serviceTrainingTitle', 'serviceTrainingText', 'serviceTrainingButton', 'service_training_image');
    updateService(doc, 'breeding', 'serviceBreedingEnabled', 'serviceBreedingTitle', 'serviceBreedingText', 'serviceBreedingButton', 'service_breeding_image');

    setText(doc, '#services .forest-section-title span', value('serviceSectionKicker') || 'Savoir-faire');
    setText(doc, '#services .forest-section-title h2', value('serviceSectionTitle') || 'Nos services');
    setText(doc, '#intro h2', value('introTitle') || 'Notre élevage');
    setText(doc, '#intro > p', value('introText'));
    setText(doc, '.forest-strengths-kicker', value('strengthsKicker') || 'Engagements');
    setText(doc, '.forest-strengths h2', value('strengthsTitle') || 'Pourquoi nous choisir');
    setText(doc, '.forest-contact-form h2', value('contactPanelTitle') || 'Contact');
    setText(doc, '.forest-contact-copy', value('contactPanelText'));
    setDisplay(doc, '.forest-contact-copy', Boolean(value('contactPanelText')));
    setOptionalText(doc, '[data-contact-key="openingHours"]', value('openingHours'));
    setOptionalText(doc, '[data-contact-key="instagram"]', value('instagram'));
    setOptionalText(doc, '[data-contact-key="facebook"]', value('facebook'));
    setText(doc, '.forest-footer p', value('footerText'));
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
  form.querySelectorAll('input[name="template"]').forEach((input) => {
    input.addEventListener('change', () => {
      const palette = templatePalettes[input.value];
      if (!input.checked || !palette) return;
      Object.entries(palette).forEach(([name, color]) => {
        const colorInput = get(name);
        if (colorInput) colorInput.value = color;
      });
      schedule();
    });
  });
})();
