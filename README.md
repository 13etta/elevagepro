# ElevagePro (Node.js + Express + PostgreSQL)

Socle ERP d'élevage canin professionnel.

## Démarrage local

1. Copier `.env.example` vers `.env` et renseigner `DATABASE_URL`.
2. Installer les dépendances :
   ```bash
   npm install
   ```
3. Appliquer le schéma SQL :
   ```bash
   npm run db:migrate
   ```
4. Lancer le serveur :
   ```bash
   npm run dev
   ```

## Modules disponibles (lot 1)
- Auth (login/register/logout)
- Dashboard protégé
- Routes modules (placeholders protégés)

## Stack
- Node.js
- Express
- PostgreSQL
- EJS
- express-session + connect-pg-simple
- bcrypt
