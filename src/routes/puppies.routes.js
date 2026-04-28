const express = require('express');
const router = express.Router();
const puppiesController = require('../controllers/puppies.controller');

// Vérifie le nom exact dans src/middleware/auth.js. 
// Si c'est ensureAuthenticated, utilise ce nom ci-dessous :
const { ensureAuthenticated } = require('../middleware/auth'); 

// Application du middleware (On utilise le nom importé ci-dessus)
router.use(ensureAuthenticated);

// Route pour la vue d'ensemble (Redirection temporaire si listPuppies n'existe pas)
router.get('/', (req, res) => res.redirect('/dashboard'));

// Routes pour l'ajout, l'édition et la suppression
router.get('/new', puppiesController.getForm);
router.post('/save', puppiesController.savePuppy); // POST pour la création
router.get('/edit/:id', puppiesController.getForm);
router.post('/save/:id', puppiesController.savePuppy); // POST pour la modification
router.get('/delete/:id', puppiesController.deletePuppy);

module.exports = router;