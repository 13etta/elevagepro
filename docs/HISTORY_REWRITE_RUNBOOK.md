# Procédure coordonnée de réécriture de l'historique Git

Cette opération change les identifiants de tous les commits concernés. Elle doit être menée dans une fenêtre de maintenance, après rotation des secrets et avant toute nouvelle contribution.

## 1. Geler le dépôt

1. Annoncer le début de la maintenance.
2. Interdire temporairement les fusions et nouveaux pushes.
3. Fermer ou recréer après purge les pull requests fondées sur l'ancien historique.
4. Relever les branches et tags distants.
5. Sauvegarder chaque modification locale non publiée sous forme de patch.

Le clone local qui contient une modification non publiée de `src/controllers/dashboard.controller.js` doit être sauvegardé avant toute réinitialisation :

```bash
git diff -- src/controllers/dashboard.controller.js > dashboard-pre-purge.patch
```

Le patch doit être relu avant d'être appliqué au nouveau clone.

## 2. Autoriser temporairement les force-pushs

Dans les règles de protection GitHub, autoriser temporairement le force-push pour les branches réécrites. Ne pas désactiver les autres contrôles plus longtemps que nécessaire.

## 3. Réécrire un miroir intégral

```bash
git clone --mirror https://github.com/13etta/elevagepro.git elevagepro-clean.git
cd elevagepro-clean.git

git filter-repo --force --invert-paths \
  --path .env \
  --path node_modules \
  --path archive \
  --path archives \
  --path uploads \
  --path upload \
  --path src/public/uploads \
  --path public/uploads \
  --path-glob '*.pem' \
  --path-glob '*.key' \
  --path-glob '*.p8' \
  --path-glob '*.p12' \
  --path-glob '*.pfx' \
  --path-glob '*.jks' \
  --path-glob '*.keystore' \
  --path-glob '*.mobileprovision'
```

Ne jamais pousser les références `refs/pull/*` ou `refs/original/*`.

## 4. Contrôler avant le push

```bash
git rev-list --objects --all | grep -E '(^|/)(\.env|node_modules|archive|uploads?)(/|$)'
```

Cette commande ne doit retourner aucun chemin interdit. Contrôler également les motifs de secrets avec un scanner spécialisé avant le push.

## 5. Force-push coordonné

```bash
git remote add origin https://github.com/13etta/elevagepro.git
git push --force --all origin
git push --force --tags origin
```

Vérifier immédiatement les nouveaux SHA sur GitHub, puis réactiver les protections de branche.

## 6. Vérifier le dépôt distant

Effectuer un nouveau clone dans un dossier vide, relancer le contrôle des chemins et vérifier :

- installation avec `npm ci` ;
- chargement de l'application avec les nouvelles variables ;
- connexion et dashboard ;
- lecture des chiens actifs et archivés ;
- calendrier et budget mensuel ;
- stockage d'images avec la clé publiable moderne ;
- absence d'erreurs répétées dans Render et Supabase.

Ces vérifications n'impliquent aucune suppression ni modification des données métier.

## 7. Réinitialiser les postes

La méthode obligatoire est de supprimer l'ancien clone après sauvegarde des seuls changements utiles, puis de recloner. Un `git pull` ne supprime pas les anciens objets sensibles.

```bash
git clone https://github.com/13etta/elevagepro.git
```

Ne jamais fusionner une ancienne branche. Recréer une branche depuis le nouveau `main`, puis appliquer manuellement le patch relu.
