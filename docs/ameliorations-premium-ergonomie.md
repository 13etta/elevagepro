# Ameliorations premium et ergonomie ElevagePro

## Priorite 1 - Immersion utile

- Generaliser les photos sur les fiches chiens, chiots et portees, avec une image principale et une petite galerie privee.
- Ajouter une frise de vie sur chaque chien : naissance, identification, chaleurs, saillies, soins, portees, retraite.
- Afficher un score de completude de dossier pour guider l'eleveur sans bloquer la saisie.
- Mettre en avant les prochaines actions importantes directement sur la fiche : rappel sanitaire, chaleur estimee, suivi gestation, depart chiot.

## Priorite 2 - Eviter les redondances de saisie

- Pre-remplir la race d'un chiot depuis sa portee ou sa mere.
- Pre-remplir la date de naissance d'un chiot depuis la portee, avec possibilite de correction.
- Lorsqu'une vente est creee, synchroniser automatiquement le statut du chiot en `Vendu`.
- Lorsqu'une reservation est creee, synchroniser le statut du chiot en `Reserve`.
- Depuis une saillie confirmee, proposer la creation de gestation puis de portee avec mere, pere et dates deja repris.
- Lors de la creation d'un soin avec prochaine echeance, proposer automatiquement un rappel.

## Priorite 3 - Qualite SaaS premium

- Transformer les listes principales en vues mixtes : tableau professionnel + cartes visuelles pour les chiens/chiots.
- Ajouter des filtres persistants par statut, sexe, race, portee, disponibilite et periode.
- Ajouter des actions rapides sur les lignes : voir fiche, ajouter soin, ajouter rappel, generer annonce.
- Harmoniser les statuts en valeurs internes stables et libelles affiches propres.
- Ajouter des etats vides plus utiles : bouton d'action, explication courte, exemple de donnees attendues.

## Priorite 4 - Robustesse donnees

- Ajouter les colonnes manquantes via migrations idempotentes, jamais avec des scripts destructifs en production.
- Verifier les anciennes routes pour toutes les requetes qui doivent filtrer par `breeder_id`.
- Centraliser les normalisations de statuts pour chiens, chiots, portees et ventes.
- Prevoir une politique claire pour les fichiers : Supabase Storage en production, fallback local uniquement en developpement.
