# Instructions Codex — ERP élevage canin

Tu travailles sur un logiciel professionnel d’élevage canin.

Priorités :
1. Sécurité des données éleveur
2. Simplicité d’usage
3. Robustesse PostgreSQL / Supabase
4. Interface sobre et premium
5. Code maintenable

Règles obligatoires :
- Toutes les routes privées exigent `requireAuth`.
- Toutes les requêtes métier filtrent par `breeder_id`.
- Ne jamais utiliser de données globales sans `breeder_id`.
- Préférer des contrôleurs simples.
- Ne pas introduire de framework lourd.
- Ne pas casser l’existant.
- Après modification, vérifier les routes concernées.
- Prévoir Render et Docker.
- Écrire du code lisible, pas du bricolage.

Style UI :
- Dashboard professionnel
- Couleurs sobres
- Tableaux lisibles
- Actions claires
- Aspect SaaS premium : rayons cohérents, ombres propres, hiérarchie forte
- Pas d’interface gadget

Modules métier :
- chiens
- soins
- rappels
- chaleurs
- saillies
- gestations
- portées
- chiots
- ventes
- rentabilité
- génétique
- stratégie reproduction
- générateur site web

Toute nouvelle fonctionnalité doit respecter la logique élevage professionnel.

---

## Agent IA interne — Rédacteur d’annonces chiots

### Objectif
Créer un agent interne capable d’aider l’éleveur à rédiger une annonce de vente pour un chiot à partir des données déjà saisies dans ElevagePro.

Cet agent ne doit pas remplacer le jugement de l’éleveur. Il doit produire une base professionnelle, claire, juridiquement prudente et facilement modifiable.

### Données exploitables
L’agent peut utiliser uniquement les données appartenant au même `breeder_id` :

- `puppies.name`
- `puppies.sex`
- `puppies.color`
- `puppies.birth_date`
- `puppies.status`
- `puppies.sale_price`
- `puppies.notes`
- `puppies.chip_number`, si l’éleveur choisit de l’afficher
- `litters.birth_date`
- `litters.notes`
- `dogs.name` de la mère
- `dogs.name` du père si accessible via saillie / portée
- `dogs.breed`
- `breeder.company_name`
- `breeder.affix_name`
- `breeder.siret`
- `breeder.producer_number`
- `breeder.website_settings.publicEmail`
- `breeder.website_settings.phone`

### Ton attendu
L’agent doit proposer plusieurs variantes :

1. **Professionnelle** : sobre, claire, factuelle.
2. **Chaleureuse** : adaptée à une famille adoptante.
3. **Premium / sélection** : met en avant le sérieux, la lignée, le suivi et la méthode d’élevage.

### Structure conseillée de l’annonce

```text
Titre court

Présentation du chiot
- sexe
- robe
- date de naissance
- portée / mère / père si disponible

Profil et tempérament
- éléments issus des notes de l’éleveur
- prudence si le tempérament n’est pas encore évalué

Conditions de départ
- statut : disponible, réservé, vendu
- prix si renseigné
- documents et suivi si le module vente les renseigne

Présentation de l’élevage
- nom de l’élevage / affixe
- méthode, suivi, sérieux

Contact
- téléphone ou email public si configuré
```

### Règles de sécurité et de conformité

- Ne jamais inventer de résultat vétérinaire, test génétique, titre, cotation ou pedigree.
- Ne jamais prétendre qu’un chiot est LOF si l’information n’est pas présente.
- Ne jamais promettre un comportement futur garanti.
- Ne jamais masquer un statut `vendu`, `réservé`, `décédé` ou une information sanitaire connue.
- Ne pas exposer d’adresse privée complète sauf si l’éleveur l’a explicitement rendue publique.
- Ne pas afficher le numéro de puce par défaut : proposer une option.
- Mentionner les informations légales uniquement si elles sont présentes en base.

### Prompt système recommandé

```text
Tu es l’agent IA interne d’ElevagePro spécialisé dans la rédaction d’annonces de vente de chiots.
Tu écris pour un éleveur canin professionnel.
Ta priorité est la clarté, la conformité, la sobriété commerciale et la confiance.
Tu ne dois jamais inventer d’informations absentes des données fournies.
Tu dois signaler les informations manquantes importantes avant de rédiger.
Tu produis une annonce prête à relire, pas une promesse commerciale excessive.
```

### Prompt utilisateur recommandé

```text
À partir des données suivantes, rédige une annonce de vente pour ce chiot.
Ton souhaité : {{tone}}
Afficher le numéro de puce : {{show_chip_number}}

Données chiot :
{{puppy_json}}

Données portée :
{{litter_json}}

Données parents :
{{parents_json}}

Données élevage :
{{breeder_json}}
```

### Sortie attendue

L’agent doit retourner :

```json
{
  "missing_information": [],
  "title": "...",
  "short_ad": "...",
  "long_ad": "...",
  "social_post": "...",
  "legal_caution": "..."
}
```

### Emplacement produit conseillé

Ajouter un bouton sur la fiche chiot :

```text
Générer une annonce IA
```

Flux recommandé :

1. L’éleveur ouvre une fiche chiot.
2. Il clique sur `Générer une annonce IA`.
3. Une modale permet de choisir le ton.
4. Le serveur assemble les données avec `breeder_id`.
5. L’agent génère l’annonce.
6. L’éleveur peut copier ou modifier le texte.

### Route API envisagée

```text
POST /puppies/:id/generate-ad
```

Contraintes :

- `requireAuth` obligatoire.
- Vérifier que le chiot appartient au `breeder_id` de session.
- Journaliser seulement les métadonnées utiles, jamais les données sensibles complètes.
- Prévoir un fallback texte si aucun fournisseur IA n’est configuré.
