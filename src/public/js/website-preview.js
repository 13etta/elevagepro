(() => {
  const form = document.querySelector('#website-settings-form');
  const frame = document.querySelector('#website-preview-frame');
  if (!form || !frame) return;

  const objectUrls = new Map();
  const fileUrl = (file) => {
    if (!objectUrls.has(file)) objectUrls.set(file, URL.createObjectURL(file));
    return objectUrls.get(file);
  };
  window.addEventListener('pagehide', () => { objectUrls.forEach((url) => URL.revokeObjectURL(url)); objectUrls.clear(); });
  let savedHero = '';
  let savedGallery = [];
  const savedServiceImages = {};
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
    const hero = doc.querySelector('.forest-hero-photo');
    if (!hero) return;
    hero.src = url;
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
    if (img) {
      savedServiceImages[key] ||= img.src;
      img.src = file ? fileUrl(file) : checked('clear_' + imageName) ? img.dataset.fallbackSrc || fallbackPhoto : savedServiceImages[key];
    }
  };

  const fallbackPhoto = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80';

  const contrastInk = (hex) => {
    const linear = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179 ? '#111111' : '#ffffff';
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
    setText(doc, '.forest-news-copy', value('contactStripText'));

    const root = doc.body;
    root.style.setProperty('--primary-ink', contrastInk(value('primaryColor')));
    root.style.setProperty('--accent-ink', contrastInk(value('accentColor')));
    root.dataset.layout = value('heroLayout');
    root.dataset.font = value('headingFont');
    root.style.setProperty('--hero-position', value('imagePosition'));
    setText(doc, '.forest-eyebrow', value('heroEyebrow'));
    [['dogsTitle','#selection'],['puppiesTitle','#chiots'],['littersTitle','#portees'],['galleryTitle','#galerie']].forEach(([key, selector]) => setText(doc, selector + ' .forest-section-title h2', value(key)));
    doc.querySelectorAll('[data-nav-setting]').forEach((link) => { link.style.display = checked(link.dataset.navSetting) ? '' : 'none'; });
    form.querySelectorAll('.template-option').forEach((option) => option.classList.toggle('selected', option.querySelector('input').checked));

    root.style.setProperty('--forest-primary', value('primaryColor') || '#29422c');
    root.style.setProperty('--forest-secondary', value('secondaryColor') || '#bda66f');
    root.style.setProperty('--forest-accent', value('accentColor') || '#f4efe2');
    root.style.setProperty('--forest-bg', value('backgroundColor') || '#f6f1e8');
    root.style.setProperty('--forest-text', value('textColor') || '#24301f');
    const selectedTemplate = form.querySelector('input[name="template"]:checked')?.value || 'heritage';
    root.classList.remove(...Array.from(root.classList).filter((name) => name.startsWith('template-')));
    root.classList.add(`template-${selectedTemplate}`);

    const heroFile = get('hero_image')?.files?.[0];
    savedHero ||= doc.querySelector('.forest-hero-photo')?.src || fallbackPhoto;
    const removed = Array.from(form.querySelectorAll('input[name="removeGallery"]:checked')).map((input) => input.value);
    const gallery = savedGallery.filter((image) => !removed.includes(image.url));
    Array.from(get('gallery_images')?.files || []).forEach((file) => gallery.push({ url: fileUrl(file) }));
    setHeroImage(doc, heroFile ? fileUrl(heroFile) : checked('clearHeroImage') ? gallery[0]?.url || fallbackPhoto : savedHero);
    const galleryGrid = doc.querySelector('.forest-gallery > div:last-child');
    galleryGrid.replaceChildren();
    gallery.slice(-48).slice(0,12).forEach((image) => {
      const link = doc.createElement('a'); link.href = image.url; link.className = 'forest-gallery-link'; link.setAttribute('aria-label', 'Agrandir la photo de l’élevage');
      const img = doc.createElement('img'); img.src = image.url; img.alt = 'Photo de l’élevage'; img.loading = 'lazy';
      link.append(img); galleryGrid.append(link);
    });
    if (!gallery.length) { const empty = doc.createElement('p'); empty.className = 'forest-empty-state'; empty.textContent = 'La galerie sera visible dès qu’une première photo sera ajoutée.'; galleryGrid.append(empty); }
    const contact = doc.querySelector('.forest-contact-form');
    contact.querySelectorAll('a, [data-contact-empty]').forEach((node) => node.remove());
    const email = value('publicEmail'); const phone = value('phone');
    if (email || phone) {
      const link = doc.createElement('a'); link.className = 'forest-btn'; link.href = email ? 'mailto:' + email : 'tel:' + phone; link.textContent = email ? 'Écrire à l’élevage' : 'Appeler l’élevage'; contact.append(link);
    }
    doc.querySelectorAll('[data-public-contact]').forEach((node) => node.remove());
    const details = doc.querySelector('.forest-contact-details');
    [['mailto:',email],['tel:',phone]].forEach(([scheme, text]) => { if (!text) return; const p = doc.createElement('p'); p.dataset.publicContact = ''; const a = doc.createElement('a'); a.href = scheme + text; a.textContent = text; p.append(a); details.append(p); });

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
    const breedingLink = doc.querySelector('[data-service-key="breeding"] a');
    breedingLink.href = checked('showLitters') ? '#portees' : checked('showPuppies') ? '#chiots' : checked('showDogs') ? '#selection' : checked('showIntro') ? '#intro' : '#accueil';
    const strengths = value('strengths').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const strengthsGrid = doc.querySelector('.forest-strengths > div');
    strengthsGrid.replaceChildren();
    strengths.slice(0,3).forEach((strength, index) => {
      const article = doc.createElement('article');
      const icon = doc.createElement('span'); icon.textContent = ['◷','◈','♧'][index];
      const heading = doc.createElement('strong'); heading.textContent = strength;
      const p = doc.createElement('p'); p.textContent = 'Une exigence quotidienne au service du chien, de la famille et de la sélection.';
      article.append(icon, heading, p); strengthsGrid.append(article);
    });
  });

  let raf = null;
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applyPreview);
  };

  frame.addEventListener('load', () => {
    savedHero = '';
    withDoc((doc) => { savedGallery = Array.from(form.querySelectorAll('input[name="removeGallery"]'), (input) => ({ url: input.value })); });
    applyPreview();
  });
  let dirty = false;
  const markDirty = () => { dirty = true; document.querySelector('#website-save-status').textContent = 'Modifications non enregistrées'; };
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  form.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  document.querySelectorAll('[data-preview-device]').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('.website-preview-frame-wrap').dataset.device = button.dataset.previewDevice;
    document.querySelectorAll('[data-preview-device]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  }));
  // Native disclosure panels remain usable with keyboard and without a framework.
  Array.from(form.children).filter((node) => node.matches('.card, .settings-panel')).forEach((panel, index) => {
    const title = panel.querySelector('.section-title');
    if (!title) return;
    const details = document.createElement('details'); details.className = 'website-editor-panel'; details.open = index === 0;
    const summary = document.createElement('summary'); summary.textContent = title.querySelector('h3').textContent;
    panel.before(details); details.append(summary, panel); title.hidden = true;
  });
  form.querySelectorAll('.form-group').forEach((group, index) => {
    const label = group.querySelector('label'); const input = group.querySelector('input, textarea, select');
    if (label && input) { input.id ||= 'website-field-' + index; label.htmlFor = input.id; }
  });
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
