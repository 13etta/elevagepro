# Livraison ElevagePro — 11 septembre 2026

## État
Lot préparé pour la branche `codex/livraison-securisee-abonnement-7-eur` du dépôt `13etta/elevagepro`. Ce document décrit le code proposé, pas un déploiement effectué. La base Supabase des testeurs a seulement été interrogée en lecture pour ses métadonnées. Aucune migration ni suppression n’y a été exécutée.

Le diagnostic initial reste dans `AUDIT_LANCEMENT_2026-09-08.md`. Les points suivants ont maintenant un correctif : limitation des tentatives, sessions révocables, récupération du mot de passe, protection des justificatifs, validation des signatures de fichiers, stockage persistant configurable, jointures par éleveur, garde des références inter-éleveurs, retrait du DDL des requêtes web, migrations versionnées, finalisation atomique des ventes, disponibilité des chiots, brouillon/publication de la vitrine, export métier et abonnement Stripe à 7 €/mois. Le dashboard et la navigation bénéficient de la nouvelle présentation responsive.

## Protection des deux éleveurs
- Réutiliser exactement la base Supabase existante. Le manifeste ne crée plus de base Render supplémentaire.
- Les migrations sont additives : pas de DROP, TRUNCATE, suppression ou réécriture des données métier. Les nouvelles contraintes de référence contrôlent les nouveaux liens ; les anciennes références inchangées restent éditables.
- La première migration de facturation attribue `beta_access=true` aux élevages déjà présents. Ils gardent leur accès sans paiement. Les nouveaux comptes ont `beta_access=false`.
- Les migrations déjà appliquées sont enregistrées avec leur empreinte. Une répétition n’attribue pas d’accès gratuit aux nouveaux comptes.
- `npm run db:migrate` et `npm run db:check` sont désormais en lecture seule. Les anciens scripts d’archive ne sont plus exécutés implicitement.
- Ne jamais rejouer globalement les SQL historiques : certains contiennent des nettoyages destructifs (notamment 015).

## Ordre du déploiement
1. Sauvegarder la base existante et TOUS les fichiers utilisateurs. Restaurer une copie dans un environnement isolé ; vérifier les effectifs et quelques fiches/documents. Aucun test de restauration réelle n’a été exécuté dans ce travail.
2. Sur cette copie, utiliser les mêmes variables que le serveur, avec un `DATABASE_URL` de préproduction. Définir `MIGRATION_CONFIRM_HOST` égal à son hostname exact puis lancer `npm run db:upgrade`. Contrôler les trois migrations et `npm run db:check`.
3. Tester les parcours avec deux comptes de préproduction. Ne jamais utiliser les données des éleveurs pour des tests d’écriture sur la production.
4. Configurer le stockage persistant et copier les anciens fichiers en conservant leurs noms et URL. Les justificatifs sont dans `PRIVATE_UPLOAD_DIR/health-tests`. Les nouvelles images publiques sont dans `PUBLIC_UPLOAD_DIR/images`. Garder aussi l’ancien répertoire `src/public/uploads` accessible au serveur jusqu’à vérification des copies. L’image Docker exclut volontairement les fichiers utilisateurs.
5. Vérifier que l’utilisateur Node peut écrire sur le disque monté. Le manifeste propose un disque de 1 Go ; il n’a pas été provisionné. Prévoir une sauvegarde externe des fichiers et vérifier l’espace disponible.
6. En fenêtre de maintenance courte, après sauvegarde contrôlée, appliquer les mêmes migrations sur la base existante, puis déployer le code. Le contrôle Render avant déploiement est en lecture seule et refuse un schéma en retard.
7. Vérifier connexion des testeurs, fiches existantes, anciens et nouveaux justificatifs, vente/réservation, export et persistance après redémarrage.

Les migrations de ce lot ciblent une base ElevagePro existante. Le runner refuse une base vide : il ne prétend pas fournir un installateur neuf complet.

## Configuration serveur
Ne jamais mettre les secrets dans GitHub ou dans une conversation.

