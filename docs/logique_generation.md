# Logique de génération des cartes

## Étapes de traitement
1. **Charger la checklist** (questions + réponses).  
2. **Calculer les tags autorisés** (inclure seulement ce qui est consenti).  
3. **Filtrer les cartes** par tags + intensité.  
4. **Constituer deux decks** : rose et bleu.  
5. **Sélectionner les cartes** selon les règles de jeu.

## Règles de sélection
### Cartes roses (dominant·e)
- Choix libre par le/la dominant·e dans le deck rose.

### Cartes bleues (soumis·e)
- Le/la soumis·e propose une sélection.  
- Si acceptée par le/la dominant·e : cartes ajoutées.  
- Sinon : tirage aléatoire depuis le deck bleu.

## Pseudo‑code
```
allowedTags = answers.where(allowed=true).flatMap(tags)
maxIntensityByTag = computeMaxIntensity(answers)

pinkDeck = allCards
  .where(type == PINK)
  .where(card.tags ⊆ allowedTags)
  .where(card.intensityLevel <= maxIntensityByTag[card.tags])

blueDeck = allCards
  .where(type == BLUE)
  .where(card.tags ⊆ allowedTags)
  .where(card.intensityLevel <= maxIntensityByTag[card.tags])

pinkSelection = dominantChooses(pinkDeck)
blueSelection = submittedBySubmissive()

if dominantAccepts(blueSelection):
  finalBlue = blueSelection
else:
  finalBlue = randomPick(blueDeck, count=blueSelection.size)
```
