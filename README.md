# Logiciel Élevage — version complète

Application PHP 8.2 + PostgreSQL pour la gestion d’un élevage canin.

## Modules inclus
- Authentification utilisateur
- Tableau de bord élevage
- Gestion des chiens
- Chaleurs
- Saillies
- Gestations
- Portées
- Chiots
- Soins
- Ventes
- Rappels
- Fiche élevage

## Installation rapide
1. Créer une base PostgreSQL.
2. Importer `sql/schema.sql`.
3. Copier `.env.example` vers `.env` et renseigner les accès DB.
4. Pointer Apache/Nginx vers `/public`.
5. Lancer avec PHP :

```bash
php -S localhost:8000 -t public
```

Compte de test après import SQL :
- email : admin@elevage.local
- mot de passe : Admin123!

## Structure
- `public/index.php` : routeur principal
- `includes/config.php` : connexion PostgreSQL PDO
- `includes/auth.php` : session + contrôle d’accès
- `src/` : vues et logique applicative
- `assets/css/app.css` : interface premium sombre
- `sql/schema.sql` : schéma complet
