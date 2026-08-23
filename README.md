# ElevagePro (Node.js + Express + PostgreSQL)

Socle ERP d'élevage canin professionnel.

## Démarrage local

1. Copier `.env.example` vers `.env`, renseigner `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et générer un `SESSION_SECRET`.
2. Installer les dépendances :
   ```bash
   npm ci
   ```
3. Appliquer le schéma SQL :
   ```bash
   npm run db:migrate
   ```
4. Lancer le serveur :
   ```bash
   npm start
   ```

## Agent de sélection IA

Le module `Sélection IA` lit un pedigree PDF, présente la transcription à
l'opérateur, puis calcule le coefficient de consanguinité uniquement après sa
validation. Le COI utilise une matrice de parenté additive (méthode tabulaire de
Wright) : il n'est pas produit par le modèle de langage.

Variables privées nécessaires :

```text
ENABLE_AI_SELECTION_AGENT=true
OPENAI_API_KEY=<cle-api-privee>
OPENAI_RESPONSES_URL=https://api.openai.com/v1/responses
OPENAI_SELECTION_MODEL=gpt-5-mini
```

Le PDF brut est traité en mémoire, transmis à l'API OpenAI avec `store: false`,
et n'est pas enregistré dans le répertoire public. L'application conserve son empreinte SHA-256, la transcription validée,
le COI et les recherches sourcées. Une mention trouvée sur le web reste « à
valider » et ne modifie jamais un pedigree, un résultat ou une cotation officiels.

Deux pedigrees validés peuvent ensuite être réunis dans une **portée virtuelle**.
Le rapprochement des ancêtres utilise d'abord le numéro d'inscription ; une
correspondance fondée uniquement sur le nom exige une confirmation de
l'opérateur. Le moteur calcule le COI prévisionnel, les chemins de parenté et la
contribution de chaque ancêtre commun sans nouvel appel à l'API OpenAI.

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
- Utiliser `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` seulement pour Storage/API.
- Ne jamais utiliser une clé Supabase `service_role` dans l'application cliente ou dans le dépôt.
- Pour une base PostgreSQL Render native, conserver l'URL fournie par Render.

Le guide complet de démarrage, de rotation et de réinitialisation des clones est disponible dans [`docs/SECURITY_AND_SETUP.md`](docs/SECURITY_AND_SETUP.md).
