(() => {
  const typeSelect = document.querySelector('[data-health-test-type]');
  const resultSelect = document.querySelector('[data-health-result]');
  const options = window.healthResultOptions || {};

  if (!typeSelect || !resultSelect) return;

  const refreshResults = () => {
    const selectedType = typeSelect.value;
    const values = options[selectedType] || [];
    resultSelect.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = values.length ? 'Sélectionner' : 'Sélectionner une catégorie';
    resultSelect.appendChild(empty);

    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      resultSelect.appendChild(option);
    });
  };

  typeSelect.addEventListener('change', refreshResults);
  refreshResults();
})();
