<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/header.php';

$id = $_GET['id'] ?? null;
$mating_id = $_GET['mating_id'] ?? null;
$female_id = $start_date = $expected_date = $due_date = $result = $notes = "";

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM pregnancies WHERE id=?");
    $stmt->execute([$id]);
    $preg = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($preg) {
        $mating_id    = $preg['mating_id'];
        $female_id    = $preg['female_id'];
        $start_date   = $preg['start_date'];
        $expected_date= $preg['expected_date'];
        $due_date     = $preg['due_date'];
        $result       = $preg['result'];
        $notes        = $preg['notes'];
    }
}

// Si on vient d'une saillie → préremplir
if ($mating_id && !$id) {
    $stmt = $pdo->prepare("SELECT m.id, m.mating_date, m.female_id
                           FROM matings m
                           WHERE m.id=?");
    $stmt->execute([$mating_id]);
    $mating = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($mating) {
        $female_id    = $mating['female_id'];
        $start_date   = $mating['mating_date'];
        $expected_date= date('Y-m-d', strtotime($mating['mating_date'].' +63 days'));
    }
}

// Récupérer toutes les femelles
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex='F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="d-flex justify-content-between align-items-center">
  <h1 class="h4"><?= $id ? "Modifier" : "Nouvelle"; ?> gestation</h1>
  <a class="btn btn-secondary" href="/dogs/pregnancies/list.php">← Retour</a>
</div>

<form method="post" action="/dogs/pregnancies/store.php" class="mt-3">
  <input type="hidden" name="id" value="<?= htmlspecialchars($id); ?>">
  <input type="hidden" name="mating_id" value="<?= htmlspecialchars($mating_id); ?>">

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
    <label class="form-label">Date début</label>
    <input type="date" name="start_date" class="form-control" value="<?= htmlspecialchars($start_date); ?>" required>
  </div>

  <div class="mb-3">
    <label class="form-label">Date prévue mise bas</label>
    <input type="date" name="expected_date" class="form-control" value="<?= htmlspecialchars($expected_date); ?>">
  </div>

  <div class="mb-3">
    <label class="form-label">Date réelle mise bas</label>
    <input type="date" name="due_date" class="form-control" value="<?= htmlspecialchars($due_date); ?>">
  </div>

  <div class="mb-3">
    <label class="form-label">Résultat</label>
    <select name="result" class="form-select">
      <option value="En cours" <?= $result==='En cours'?'selected':'' ?>>En cours</option>
      <option value="Réussie" <?= $result==='Réussie'?'selected':'' ?>>Réussie</option>
      <option value="Échec" <?= $result==='Échec'?'selected':'' ?>>Échec</option>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Notes</label>
    <textarea name="notes" class="form-control" rows="3"><?= htmlspecialchars($notes); ?></textarea>
  </div>

  <button type="submit" class="btn btn-primary">Enregistrer</button>

<script>
document.addEventListener("DOMContentLoaded", function() {
  const startDateInput = document.querySelector("input[name='start_date']");
  const expectedDateInput = document.querySelector("input[name='expected_date']");

  startDateInput.addEventListener("change", function() {
    if (this.value) {
      let startDate = new Date(this.value);
      startDate.setDate(startDate.getDate() + 63); // +63 jours
      expectedDateInput.value = startDate.toISOString().split('T')[0];
    }
  });
});
</script>
</form>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
