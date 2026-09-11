# Audit de préparation au lancement — ElevagePro

Diagnostic initial conservé pour traçabilité. Les correctifs, vérifications et points restant à valider sont décrits dans [le dossier de livraison du 11 septembre](LAUNCH_DEPLOYMENT.md).

Date : 8 septembre 2026. Statut : **commercialisation générale déconseillée avant levée des blocages ci-dessous**.

Le socle métier est déjà conséquent. L'effort prioritaire porte sur l'isolation des données, les parcours de compte, la fiabilité du déploiement et la validation métier, avant l'ajout de modules supplémentaires.

## Périmètre et niveau de preuve

- Code Express / PostgreSQL / EJS du dossier `elevagepro-main`, ses routes, contrôleurs, services, modèles, SQL et manifestes Docker/Render. Le sous-projet `dominia-app` est exclu.
- GitHub : accès vérifié à `13etta/elevagepro`, dépôt public, branche par défaut `main`. Le dossier racine local ne contient pas de `.git` : son identité exacte avec le dernier commit distant n'est pas établie. Aucun push ni déploiement effectué.
- Supabase : projet **Elevagepro**, référence `uxfnbcwoqytlfjxtviah`. Conseiller sécurité et requêtes de métadonnées en lecture seule. Aucune donnée métier modifiée et aucune permission distante changée.
- 48 tests passent, dont tests HTTP sur les routes réelles avec stockage de session en mémoire et accès métier simulé. Ils ne remplacent pas une recette sur une base PostgreSQL de préproduction.
- `npm audit --omit=dev` : zéro vulnérabilité connue après correction. Ce résultat ne certifie pas la sécurité du logiciel.
- Tableau de bord contrôlé visuellement dans le navigateur sur ordinateur et à 390 px de large, avec données fictives. Les autres écrans bénéficient du style commun, sans recette visuelle exhaustive.
- Configuration réelle Render, secrets, historique Git complet, restauration des sauvegardes, paiement, délivrabilité des emails, charge et parcours métier avec deux éleveurs réels : non vérifiés.

## Améliorations et corrections livrées localement

| Domaine | Changement | Vérification |
|---|---|---|
| Interface | Navigation vert profond, actions harmonisées, contrastes, cartes et tableaux plus sobres | Aperçus ordinateur / mobile |
| Tableau de bord | Hiérarchie simplifiée, montants lisibles sur le graphique, zéro sans barre artificielle, alertes mobiles corrigées | Rendu navigateur et compilation EJS |
| Accessibilité | Focus clavier visible, lien d'accès au contenu, réduction des animations selon préférence système | Inspection du rendu ; audit WCAG complet restant |
| Navigation | Recherche annoncée comme recherche de chien ; initiale du profil issue de `full_name` | Modèles compilés |
| Connexion / inscription | Renouvellement et sauvegarde de session après authentification ; retour limité à une URL locale | Tests session et HTTP connexion |
| Routes privées | Session exigeant utilisateur et `breeder_id`, réponses privées non mises en cache ; `/site` utilise `requireAuth` | Tests HTTP sans authentification |
| Justificatifs | Nouveaux fichiers hors dossier public ; anciennes URLs soumises à connexion et contrôle `breeder_id` en base ; téléchargement en pièce jointe | Tests propriétaire / autre éleveur / anonyme / chemin encodé / chemin imbriqué |
| Import de justificatif | Écriture du fichier après validation du chien et du doublon ; nom aléatoire UUID | Revue du contrôleur ; validation binaire et nettoyage restant |
| Vitrine | Notes internes des chiens retirées ; adresse complète seulement après choix explicite dans Paramètres | Tests de rendu avec adresse privée / publiée |
| Contact vitrine | Faux formulaire remplacé par contact email/téléphone réellement utilisable | Test du lien de contact |
| Annonces chiots | Fallback sans promesse de suivi inventée ; statut manquant signalé ; formulations neutres pour vendu/réservé/décédé | Tests sans fournisseur IA |
| Confidentialité IA | Numéro de puce retiré du champ transmis et de ses occurrences exactes dans les notes si non autorisé | Test du corps de requête IA simulée |
| Jointures | Ajout de l'égalité des `breeder_id` aux jointures concernées des ventes, soins du dashboard et tests de santé | Revue de code ; scénario DB inter-éleveurs restant |
| PostgreSQL | Vérification TLS activée, autorité de certification configurable, paramètres d'URL ne pouvant écraser cette vérification | Tests de configuration ; connexion distante de l'application non testée |
| HTTP | En-têtes de sécurité, cookies malformés tolérés, `/healthz` indépendant des sessions/DB | Tests HTTP |
| Dépendances | `qs` fixé à 6.16.0 via override ; conservation d'Express 4 | 48 tests ; audit npm sans alerte |
| Exploitation | `.dockerignore`, exécution Docker sans root, variables Supabase et contrôle de santé Render | Revue des manifestes ; Docker indisponible sur cet environnement |

