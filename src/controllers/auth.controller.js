const authService = require('../services/auth.service');
const { establishSession } = require('../services/login-session.service');

function renderLogin(req, res) {
  res.render('auth/login', {
    title: 'Connexion',
    error: null,
    user: req.session.user,
  });
}

function renderRegister(req, res) {
  res.render('auth/register', {
    title: 'Créer un compte',
    error: null,
    user: req.session.user,
  });
}

async function register(req, res) {
  const {
    kennel_name: kennelName,
    full_name: fullName,
    email,
    password,
    primary_breed: primaryBreed,
  } = req.body;

  if (![kennelName, fullName, email, primaryBreed].every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 255) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !require('../services/account-recovery.service').validPassword(password)) {
    return res.status(400).render('auth/register', {
      title: 'Créer un compte',
      error: 'Tous les champs sont obligatoires. Utilisez un email valide et un mot de passe de 12 caractères minimum (72 octets maximum).',
      user: null,
    });
  }

  try {
    const user = await authService.createBreederWithAdmin({
      kennelName,
      fullName,
      email,
      password,
      primaryBreed,
    });
    await establishSession(req, user);
    return res.redirect('/dashboard');
  } catch (error) {
    const message = error.message === 'EMAIL_ALREADY_EXISTS'
      ? 'Cet email est déjà utilisé.'
      : 'Impossible de créer le compte pour le moment.';

    return res.status(400).render('auth/register', {
      title: 'Créer un compte',
      error: message,
      user: null,
    });
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 255 || Buffer.byteLength(password) > 72) {
      return res.status(400).render('auth/login', {
        title: 'Connexion',
        error: 'Email et mot de passe requis.',
        user: null,
      });
    }

    const user = await authService.login({ email, password });
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Connexion',
        error: 'Identifiants invalides.',
        user: null,
      });
    }

    const returnTo = await establishSession(req, user);
    return res.redirect(returnTo);
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.redirect('/auth/login');
  });
}

module.exports = {
  renderLogin,
  renderRegister,
  register,
  login,
  logout,
};
