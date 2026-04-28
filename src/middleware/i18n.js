const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['fr', 'en'],
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'fr',
  cookie: 'lang',
  queryParameter: 'lang',
  autoReload: true,
  updateFiles: false,
  objectNotation: true
});

module.exports = i18n;