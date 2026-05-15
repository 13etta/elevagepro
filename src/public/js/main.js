(() => {
  const body = document.body;
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
})();
