const path = require('path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const db = require('./db');
const { csrfToken } = require('./middleware/csrf');

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

const app = express();
app.set('trust proxy', 1);
const PgSession = connectPgSimple(session);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
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

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  res.locals.formatDate = (value) => {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toISOString().slice(0, 10);
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
app.use('/soins', require('./routes/soins.routes'))
app.use('/reminders', remindersRoutes);
app.use('/heats', heatsRoutes);
app.use('/matings', matingsRoutes);
app.use('/pregnancies', pregnanciesRoutes);
app.use('/litters', require('./routes/litters.routes'));
app.use('/puppies', puppiesRoutes);
app.use('/sales', require('./routes/sales.routes'));
app.use('/breeder', breederRoutes);
app.use('/site', websiteRoutes);
app.use('/reproduction', require('./routes/reproduction.routes'));
app.use('/genetics', require('./routes/genetics.routes'));
app.use('/settings', require('./routes/settings.routes'));

app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page introuvable',
    user: req.session?.user || null,
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).render('errors/500', {
    title: 'Erreur serveur',
    user: req.session?.user || null,
  });
});

module.exports = app;