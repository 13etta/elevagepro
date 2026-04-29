const path = require('path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const db = require('./db');
const i18n = require('./middleware/i18n');
const { csrfToken } = require('./middleware/csrf');
const { modules, moduleGroups } = require('./config/modules');

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const dogsRoutes = require('./routes/dogs.routes');
const soinsRoutes = require('./routes/soins.routes');
const remindersRoutes = require('./routes/reminders.routes');
const heatsRoutes = require('./routes/heats.routes');
const matingsRoutes = require('./routes/matings.routes');
const pregnanciesRoutes = require('./routes/pregnancies.routes');
const littersRoutes = require('./routes/litters.routes');
const puppiesRoutes = require('./routes/puppies.routes');
const salesRoutes = require('./routes/sales.routes');
const breederRoutes = require('./routes/breeder.routes');
const websiteRoutes = require('./routes/website.routes');
const weightsRoutes = require('./routes/weights.routes');
const profitabilityRoutes = require('./routes/profitability.routes');
const strategyRoutes = require('./routes/strategy.routes');

const app = express();
const PgSession = connectPgSimple(session);

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map((cookie) => {
        const [rawKey, ...rawValue] = cookie.trim().split('=');
        const key = decodeURIComponent(rawKey || '');
        const value = decodeURIComponent(rawValue.join('=') || '');
        return [key, value];
      }),
  );
  next();
});

app.use(
  session({
    store: new PgSession({
      pool: db.pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 12,
      sameSite: 'lax',
    },
    name: 'sid',
  }),
);

app.use(i18n.init);

app.use((req, res, next) => {
  const requestedLang = ['fr', 'en'].includes(req.query.lang) ? req.query.lang : null;
  const sessionLang = req.session?.preferences?.lang;
  const cookieLang = ['fr', 'en'].includes(req.cookies.lang) ? req.cookies.lang : null;
  const currentLang = requestedLang || sessionLang || cookieLang || 'fr';

  if (!req.session.preferences) req.session.preferences = {};
  req.session.preferences.lang = currentLang;
  req.setLocale(currentLang);
  res.cookie('lang', currentLang, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: 'lax' });

  const sessionTheme = req.session.preferences.theme;
  const cookieTheme = req.cookies.theme;
  const allowedThemes = ['prestige', 'clinical', 'nature'];
  const theme = allowedThemes.includes(sessionTheme)
    ? sessionTheme
    : allowedThemes.includes(cookieTheme)
      ? cookieTheme
      : 'prestige';

  req.session.preferences.theme = theme;

  res.locals.__ = res.__.bind(req);
  res.locals.currentLang = currentLang;
  res.locals.theme = theme;
  res.locals.modules = modules;
  res.locals.moduleGroups = moduleGroups;
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  res.locals.formatDate = (value) => {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'fr-FR');
  };

  next();
});

app.use(csrfToken);

app.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/auth/login');
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/dogs', dogsRoutes);
app.use('/soins', soinsRoutes);
app.use('/reminders', remindersRoutes);
app.use('/heats', heatsRoutes);
app.use('/matings', matingsRoutes);
app.use('/pregnancies', pregnanciesRoutes);
app.use('/litters', littersRoutes);
app.use('/puppies', puppiesRoutes);
app.use('/sales', salesRoutes);
app.use('/breeder', breederRoutes);
app.use('/site', websiteRoutes);
app.use('/weights', weightsRoutes);
app.use('/profitability', profitabilityRoutes);
app.use('/strategy', strategyRoutes);
app.use('/reproduction', require('./routes/reproduction.routes'));
app.use('/genetics', require('./routes/genetics.routes'));
app.use('/settings', require('./routes/settings.routes'));

app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: res.__('errors.notFound'),
    user: req.session?.user || null,
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).render('errors/500', {
    title: res.__('errors.serverError'),
    user: req.session?.user || null,
  });
});

module.exports = app;
