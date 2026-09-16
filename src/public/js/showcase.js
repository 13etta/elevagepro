(() => {
  const dialog = document.querySelector('.forest-lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const photo = dialog.querySelector('img');
  document.querySelector('.forest-gallery').addEventListener('click', (event) => {
    const link = event.target.closest('.forest-gallery-link');
    if (!link) return;
    event.preventDefault();
    photo.src = link.href;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
})();
