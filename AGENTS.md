# Instructions Codex — ERP élevage canin

Tu travailles sur un logiciel professionnel d’élevage canin.

Priorités :
1. Sécurité des données éleveur
2. Simplicité d’usage
3. Robustesse PostgreSQL
4. Interface sobre et premium
5. Code maintenable

Règles obligatoires :
- Toutes les routes privées exigent requireAuth.
- Toutes les requêtes métier filtrent par breeder_id.
- Ne jamais utiliser de données globales sans breeder_id.
- Préférer des contrôleurs simples.
- Ne pas introduire de framework lourd.
- Ne pas casser l’existant.
- Après modification, vérifier les routes concernées.
- Prévoir Render et Docker.
- Écrire du code lisible, pas du bricolage.

Style UI :
- Dashboard professionnel
- Couleurs sobres
- Tableaux lisibles
- Actions claires
- Pas d’interface gadget

Modules métier :
- chiens
- soins
- rappels
- chaleurs
- saillies
- gestations
- portées
- chiots
- ventes
- générateur site web

Toute nouvelle fonctionnalité doit respecter la logique élevage professionnel.
