# Démarrage sécurisé et rotation des secrets

## Démarrage local

Prérequis : Node.js 20 ou supérieur et un accès PostgreSQL dédié à l'environnement local.

1. Cloner le dépôt puis installer les dépendances depuis le fichier verrouillé :

   ```bash
   npm ci
   ```

2. Créer le fichier local d'environnement :

   ```bash
   cp .env.example .env
   ```

3. Renseigner `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et générer un secret de session :

   ```bash
   openssl rand -base64 48
   ```

   Copier le résultat dans `SESSION_SECRET`. Ne jamais enregistrer `.env` dans Git.

4. Appliquer les migrations uniquement sur l'environnement prévu :

   ```bash
   npm run db:migrate
   ```

5. Démarrer l'application :

   ```bash
   npm start
   ```

## Variables sensibles

| Variable | Nature | Stockage attendu |
| --- | --- | --- |
| `DATABASE_URL` | Secret, contient le mot de passe PostgreSQL | Variables secrètes Render |
| `SESSION_SECRET` | Secret de signature des sessions | Variables secrètes Render |
| `OPENAI_API_KEY` | Secret optionnel | Variables secrètes Render |
| `GEMINI_API_KEY` | Secret optionnel | Variables secrètes Render |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publiable à privilèges limités | Render ; jamais une clé `service_role` |
| `SUPABASE_URL` | Adresse publique du projet | Render |

Les clés `service_role`, clés privées APNs, fichiers Android de signature et certificats iOS ne doivent jamais être présents dans le dépôt.

## Ordre de rotation en cas d'exposition

1. Générer un nouveau `SESSION_SECRET` dans Render. Les sessions existantes seront invalidées.
2. Réinitialiser le mot de passe PostgreSQL dans Supabase, remplacer immédiatement `DATABASE_URL` dans Render puis redéployer.
3. Créer ou sélectionner une clé Supabase publiable moderne (`sb_publishable_...`), la placer dans `SUPABASE_PUBLISHABLE_KEY`, redéployer et tester les photos.
4. Après vérification des journaux et de l'absence d'utilisation, désactiver l'ancienne clé `anon` depuis les paramètres API Supabase.
5. Tourner toute clé IA qui aurait été présente dans un ancien fichier d'environnement.
6. Purger l'historique Git, forcer la mise à jour des branches et demander à chaque contributeur de recréer son clone.

La rotation d'identifiants ne nécessite aucune suppression ni modification des données métier de la base.

## Vérifications après rotation

- la page de connexion répond et une nouvelle session peut être créée ;
- le dashboard charge les données du bon `breeder_id` ;
- la liste des trois chiens actifs et les archives restent cohérentes ;
- l'ajout puis l'affichage d'une photo de test fonctionnent ;
- le calendrier et le budget mensuel se chargent ;
- les journaux Render et Supabase ne contiennent aucune erreur d'authentification répétée ;
- l'ancien mot de passe et l'ancienne clé API ne permettent plus l'accès.

Ne jamais utiliser une opération de test qui modifie ou efface les données de production. Les contrôles de disponibilité doivent être en lecture seule, à l'exception d'un téléversement de test explicitement prévu dans un emplacement temporaire.

## Réinitialisation des clones après réécriture Git

La méthode sûre est de supprimer l'ancien clone local puis de recloner le dépôt. Un ancien clone contient encore les objets Git sensibles, même après un simple `git pull`.

```bash
git clone https://github.com/13etta/elevagepro.git
```

Avant la réécriture, chaque contributeur doit sauvegarder ses modifications non publiées sous forme de patch. Il ne faut pas fusionner une branche créée avant la purge dans le nouvel historique.
