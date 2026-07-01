const i18n = require('i18n');
const path = require('path');
const filterArchivedDogs = require('./filter-archived-dogs');

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

const initializeI18n = i18n.init;
i18n.init = (req, res, next) => {
  initializeI18n(req, res, (error) => {
    if (error) return next(error);
    return filterArchivedDogs(req, res, next);
  });
};

module.exports = i18n;
