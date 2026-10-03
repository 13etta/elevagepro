(() => {
  const form = document.querySelector('[data-training-quote]');
  const preview = form?.querySelector('[data-terms-preview]');
  if (!preview) return;
  const editor = form.querySelector('[data-terms-editor]');
  const initial = JSON.parse(preview.dataset.variables);
  const fieldLabels = { client_full_name: 'Nom et prénom du client', client_address: 'Adresse du client',
    signature_date: 'Date de signature', company_name: 'Nom du professionnel', trade_name: 'Enseigne',
    address: 'Adresse du professionnel', email: 'Email du professionnel', privacy_email: 'Email pour les données personnelles' };
  const read = name => form.elements.namedItem(name)?.value?.trim() || '';
  const date = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '';
  const euros = value => Number.isFinite(value) ? value.toFixed(2) : '';

  function update() {
    const values = { ...initial };
    form.querySelectorAll('[name^="cgv_"]').forEach(input => {
      values[input.name.slice(4)] = input.type === 'date' ? date(input.value) : input.value.trim();
    });
    Object.entries({ client_address: 'client_address', client_phone: 'client_phone', client_email: 'client_email',
      dog_name: 'dog_name', dog_breed: 'dog_breed', dog_chip: 'dog_chip', dog_lof: 'dog_lof',
      training_objectives: 'training_objectives', feeding_notes: 'feeding_notes', health_notes: 'health_notes',
      veterinarian: 'veterinarian', handover_location: 'handover_location' }).forEach(([key, name]) => { values[key] = read(name); });
    values.client_full_name = [read('client_first_name'), read('client_name')].filter(Boolean).join(' ');
    ['quote_date', 'valid_until', 'start_date', 'end_date', 'dog_birth_date'].forEach(key => { values[key] = date(read(key)); });
    const total = Math.round(Number(read('price')) * 100) / 100;
    const deposit = Math.round(Number(read('deposit')) * 100) / 100;
    const rate = Number(read('vat_rate'));
    const ht = Math.round(total / (1 + rate / 100) * 100) / 100;
    Object.assign(values, { total_ttc: euros(total), total_ht: euros(ht),
      vat_summary: `${rate} % · base ${euros(ht)} € · TVA ${euros(total - ht)} €`,
      deposit_amount: euros(deposit), deposit_percent: total > 0 ? euros(deposit / total * 100) : '0.00',
      balance_amount: euros(total - deposit), signature_date: values.conclusion_date || '',
      conclusion_date_place: [values.conclusion_date, values.signature_place].filter(Boolean).join(' · '),
      service_reference: [read('service_label'), values.quote_number].filter(Boolean).join(' · '),
      privacy_email: values.privacy_email || initial.email || '' });
    const missing = new Set();
    const fragment = document.createDocumentFragment();
    for (const text of editor.value.split(/\n\s*\n/)) {
      const heading = ['Conditions générales de vente', 'Rétractation et données personnelles'].includes(text.trim());
      const paragraph = document.createElement(heading ? 'h3' : 'p');
      let start = 0;
      for (const match of text.matchAll(/\{\{([a-z_]+)\}\}/g)) {
        paragraph.append(document.createTextNode(text.slice(start, match.index)));
        const span = document.createElement('span');
        span.className = 'training-terms-variable';
        const label = form.querySelector(`label[for="cgv-${match[1]}"]`)?.textContent || fieldLabels[match[1]] || match[1].replace(/_/g, ' ');
        span.textContent = values[match[1]] || `[À compléter : ${label}]`;
        if (!values[match[1]]) missing.add(label);
        paragraph.append(span);
        start = match.index + match[0].length;
      }
      paragraph.append(document.createTextNode(text.slice(start)));
      fragment.append(paragraph);
    }
    preview.replaceChildren(fragment);
    form.querySelector('[data-terms-missing]').textContent = missing.size
      ? 'À compléter avant remise au client : ' + [...missing].join(', ') + '.' : 'Les variables des CGV sont renseignées.';
  }

  form.querySelector('[data-terms-reset]').addEventListener('click', () => {
    if (editor.value !== form.querySelector('[data-terms-default]').value && !window.confirm('Remplacer le texte actuel par les CGV du modèle ?')) return;
    editor.value = form.querySelector('[data-terms-default]').value;
    update();
  });
  form.addEventListener('input', update);
  update();
})();