Les en-têtes CSP ajoutés limitent les frames, objets et bases d'URL. Ils ne constituent pas une politique complète contre les scripts injectés : des scripts et styles inline existent encore.

## Blocages et risques restants

P1 = à traiter avant ouverture commerciale générale. P2 = amélioration à planifier après sécurisation du lancement.

| Priorité | Constat et preuve | Risque / résultat attendu |
|---|---|---|
| P1 | Pas de limitation des tentatives dans `src/routes/auth.routes.js` | Brute force et création automatisée de comptes. Limites par IP et compte, stockage partagé si plusieurs instances, tests 429 et expiration ; vérifier le proxy de confiance. |
| P1 | `requireAuth` lit une session durable, sans revalidation de `users.is_active` | Désactiver un utilisateur ne révoque pas nécessairement sa session pendant 12 h. Prévoir révocation et revalidation des droits. |
| P1 | 30 tables publiques Supabase appartiennent à `postgres`, RLS activée sans politique et sans FORCE RLS | L'accès client est fermé par défaut, mais le propriétaire/bypass RLS peut contourner les règles. Vérifier le rôle réel de `DATABASE_URL`, établir un modèle d'accès serveur à privilèges limités et tester deux éleveurs sur toutes les opérations. |
| P1 | Nombreuses relations métier sans contrainte composite d'appartenance ; protection de jointures améliorée seulement sur les parcours cités | Une référence étrangère incohérente peut créer un lien inter-éleveurs. Auditer toutes les écritures, renforcer les contraintes `(breeder_id, id)` après contrôle des données existantes. |
| P1 | DDL encore présent au runtime : 86 correspondances CREATE/ALTER dans 16 fichiers de contrôleurs/services lors du contrôle | Verrous, dérive et besoin d'un rôle trop puissant. Déplacer vers migrations versionnées et retirer les permissions DDL du rôle web. |
| P1 | `sql/migrate.js` rejoue une liste fixe ; plusieurs fichiers présents (notamment 015–018) ne sont pas dans cette liste ; 017 est aussi appliqué séparément | Installation neuve non reproductible. Réconcilier ordre, dépendances et historique sur une base vide puis une copie représentative. Ne pas lancer aveuglément les fichiers manquants en production. |
| P1 | Bucket Supabase `logos` public, aucune politique sur `storage.objects`, ni limite de taille/type au niveau du bucket | Lecture publique attendue pour les logos ; upload via clé publiable à valider. Ne pas ouvrir les écritures anonymes pour contourner les échecs. Prévoir un service autorisé par éleveur et un stockage privé distinct pour documents. |
| P1 | Photos et certificats peuvent être écrits sur disque local ; `render.yaml` ne définit pas de disque persistant | Perte de fichiers après redéploiement. Définir stockage persistant, sauvegarde et restauration des fichiers comme de la base. |
| P1 | Ventes : vérification de l'animal et insertion sans verrou d'animal dans `sales.controller.js` | Doubles réservations/ventes concurrentes possibles. Définir invariants métier, verrou/contrainte et tests simultanés ; vérifier acompte, remboursement et transition réservation → vente. |
| P1 | KPI « chiots disponibles » exclut seulement vendu/sold dans `dashboard.controller.js` | Réservés et décédés peuvent être comptés disponibles. Normaliser les statuts et utiliser des catégories explicites pour tous les indicateurs. |
| P1 | Vitrine publiée via slug/identifiant sans véritable état brouillon/publié | L'éleveur doit contrôler quels animaux et données sont publics. Ajouter publication explicite par site et contenu ; revue complète des données publiques. |
| P1 | Pièces jointes validées essentiellement par MIME déclaré ; nettoyage des fichiers orphelins absent | Vérifier signature réelle, taille, noms, contenu autorisé et stratégie de suppression ; ne pas héberger de fichiers actifs non contrôlés. |
| P1 | Les sorties IA distantes ne sont pas validées factuellement au-delà du prompt et de la normalisation JSON | Tester refus d'instructions dans les notes, conservation des statuts et informations sanitaires, limites de coût/durée, erreurs fournisseur et relecture obligatoire. Le correctif de puce n'est pas un détecteur général de données personnelles dans le texte libre. |
| P1 | Des exceptions complètes sont journalisées et les droits d'équipe ne sont pas un contrôle systématique des actions sensibles | Limiter les journaux aux métadonnées nécessaires ; définir propriétaire/collaborateur/lecture seule et protéger configuration, exports et suppressions. |
| P1 | Dossier local sans historique Git, documents existants sur rotation de secrets | Vérifier les rotations réellement effectuées et scanner le dépôt/historique avec un outil de secrets. L'audit présent ne prouve pas l'absence de secrets historiques. |
| P2 | Nombreuses couches CSS, nombreuses règles `!important`, préférences de thème largement écrasées par les refontes | Consolider progressivement le style et valider le thème choisi, les formulaires, tables et modales sur mobile. |
| P2 | Route `registries.routes.js` présente mais non montée dans `app.js` | Clarifier le parcours registre utilisé (`/breeder`/structure) avant de réactiver cet ancien contrôleur ; il utilise BEGIN/COMMIT sur `pool.query`, pas un client réservé. |

