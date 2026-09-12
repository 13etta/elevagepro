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

(() => {
  const dialog = document.querySelector('[data-command-dialog]');
  const query = dialog?.querySelector('input');
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  document.querySelector('[data-command-open]')?.addEventListener('click', () => dialog?.showModal());
  document.querySelector('[data-command-close]')?.addEventListener('click', () => dialog?.close());
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && dialog) {
      event.preventDefault(); if(dialog.open) dialog.close(); else dialog.showModal();
    }
  });
  query?.addEventListener('input', () => {
    let count = 0;
    dialog.querySelectorAll('.command-results a').forEach(link => {
      link.hidden = !normalize(link.textContent).includes(normalize(query.value.trim()));
      if(!link.hidden) count++;
    });
    dialog.querySelector('[data-command-empty]').hidden = count > 0;
  });
  const cards = document.querySelector('[data-dog-cards]');
  const table = document.querySelector('[data-dog-table]');
  const switcher = document.querySelector('[data-view-switch]');
  if(cards && table && switcher) {
    table.hidden = true; switcher.hidden = false;
    switcher.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const isCards = button.dataset.dogView === 'cards';
      cards.hidden = !isCards; table.hidden = isCards;
      switcher.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
  }
  const more = document.querySelector('[data-mobile-more]');
  more?.addEventListener('click', () => document.querySelector('[data-nav-toggle]')?.click());
  if(more) new MutationObserver(() => more.setAttribute('aria-expanded', String(document.body.classList.contains('nav-open')))).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