- `DATABASE_URL` : connexion de la base existante ; `DATABASE_SSL=true`. La vérification du certificat est active. Renseigner `DATABASE_CA_CERT` si le fournisseur utilise une CA spécifique.
- `SESSION_SECRET` : secret aléatoire d’au moins 32 caractères.
- `TRUST_PROXY_HOPS=1` derrière le proxy Render, 0 en accès local direct. Vérifier les cookies sécurisés sur HTTPS.
- `APP_BASE_URL` : origine HTTPS publique, sans chemin ni paramètre.
- `PRIVATE_UPLOAD_DIR=/var/data/private`, `PUBLIC_UPLOAD_DIR=/var/data/public` sur le disque prévu.
- `SMTP_URL` et `MAIL_FROM` : service SMTP avec chiffrement et expéditeur vérifié. Sans configuration, le parcours annonce son indisponibilité et ne prétend pas envoyer un email.
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` : d’abord en mode test, puis les valeurs de production.

## Stripe — 7 € par mois
Créer dans le compte marchand un produit ElevagePro avec un prix actif récurrent mensuel de 700 centimes EUR, quantité 1. Aucun essai ni offre annuelle n’a été demandé. Le serveur refuse un autre montant/devise/période. Configurer le régime fiscal avec les informations réelles de l’entreprise ; le code n’ajoute pas de calcul fiscal automatique.

Activer le portail client Stripe : factures, mise à jour du paiement et résiliation. Limiter les changements de formule pour conserver le prix choisi.

Créer un endpoint HTTPS `/billing/webhook` abonné à :
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

La signature est vérifiée sur les octets bruts. Le retour du navigateur ne débloque jamais l’abonnement. Les événements sont dédupliqués et l’état courant de Stripe est relu sous verrou. Les comptes impayés/résiliés restent en lecture ; l’accès payant exige une période encore valide. Les testeurs restent exemptés.

Recette obligatoire dans le compte Stripe : paiement accepté, authentification supplémentaire, paiement refusé, fermeture/reprise du Checkout, événement répété, événement retardé, renouvellement, impayé, résiliation, réabonnement et portail. Les tests automatisés utilisent un fournisseur simulé et des signatures Stripe locales ; aucun encaissement ni test sur votre compte marchand n’a été effectué. Surveiller les échecs de webhook et les rejouer depuis Stripe si nécessaire.

Documentation : [Webhooks Stripe](https://docs.stripe.com/webhooks), [abonnements](https://docs.stripe.com/billing/subscriptions/webhooks), [disques Render](https://render.com/docs/disks), [manifestes Render](https://render.com/docs/blueprint-spec).

## Vérifications et limites
`npm test` vérifie notamment les vraies routes Express, PostgreSQL isolé, conservation des données de deux élevages fictifs, migrations répétées, liens inter-éleveurs, vente/réservation/registre, révocation, récupération de compte, limitations partagées, signature Stripe et déduplication. `npm audit --omit=dev` vérifie les dépendances. GitHub Actions exécute tests, audit et construction Docker.

Les tests PostgreSQL utilisent PGlite avec les SQL de référence et des données fictives. Ils ne remplacent pas une recette sur copie du schéma exact de production ni un test de ventes véritablement simultanées sur PostgreSQL serveur.

Avant ouverture commerciale générale, il reste à valider :
- le rôle PostgreSQL réellement utilisé par le serveur et ses privilèges minimaux. Le code ne configure pas une nouvelle isolation RLS par session ; les tables Supabase sont fermées au client, le serveur filtre par éleveur et les triggers protègent les références. Un rôle propriétaire peut toujours contourner RLS ;
- les sauvegardes restaurables, les rotations de secrets historiques et les alertes d’exploitation ;
- la délivrabilité SMTP et les paiements dans le compte Stripe ;
- l’identité de l’entreprise, les mentions légales, la politique de confidentialité/conservation, les conditions d’abonnement et la validation des documents de vente. Ne pas inventer ces informations ;
- la validation métier des fonctions expérimentales, les droits d’équipe détaillés, l’envoi automatique de rappels et la consolidation des styles. L’export JSON contient les données métier ; il ne constitue pas une archive des fichiers joints.

## Retour arrière
Les migrations additives peuvent rester en place avec la version précédente du code ; ne pas supprimer les colonnes/tables ajoutées. Revenir au code précédent uniquement après vérification de compatibilité. Ne jamais remettre les justificatifs en accès public pour résoudre un problème de téléchargement. En cas d’échec de migration, la transaction est annulée. En cas de problème de fichiers, rétablir le montage/la copie sans effacer les originaux.
