# Module dressage

Les chiens confiés sont renseignés dans un dossier client distinct du cheptel.
Créer un devis, choisir les dates, jours de séance et horaires, le prix TTC, l’acompte, la TVA et les conditions convenues.
Les brouillons peuvent être modifiés. L’acceptation enregistre la référence de l’accord du client et fige le devis.

L’acompte est enregistré après encaissement effectif. Tant que son montant n’atteint pas l’acompte exigé, aucun rendez-vous n’est ajouté. Lorsque le seuil est atteint, chaque journée sélectionnée est créée dans l’agenda existant. Une prestation sans acompte est confirmée dès l’acceptation. Les répétitions du même paiement sont ignorées si toutes ses données correspondent ; une réutilisation avec des données différentes est refusée.

Les paiements et remboursements dressage apparaissent dans Ventes et réservations. Le graphique du tableau de bord les comptabilise à leur date d’encaissement. Les factures ne créent pas de recette supplémentaire. La rentabilité par portée conserve son périmètre élevage.

L’annulation conserve le dossier et les paiements et annule les rendez-vous. Les remboursements sont saisis explicitement après leur réalisation. Chaque remboursement dispose de son avoir. Les factures émises sont numérotées et figées à leur émission ; les règlements ultérieurs restent visibles dans le dossier.

## Mise en service

La migration additive `supabase/migrations/20261003070000_training.sql` doit être appliquée avant de démarrer cette version. Le fichier `sql/SUPABASE_MISE_A_NIVEAU_SANS_SUPPRESSION.sql` a été régénéré pour le parcours manuel existant. Aucune migration n’a été exécutée sur la base distante pendant ce développement.

Les nouveaux écrans utilisent les protections de session et CSRF existantes. Les requêtes filtrent par élevage ; les références composites protègent les relations. Les nouvelles tables sont inaccessibles aux rôles Data API anon et authenticated ; l’application utilise sa connexion PostgreSQL serveur.

## Documents

Devis et contrats dressage, facture d’acompte, facture finale et avoir utilisent les mêmes composants PDF que les documents de vente de chiens et chiots. Un devis de vente est ajouté au menu Documents des ventes existantes. Cette action ne remplace pas une vente définitive par une proposition commerciale : utiliser une réservation pour un dossier non finalisé.

Le fichier Word `Des_Hautes_Quetes_Devis_Dressage (1).docx` transmis dans la conversation n’a pas pu être récupéré. La charte PDF actuelle est donc conservée et mutualisée ; la reproduction exacte du modèle, de son logo et de ses CGV reste à terminer lorsque ce fichier est accessible. Ne pas présenter cette version comme conforme à ce modèle.

La TVA et les CGV doivent être renseignées selon les conditions réelles du prestataire. Aucun tarif ni régime fiscal n’est imposé pour le dressage. Les mentions fiscales historiques des documents de vente restent celles de l’application existante.

## Validation

Tests sur PostgreSQL isolé avec PGlite : devis, modification du brouillon, accord, acompte partiel, confirmation et agenda, répétition de paiement, dépassement du solde, clôture, instantanés de facture, remboursements et avoirs séparés, références entre élevages, refus Data API. Tests HTTP authentifiés des écrans dressage et refus des mutations sans CSRF.
