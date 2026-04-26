<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/header.php';

$id = $_GET['id'] ?? null;
$male_id = $female_id = $mating_date = $method = $place = $notes = "";

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM matings WHERE id=?");
    $stmt->execute([$id]);
    $mating = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($mating) {
        $male_id     = $mating['male_id'];
        $female_id   = $mating['female_id'];
        $mating_date = $mating['mating_date'];
        $method      = $mating['method'];
        $place       = $mating['place'];
        $notes       = $mating['notes'];
    }
}

// Récupérer chiens mâles et femelles
$males = $pdo->query("SELECT id, name FROM dogs WHERE sex='M' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex='F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="d-flex justify-content-between align-items-center">
  <h1 class="h4"><?= $id ? "Modifier" : "Nouvelle"; ?> saillie</h1>
  <a class="btn btn-secondary" href="/dogs/matings/list.php">← Retour</a>
</div>

<form method="post" action="/dogs/matings/store.php" class="mt-3">
  <input type="hidden" name="id" value="<?= htmlspecialchars($id); ?>">

  <div class="mb-3">
    <label class="form-label">Mâle</label>
    <select name="male_id" class="form-select" required>
      <option value="">-- Sélectionner --</option>
      <?php foreach ($males as $m): ?>
        <option value="<?= $m['id']; ?>" <?= $male_id==$m['id']?'selected':'' ?>>
          <?= htmlspecialchars($m['name']); ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Femelle</label>
    <select name="female_id" class="form-select" required>
      <option value="">-- Sélectionner --</option>
      <?php foreach ($females as $f): ?>
        <option value="<?= $f['id']; ?>" <?= $female_id==$f['id']?'selected':'' ?>>
          <?= htmlspecialchars($f['name']); ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Date de la saillie *</label>
    <input type="date" name="mating_date" class="form-control" 
           value="<?= htmlspecialchars($mating_date); ?>" required>
  </div>

  <div class="mb-3">
    <label class="form-label">Méthode</label>
    <select name="method" class="form-select">
      <option value="Naturelle" <?= $method==='Naturelle'?'selected':''; ?>>Naturelle</option>
      <option value="Insémination" <?= $method==='Insémination'?'selected':''; ?>>Insémination</option>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Lieu</label>
    <input type="text" name="place" class="form-control" 
           value="<?= htmlspecialchars($place); ?>" placeholder="Ex: Chenil, élevage partenaire...">
  </div>

  <div class="mb-3">
    <label class="form-label">Notes</label>
    <textarea name="notes" class="form-control" rows="3"><?= htmlspecialchars($notes); ?></textarea>
  </div>

  <button type="submit" class="btn btn-primary">Enregistrer</button>
</form>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
