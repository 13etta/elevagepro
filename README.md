# ElevagePro – Jeu de cartes BDSM (spécification initiale)

Ce dépôt contient une **spécification fonctionnelle** et une **base de données de départ** pour une application Android de type jeu de cartes, destinée à explorer des pratiques BDSM **consensuelles** au moyen d’un questionnaire de type *checklist*.  
L’objectif est de permettre à un couple (ou un duo consensuel) d’identifier des préférences, puis de générer des cartes de jeu adaptées aux réponses.

> ⚠️ **Éthique et sécurité** : ce projet est réservé à des **adultes consentants**. Le consentement explicite, la communication et les limites personnelles sont indispensables. Intégrer des rappels de sécurité (Safe Words, négociation, après-soin) dans l’app.

## Contenu du dépôt

- `docs/jeu_et_regles.md` : règles du jeu et dynamique Dominant/Domina ↔ soumis·e.  
- `docs/checklist_template.md` : questionnaire de base (à personnaliser).  
- `docs/pratiques_et_cartes.md` : liste de pratiques et mapping vers des cartes.  
- `docs/modele_donnees.md` : structure des données pour Android.  
- `docs/logique_generation.md` : logique de génération des cartes en fonction du questionnaire.
- `android-app/` : **V1 Android** (Jetpack Compose) avec checklist complète et génération de cartes.

## Prochaines étapes possibles

- Définir un **scope MVP** (ex. 30–50 cartes, 20 questions).  
- Créer un **prototype Android** (Jetpack Compose, Room, ViewModel).  
- Mettre en place un **mode hors‑ligne** et une **politique de confidentialité** (aucune donnée envoyée par défaut).
