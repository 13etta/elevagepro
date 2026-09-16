# Studio vitrine ElevagePro

L’éditeur est accessible dans **Paramètres → Site vitrine** (`/settings?tab=vitrine`).

- Cinq ambiances, cinq couleurs, deux compositions et deux typographies.
- Photo d’accueil et cadrage, images des services, galerie, textes et titres personnalisables.
- Sections activables, aperçu immédiat, vue mobile et avertissement avant de quitter sans enregistrer.
- Le logo et le nom de l’élevage se règlent dans l’onglet Application.
- Renseigner l’email et le téléphone **publics** dans le panneau Contact : les coordonnées privées du compte ne sont plus utilisées implicitement.
- Enregistrer avec « Publier ma vitrine sur Internet » décoché conserve un brouillon. L’aperçu `/site/preview` exige une session et montre uniquement l’élevage connecté. La publication rend la vitrine accessible à son URL `/site/:slug` existante.

## Stockage et déploiement

Les réglages utilisent `breeder.website_settings` (JSONB), sans nouvelle migration ni dépendance. Les écritures ciblent l’identifiant de l’élevage connecté et exigent les droits propriétaire et le jeton CSRF.

Les photos utilisent le stockage public déjà configuré, dans un dossier propre à chaque élevage. Conserver `PUBLIC_UPLOAD_DIR` sur le disque persistant Render (`/var/data/public`) ou dans un volume Docker. Ne pas remplacer ce chemin par un répertoire éphémère lors du déploiement.

Les photos d’illustration par défaut et les polices utilisent des services externes. Les photos importées remplacent les illustrations ; des polices système restent disponibles si Google Fonts ne répond pas.

## Vérification

`npm test` couvre les réglages, leur sauvegarde par les routes réelles, l’isolation entre deux élevages, les brouillons, la publication, les coordonnées privées et l’échappement des textes.

Démonstration locale sans base de production : `node artifacts/showcase-preview.cjs`, puis `http://127.0.0.1:3197` et `http://127.0.0.1:3197/settings?tab=vitrine`. Son contenu est fictif, ses réglages sont en mémoire et elle ne gère pas les téléversements. Elle ne fait pas partie des routes de production.
