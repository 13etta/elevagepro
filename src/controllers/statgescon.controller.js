const { searchStatgesconDog } = require('../services/cynognostic/statgesconClient');

exports.form = async (req, res) => {
  res.render('cynognostic/statgescon', {
    title: 'Recherche StatGescon',
    result: null,
    dogName: '',
    baseUrl: process.env.STATGESCON_BASE_URL || 'https://statgescon.onrender.com',
  });
};

exports.search = async (req, res) => {
  const dogName = req.body.dog_name || '';
  const baseUrl = req.body.base_url || process.env.STATGESCON_BASE_URL || 'https://statgescon.onrender.com';

  try {
    if (!dogName.trim()) {
      req.session.flash = { type: 'error', message: 'Indique un nom de chien.' };
      return res.redirect('/cynognostic/statgescon');
    }

    const result = await searchStatgesconDog(dogName, { baseUrl });

    return res.render('cynognostic/statgescon', {
      title: 'Recherche StatGescon',
      result,
      dogName,
      baseUrl,
    });
  } catch (error) {
    console.error('Erreur StatGescon:', error);
    req.session.flash = { type: 'error', message: 'Connexion StatGescon impossible.' };
    return res.redirect('/cynognostic/statgescon');
  }
};
