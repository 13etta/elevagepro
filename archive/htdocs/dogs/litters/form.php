<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/header.php';

$id = $_GET['id'] ?? null;
$female_id = $mating_id = $birth_date = $notes = "";

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM litters WHERE id=?");
    $stmt->execute([$id]);
    $litter = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($litter) {
        $female_id  = $litter['female_id'];
        $mating_id  = $litter['mating_id'];
        $birth_date = $litter['birth_date'];
        $notes      = $litter['notes'];
    }
}

// Récupérer toutes les femelles
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex='F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

// Récupérer toutes les saillies
$matings = $pdo->query("
    SELECT m.id, m.mating_date, 
           d1.name AS male_name, 
           d2.name AS female_name
    FROM matings m
    JOIN dogs d1 ON m.male_id = d1.id
    JOIN dogs d2 ON m.female_id = d2.id
    ORDER BY m.mating_date DESC
")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container my-4">
  <h1 class="h4"><?= $id ? "Modifier" : "Nouvelle"; ?> portée</h1>
  <a class="btn btn-secondary mb-3" href="list.php">← Retour</a>

  <form method="post" action="store.php" class="card p-3 shadow-sm">
    <input type="hidden" name="id" value="<?= htmlspecialchars($id) ?>">

    <div class="mb-3">
      <label class="form-label">Saillie</label>
      <select name="mating_id" class="form-select" required>
        <option value="">-- Sélectionner --</option>
        <?php foreach ($matings as $m): ?>
          <option value="<?= $m['id'] ?>" <?= $mating_id==$m['id']?'selected':'' ?>>
            <?= htmlspecialchars($m['female_name']) ?> × <?= htmlspecialchars($m['male_name']) ?>
            (<?= date('d/m/Y', strtotime($m['mating_date'])) ?>)
          </option>
        <?php endforeach; ?>
      </select>
    </div>
<div class="col-md-6">
  <label class="form-label">Nombre de chiots</label>
  <input type="number" name="puppies_count" class="form-control" min="0" value="0">
</div>

    <div class="mb-3">
      <label class="form-label">Date mise bas</label>
      <input type="date" name="birth_date" class="form-control" value="<?= htmlspecialchars($birth_date) ?>" required>
    </div>

    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea name="notes" class="form-control" rows="3"><?= htmlspecialchars($notes) ?></textarea>
    </div>

    <div class="text-end">
      <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
    </div>
  </form>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
