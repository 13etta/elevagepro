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

})();
