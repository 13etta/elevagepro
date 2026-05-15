(() => {
  const quickAction = document.querySelector('[data-quick-action]');
  const quickToggle = document.querySelector('[data-quick-action-toggle]');

  const setQuickAction = (open) => {
    if (!quickAction || !quickToggle) return;
    quickAction.classList.toggle('is-open', open);
    quickToggle.setAttribute('aria-expanded', String(open));
  };

  quickToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    setQuickAction(!quickAction.classList.contains('is-open'));
  });

  document.addEventListener('click', (event) => {
    if (quickAction && !quickAction.contains(event.target)) setQuickAction(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setQuickAction(false);
  });

  const revealTargets = document.querySelectorAll('.kpi-card,.module-card,.table-block,.card,.business-alert,.page-hero');
  revealTargets.forEach((element) => element.setAttribute('data-reveal', ''));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });

    revealTargets.forEach((element) => observer.observe(element));
  } else {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
  }
})();
