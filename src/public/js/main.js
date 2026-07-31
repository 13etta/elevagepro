(() => {
  const body = document.body;
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navClose = document.querySelector('[data-nav-close]');
  const collapseToggle = document.querySelector('[data-sidebar-collapse]');
  const sidebar = document.querySelector('.sidebar');

  if (!body || !sidebar) return;

  const setMobileNav = (isOpen) => {
    body.classList.toggle('nav-open', isOpen);
    navToggle?.setAttribute('aria-expanded', String(isOpen));
  };

  navToggle?.addEventListener('click', () => {
    setMobileNav(!body.classList.contains('nav-open'));
  });

  navClose?.addEventListener('click', () => setMobileNav(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMobileNav(false);
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => setMobileNav(false));
  });

  const savedSidebarState = window.localStorage?.getItem('elevagepro-sidebar');
  if (savedSidebarState === 'compact') {
    body.classList.add('sidebar-compact');
  }

  collapseToggle?.addEventListener('click', () => {
    body.classList.toggle('sidebar-compact');
    const state = body.classList.contains('sidebar-compact') ? 'compact' : 'expanded';
    window.localStorage?.setItem('elevagepro-sidebar', state);
  });

  const addCsrfToken = (form) => {
    if (!(form instanceof HTMLFormElement)) return;

    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method === 'GET' || !csrfToken) return;

    let input = form.querySelector('input[name="_csrf"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      form.prepend(input);
    }
    input.value = csrfToken;
  };

  document.querySelectorAll('form').forEach((form) => {
    addCsrfToken(form);
    form.addEventListener('submit', () => {
      if (form.dataset.submitting === 'true') return;
      form.dataset.submitting = 'true';
      form.querySelectorAll('button[type="submit"]').forEach((button) => {
        if (button.dataset.noDisable === 'true') return;
        button.dataset.originalText = button.textContent.trim();
        button.disabled = true;
        button.classList.add('is-loading');
        button.textContent = 'Enregistrement...';
      });
    });
  });

  document.addEventListener('submit', (event) => addCsrfToken(event.target), true);
})();
