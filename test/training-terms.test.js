const test = require('node:test');
const assert = require('node:assert/strict');
const terms = require('../src/services/training-terms.service');

test('CGV preserve the source clauses and resolve only supplied job and breeder values', () => {
  assert.equal(terms.template.pages.length, 5);
  assert.match(terms.defaultTerms, /Aucune décharge générale ne couvre accident, fugue, maladie ou décès/);
  assert.match(terms.defaultTerms, /Aucun avoir n’est imposé/);
  assert.match(terms.defaultTerms, /Aucune prospection ni diffusion d’images du client/);
  const variables = terms.variablesFor({
    quote_number: 'DEV-2026-001', price_cents: 120000, deposit_cents: 30000, vat_rate: 20,
    details: { quote_variables: { insurance: 'Assurance du dossier', mediator_name: 'Médiateur du dossier' } },
  }, { company_name: 'Élevage du dossier', email: 'contact@example.test' });
  const result = terms.resolve(terms.defaultTerms, variables);
  assert.match(result, /Assurance du dossier/);
  assert.match(result, /Médiateur du dossier/);
  assert.match(result, /contact@example.test/);
  assert.match(result, /À compléter : Adresse postale du médiateur/);
  assert.doesNotMatch(result, /Des Hautes Quêtes|\{\{/);
  assert.equal(variables.total_ht, '1000.00');
  assert.equal(variables.deposit_percent, '25.00');
  assert.equal(variables.balance_amount, '900.00');
});

test('bronze fields reject malformed dates, amounts and non-text input', () => {
  assert.throws(() => terms.parseVariables({ cgv_emergency_limit: '-1' }), /Montant invalide/);
  assert.throws(() => terms.parseVariables({ cgv_deposit_due: '2026-02-30' }), /Date invalide/);
  assert.throws(() => terms.parseVariables({ cgv_insurance: ['autre élevage'] }), /Champ invalide/);
  const values = terms.parseVariables({ cgv_insurance: ' Police 123 ', cgv_emergency_limit: '250,50', breeder_id: 'other' });
  assert.equal(values.insurance, 'Police 123');
  assert.equal(values.emergency_limit, '250,50');
  assert.equal(values.breeder_id, undefined);
});

test('training form saves bronze values in the existing details JSON with no schema change', () => {
  const fields = require('../src/services/training.service').fields({
    client_name: 'Client', dog_name: 'Chien', service_label: 'Dressage', start_date: '2026-10-05', end_date: '2026-10-09',
    start_time: '09:00', end_time: '17:00', weekdays: ['1', '2', '3', '4', '5'],
    price: '1200', deposit: '300', vat_rate: '20', terms: terms.defaultTerms,
    cgv_insurance: 'Police propre au dossier', cgv_deposit_due: '2026-10-04',
  });
  assert.equal(fields.details.quote_variables.insurance, 'Police propre au dossier');
  assert.equal(fields.details.quote_variables.deposit_due, '2026-10-04');
  assert.equal(fields.terms, terms.defaultTerms);
});

