const authService = require('../services/auth.service');

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
  const { kennel_name: kennelName, full_name: fullName, email, password } = req.body;

  if (!kennelName || !fullName || !email || !password || password.length < 8) {
    return res.status(400).render('auth/register', {
      title: 'Créer un compte',
      error: 'Tous les champs sont obligatoires, mot de passe minimum 8 caractères.',
      user: null,
    });
  }

  try {
    const user = await authService.createBreederWithAdmin({ kennelName, fullName, email, password });
    req.session.user = user;
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

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
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

  req.session.user = user;
  const returnTo = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  return res.redirect(returnTo);
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
