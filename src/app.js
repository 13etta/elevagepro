const path = require('path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const db = require('./db');
const i18n = require('./middleware/i18n');
const { csrfToken } = require('./middleware/csrf');
const { requireAuth } = require('./middleware/auth');
const { serveCertificate } = require('./services/certificates.service');
const securityHeaders = require('./middleware/security-headers');
const {
  modulesForUser,
  moduleGroupsForModules,
  selectionModulesEnabled,
  aiSelectionAgentEnabled,
} = require('./config/modules');
const { formatDateFr, dateInputValue } = require('./utils/dates');

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const dogsRoutes = require('./routes/dogs.routes');
const soinsRoutes = require('./routes/soins.routes');
const remindersRoutes = require('./routes/reminders.routes');
const healthTestsRoutes = require('./routes/health-tests.routes');
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
const structureRoutes = require('./routes/structure.routes');
const calendarRoutes = require('./routes/calendar.routes');

const app = express();

const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET doit contenir au moins 32 caractères en production.');
}
const PgSession = connectPgSimple(session);

// Render terminates TLS at one proxy; direct local connections trust no forwarded headers.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === '1' ? 1 : false);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.disable('x-powered-by');
app.use(securityHeaders);
for (const directory of ['css', 'js', 'images']) {
  app.use('/' + directory, express.static(path.join(__dirname, 'public', directory)));
}
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));
// Provider endpoint: authenticated by a signature over the untouched request bytes.
app.post('/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), require('./services/billing.service').webhook);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map((cookie) => {
        const [rawKey, ...rawValue] = cookie.trim().split('=');
        const decode = value => { try { return decodeURIComponent(value); } catch { return ''; } };
        const key = decode(rawKey || '');
        const value = decode(rawValue.join('=') || '');
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
      createTableIfMissing: false,
    }),
    secret: sessionSecret || 'dev-secret-change-me',
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

  const flash = req.session.flash || null;
  delete req.session.flash;

  res.locals.__ = res.__.bind(req);
  res.locals.currentLang = currentLang;
  res.locals.theme = theme;
  const visibleModules = modulesForUser(req.session?.user);
  res.locals.modules = visibleModules;
  res.locals.moduleGroups = moduleGroupsForModules(visibleModules);
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  res.locals.flash = flash;
  res.locals.formatDate = (value) => {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'fr-FR');
  };

  next();
});

app.use(csrfToken);

app.get('/uploads/health-tests/:filename', requireAuth, serveCertificate);
// Never let a malformed or nested certificate URL fall through to static serving.
app.use('/uploads/health-tests', (req, res) => res.sendStatus(404));
app.use((req, res, next) => {
  try {
    const normalized = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')).toLowerCase();
    if (normalized === '/uploads/health-tests' || normalized.startsWith('/uploads/health-tests/')) return res.sendStatus(404);
    return next();
  } catch { return res.sendStatus(400); }
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/images', express.static(path.join(require('./services/uploads.service').publicRoot, 'images'), { dotfiles: 'deny' }));

app.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
app.use('/billing', require('./routes/billing.routes'));
app.use('/account', require('./routes/account.routes'));
app.use('/dashboard', dashboardRoutes);
app.use('/dogs', dogsRoutes);
app.use('/soins', soinsRoutes);
app.use('/reminders', remindersRoutes);
app.use('/health-tests', healthTestsRoutes);
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
app.use('/structure', structureRoutes);
app.use('/calendar', calendarRoutes);
app.use('/reproduction', require('./routes/reproduction.routes'));
app.use('/settings', require('./routes/settings.routes'));

if (aiSelectionAgentEnabled) {
  app.use('/selection-agent', require('./routes/selection-agent.routes'));
}

if (selectionModulesEnabled) {
  app.use('/genetics', require('./routes/genetics.routes'));
  app.use('/cynognostic', require('./routes/cynognostic.routes'));
  app.use('/strategy', require('./routes/strategy.routes'));
}

app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: res.__('errors.notFound'),
    user: req.session?.user || null,
  });
});

app.use((error, req, res, next) => {
  console.error('request.failed', { code: error.code || error.name, method: req.method, route: req.route?.path || 'unknown' });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).render('errors/500', {
    title: res.__('errors.serverError'),
    user: req.session?.user || null,
  });
});

module.exports = app;
