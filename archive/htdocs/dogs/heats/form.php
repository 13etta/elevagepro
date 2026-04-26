<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// Récupérer l'ID si modification
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$heat = [
    'dog_id'   => '',
    'start_at' => '',
    'end_at'   => '',
    'stage'    => ''
];

// Liste des femelles disponibles
$stmt = $pdo->query("SELECT id, name FROM dogs WHERE sex = 'F' ORDER BY name ASC");
$females = $stmt->fetchAll(PDO::FETCH_ASSOC);

if ($id > 0) {
    $stmt = $pdo->prepare("SELECT * FROM heats WHERE id = ?");
    $stmt->execute([$id]);
    $heat = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$heat) {
        die("Chaleur introuvable.");
    }
}
?>

<div class="container my-4">
  <h1 class="h3 mb-4"><?= $id ? "Modifier une chaleur" : "Ajouter une chaleur"; ?></h1>

  <form method="post" action="store.php">
    <input type="hidden" name="id" value="<?= $heat['id'] ?? 0; ?>">

    <div class="mb-3">
      <label class="form-label">Chienne *</label>
      <select name="dog_id" class="form-select" required>
        <option value="">-- Choisir une chienne --</option>
        <?php foreach ($females as $f): ?>
          <option value="<?= $f['id']; ?>" <?= ($heat['dog_id'] == $f['id']) ? 'selected' : ''; ?>>
            <?= htmlspecialchars($f['name']); ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Date début *</label>
        <input type="date" name="start_at" class="form-control" required
               value="<?= $heat['start_at'] ?? ''; ?>">
      </div>
      <div class="col-md-6">
        <label class="form-label">Date fin</label>
        <input type="date" name="end_at" class="form-control"
               value="<?= $heat['end_at'] ?? ''; ?>">
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label">Phase</label>
      <select name="stage" class="form-select">
        <option value="">-- Non précisé --</option>
        <option value="Début" <?= ($heat['stage'] === 'Début') ? 'selected' : ''; ?>>Début</option>
        <option value="Ovulation" <?= ($heat['stage'] === 'Ovulation') ? 'selected' : ''; ?>>Ovulation</option>
        <option value="Fin" <?= ($heat['stage'] === 'Fin') ? 'selected' : ''; ?>>Fin</option>
      </select>
    </div>

    <button type="submit" class="btn btn-success">💾 Enregistrer</button>
    <a href="list.php" class="btn btn-secondary">Annuler</a>
  </form>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
