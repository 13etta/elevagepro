# Inventaire des secrets — 31 juillet 2026

Aucune valeur de secret n'est reproduite dans ce document.

| Élément | Exposition constatée | Risque | Action |
| --- | --- | --- | --- |
| `DATABASE_URL` Supabase | Valeur réelle suivie dans l'ancien `.env` | Critique : accès PostgreSQL | Réinitialiser le mot de passe Supabase, remplacer immédiatement l'URL dans Render, redéployer et tester |
| `SESSION_SECRET` | Valeur de démonstration suivie ; valeur Render non lisible depuis le dépôt | Élevé si la production réutilise une valeur faible | Générer au moins 48 octets aléatoires dans Render ; les sessions existantes seront invalidées |
| `SUPABASE_ANON_KEY` | Clé legacy suivie dans l'ancien `.env` | Limitée par RLS mais rotation difficile et obsolescence annoncée | Basculer vers la clé `SUPABASE_PUBLISHABLE_KEY` moderne déjà disponible, puis désactiver la clé legacy après contrôle |
| Ancien compte administrateur PHP | Mot de passe en clair dans l'archive XAMPP | Critique en cas de réutilisation | Changer ce mot de passe partout où il aurait été réutilisé |
| Ancienne configuration PHP | Valeurs DB/API par défaut dans l'archive XAMPP | Élevé si un ancien service reste accessible | Désactiver l'ancien service ou tourner ses accès |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Variables référencées par le code, aucune valeur trouvée dans les fichiers suivis audités | Aucun secret constaté dans Git | Conserver exclusivement dans les variables secrètes de l'hébergeur |
| Clés iOS, Android, APNs ou certificats | Aucun fichier `.pem`, `.key`, `.p8`, `.p12`, `.pfx`, `.jks` ou `.keystore` trouvé | Aucun secret constaté dans Git | Maintenir l'exclusion par `.gitignore` et utiliser les coffres des chaînes de publication |
| Uploads utilisateurs | Aucun dossier d'uploads suivi trouvé | Aucun contenu utilisateur constaté dans Git | Maintenir les uploads hors Git et dans un stockage prévu à cet effet |

## État des opérations

- [x] branche `security/repository-cleanup` créée ;
- [x] arbre courant nettoyé dans la PR de sécurité ;
- [x] répétition de la réécriture complète effectuée et contrôlée sur un miroir local ;
- [x] contrôle Supabase en lecture seule réussi ;
- [ ] mot de passe PostgreSQL tourné dans Supabase ;
- [ ] variables Render remplacées et service redéployé ;
- [ ] ancienne clé Supabase legacy désactivée après bascule ;
- [ ] historique réécrit force-pushé vers GitHub ;
- [ ] anciens clones supprimés et recréés.

Les quatre dernières opérations ne doivent être cochées qu'après observation directe de leur réussite.
