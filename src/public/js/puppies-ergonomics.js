document.addEventListener('DOMContentLoaded', () => {
  const puppyForm = document.querySelector('[data-puppy-form]');

  if (puppyForm) {
    const submitButton = puppyForm.querySelector('[data-save-button]');
    const submitText = submitButton?.querySelector('[data-save-text]');

    puppyForm.addEventListener('submit', (event) => {
      if (!puppyForm.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        puppyForm.classList.add('was-validated');

        const firstInvalid = puppyForm.querySelector(':invalid');
        if (firstInvalid) {
          firstInvalid.focus({ preventScroll: true });
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return;
      }

      puppyForm.classList.add('was-validated');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('is-loading');
        submitButton.setAttribute('aria-busy', 'true');
      }

      if (submitText) {
        submitText.textContent = 'Enregistrement en cours...';
      }
    });
  }

  document.addEventListener('click', async (event) => {
    const deleteLink = event.target.closest('[data-confirm-delete]');
    if (!deleteLink) return;

    event.preventDefault();

    const puppyName = deleteLink.getAttribute('data-puppy-name') || 'ce chiot';
    const href = deleteLink.getAttribute('href');

    if (!href) return;

    if (!window.Swal) {
      if (window.confirm(`Supprimer définitivement ${puppyName} ?`)) {
        window.location.href = href;
      }
      return;
    }

    const result = await window.Swal.fire({
      title: 'Confirmer la suppression',
      text: `Cette action supprimera définitivement ${puppyName}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        confirmButton: 'swal-confirm-danger',
        cancelButton: 'swal-cancel-neutral',
      },
    });

    if (result.isConfirmed) {
      window.location.href = href;
    }
  });
});
