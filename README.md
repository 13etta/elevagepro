# ElevagePro — Reconstruction complète PostgreSQL / Render

## Modules inclus
- Tableau de bord
- Gestion des chiens
- Chaleurs, saillies, gestations/portées
- Chiots
- Ventes
- Vaccins, Milbemax, Bravecto, soins sanitaires
- Désinfections du chenil / maternité / boxes
- Suivi du poids avec courbe
- Rappels automatiques
- Générateur de site web public

## Déploiement Render
1. Créer un dépôt GitHub avec ces fichiers.
2. Sur Render : New > Blueprint, sélectionner le dépôt.
3. Render créera le service Docker et la base PostgreSQL.
4. Après le premier déploiement, lancer le SQL `database/schema.sql` dans la base Render.

## Identifiants démo
- Email : `admin@elevagepro.fr`
- Mot de passe : `admin123`

## Note technique
Le `Dockerfile` utilise PHP 8.2 Apache avec `pdo_pgsql`. L'application lit `DATABASE_URL`, standard Render PostgreSQL.
