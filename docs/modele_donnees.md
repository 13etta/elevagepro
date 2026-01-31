# Modèle de données (Android)

Ce modèle est pensé pour **Room + Jetpack Compose**.  
Les objets sont sérialisables pour un usage hors‑ligne.

## Entités principales

### `ChecklistQuestion`
- `id` (String)  
- `prompt` (String)  
- `tags` (List<String>)  
- `intensityLevel` (Int?)  

### `Answer`
- `questionId` (String)  
- `allowed` (Boolean)  
- `maxIntensity` (Int?)  

### `Card`
- `id` (String)  
- `type` (Enum: `PINK`, `BLUE`)  
- `title` (String)  
- `description` (String)  
- `tags` (List<String>)  
- `intensityLevel` (Int)  

### `Deck`
- `id` (String)  
- `type` (Enum: `PINK`, `BLUE`)  
- `cards` (List<Card>)  

## Règles d’inclusion
Une carte est incluse si **tous** ses `tags` sont autorisés dans les réponses.  
Si une carte possède un `intensityLevel`, elle doit être `<= maxIntensity`.
