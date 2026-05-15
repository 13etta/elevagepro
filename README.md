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

## Deploiement Render avec Supabase

Si `DATABASE_URL` pointe vers Supabase, ne pas utiliser l'URL directe de type
`db.<project-ref>.supabase.co:5432` sur Render : elle peut resoudre en IPv6 et
provoquer `connect ENETUNREACH ...:5432`.

Dans Supabase, ouvrir **Project Settings > Database > Connect** puis copier une
URL **Connection Pooler / Supavisor** compatible IPv4.

Variables Render conseillees :

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>.supabase.com:6543/postgres?sslmode=require
DATABASE_SSL=true
SESSION_SECRET=<secret-long-et-aleatoire>
```

Notes :
- Encoder les caracteres speciaux du mot de passe dans l'URL (`@`, `#`, `/`, espaces...).
- Garder `SUPABASE_URL` et `SUPABASE_ANON_KEY` seulement pour Storage/API.
- Pour une base PostgreSQL Render native, conserver l'URL fournie par Render.