## Résultats Supabase détaillés

Le conseiller a retourné :

- **30 informations « RLS Enabled No Policy »** : cohérent avec un serveur utilisant des sessions Express plutôt que Supabase Auth. Ne pas ajouter une politique `USING (true)` pour supprimer l'alerte. Cela pourrait ouvrir les données métier. [Documentation RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- **7 avertissements de `search_path` mutable** : `registry_insert_movement`, `registry_after_dog_insert`, `registry_after_dog_status_update`, `registry_after_puppy_insert`, `registry_after_puppy_status_update`, `registry_after_sale_insert_or_update`, `registry_after_litter_insert`. Fixer un chemin contrôlé et qualifier les tables après revue des dépendances. [Remédiation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- **2 avertissements d'exécution pour la même fonction `archive_exited_dog()`**, par `anon` et `authenticated`. Métadonnées vérifiées : `SECURITY DEFINER`, `RETURNS trigger`, `search_path=public`. Une fonction trigger n'est pas une RPC ordinaire directement exploitable : aucune exploitation n'est démontrée ici. Restreindre néanmoins les droits inutiles et revoir les privilèges du déclencheur. [Remédiation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- **Dérive locale/distante** : la version locale de `archive_exited_dog()` ne déclare pas le `SECURITY DEFINER` observé en base. Réconcilier les définitions avant toute migration.

Aucune correction SQL distante n'a été appliquée : le modèle de permissions et la migration doivent être vérifiés sur préproduction avant modification de la base utilisée.

## Audit fonctionnel

« Présent » signifie implémentation repérée dans le code, pas certification de bout en bout.

| Domaine | Présent | Manque ou validation prioritaire |
|---|---|---|
| Comptes | Inscription, connexion, déconnexion, sessions | Mot de passe oublié, validation email, révocation, MFA pour propriétaires, invitations/droits |
| Chiens | Fiches, recherche, filtres, parents, photos, sorties et archives | Import/export documenté, doublons puce/LOF, historique et suppression/restauration éprouvés |
| Santé | Soins, tests, justificatifs, rappels, export de registre sanitaire, poids chiots | Rappels email/SMS avec suivi d'envoi, protocoles métier validés, pièces privées durables |
| Reproduction | Chaleurs, saillies, gestations, portées, suivi associé | Cohérence des dates et statuts, refus des associations incohérentes, recette complète de la saillie au départ |
| Chiots | Fiches, filtres, poids, statuts, génération d'annonces | Disponibilité homogène, contrôles sanitaires et administratifs au départ, annonces IA testées |
| Vente | Réservations, acomptes, ventes, documents PDF | Non-duplication, finalisation fiable, numérotation/versions des documents et validation professionnelle des contrats/factures |
| Rentabilité | Charges, ventes et calculs de marge | Réconciliation acompte/vente, allocation des charges et vérification des totaux sur cas de référence |
| Structure | Infrastructures, affectations, nettoyage et équipe | Capacité concurrente, historique de mouvements et droits des collaborateurs |
| Génétique / stratégie | Modules expérimentaux ; agent pedigree et calcul COI / portées virtuelles avec tests | Validation métier et sources ; ne pas présenter les modules expérimentaux comme validés. Accès IA actuellement réservé à un identifiant propriétaire configuré |
| Vitrine | Modèles, contenu, galerie, animaux, contact | Brouillon/publication, domaine, SEO/social, validation des textes par l'éleveur, vrai suivi des demandes si formulaire souhaité |
| SaaS commercial | Pas de parcours d'abonnement identifié dans les routes examinées | Offres, essai, abonnement, paiement, relances, suspension/résiliation, support et onboarding |
| Données / conformité | Isolation applicative, exports partiels, documents de sécurité | Export complet par éleveur, traitement des demandes de suppression, politique de conservation, notices et contrats à faire valider |

Le module d'annonces chiots existe déjà : il ne s'agit pas d'une fonctionnalité manquante. Les corrections livrées portent sur sa prudence et sa confidentialité.

## Ordre de préparation recommandé

1. **Sécuriser les données** : anti-abus, sessions révoquées, rôle DB, isolation à deux éleveurs, stockage privé et sauvegardes restaurées.
2. **Rendre le déploiement reproductible** : établir la version Git de référence, aligner schéma/migrations, installer sur base vide, configurer TLS et stockage, prouver rollback et health check.
3. **Fiabiliser le métier** : corriger KPI/statuts, concurrence des ventes, parcours reproduction complet, documents validés, droits d'équipe.
4. **Préparer la vente du SaaS** : parcours compte/récupération, onboarding, support, offres/abonnements, documents contractuels et information sur les données.
5. **Ouvrir une bêta encadrée**, puis une ouverture commerciale générale seulement après preuve des critères précédents.

## Critères de sortie avant lancement

- Deux éleveurs de test : toutes les lectures, modifications, suppressions, uploads et exports refusent l'identifiant de l'autre éleveur.
- Utilisateur désactivé : sessions déjà ouvertes effectivement révoquées ; attaques de connexion limitées.
- Vitrine : seules les données explicitement publiques sortent ; justificatifs inaccessibles anonymement.
- Création/édition/concurrence : une même vente ne peut pas être enregistrée deux fois pour le même animal.
- Redéploiement : photos, justificatifs, sessions et données restent cohérents.
- Restauration : base et fichiers restaurés dans un environnement isolé, durée/perte maximale acceptables consignées.
- Migrations : installation neuve et mise à niveau d'une copie de production réussies.
- Documents et chiffres : résultats attendus comparés sur scénarios validés par l'éleveur.
- Facturation SaaS et récupération de compte : parcours complets testés avant encaissement des premiers abonnements autonomes.

## Livrables

- Code modifié dans `src`, configuration TLS partagée et manifestes à la racine.
- Tests additionnels : `test/launch-security.test.js`.
- Guide de déploiement des correctifs : [LAUNCH_DEPLOYMENT.md](LAUNCH_DEPLOYMENT.md).
- Captures locales : `artifacts/dashboard-desktop.png` et `artifacts/dashboard-mobile.png` (données fictives ; dossier exclu de Git et Docker).

Ce rapport est une revue technique ciblée avec vérifications locales et métadonnées Supabase. Il ne constitue ni un pentest exhaustif de l'hébergement, ni une validation juridique des documents de vente.
