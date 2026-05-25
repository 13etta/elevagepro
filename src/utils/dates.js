'use strict';

function clean(value) {
  const text = String(value || '').trim();
  return text || null;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isFrenchDate(value) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(value || '').trim());
}

function toIsoDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const text = clean(value);
  if (!text) return null;

  if (isIsoDate(text)) return text;

  if (isFrenchDate(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function assertIsoDate(value, fieldLabel = 'date') {
  const iso = toIsoDate(value);
  if (!iso) {
    throw new Error(`Le champ ${fieldLabel} doit être une date valide au format jj/mm/aaaa ou aaaa-mm-jj.`);
  }
  return iso;
}

function compareIsoDates(left, right) {
  const leftIso = toIsoDate(left);
  const rightIso = toIsoDate(right);
  if (!leftIso || !rightIso) return null;
  return leftIso.localeCompare(rightIso);
}

function formatDateFr(value) {
  const iso = toIsoDate(value);
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function dateInputValue(value) {
  return toIsoDate(value) || '';
}

module.exports = {
  clean,
  toIsoDate,
  assertIsoDate,
  compareIsoDates,
  formatDateFr,
  dateInputValue,
};
