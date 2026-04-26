<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// Initialisation
$id = $_GET['id'] ?? null;
$dog_id = $type = $label = $event_date = $next_due = $notes = "";

// Charger les chiens pour la liste déroulante
$dogs = $pdo->query("SELECT id, name FROM dogs ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

// Si modification
if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM soins WHERE id = ?");
    $stmt->execute([$id]);
    $soin = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($soin) {
        $dog_id     = $soin['dog_id'];
        $type       = $soin['type'];
        $label      = $soin['label'];
        $event_date = $soin['event_date'];
        $next_due   = $soin['next_due'];
        $notes      = $soin['notes'];
    }
}

// Sauvegarde formulaire
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $dog_id     = $_POST['dog_id'];
    $type       = $_POST['type'];
    $label      = $_POST['label'];
    $event_date = $_POST['event_date'];
    $next_due   = $_POST['next_due'] ?: null;
    $notes      = $_POST['notes'];

    if ($id) {
        // update
        $stmt = $pdo->prepare("UPDATE soins SET dog_id=?, type=?, label=?, event_date=?, next_due=?, notes=? WHERE id=?");
        $stmt->execute([$dog_id, $type, $label, $event_date, $next_due, $notes, $id]);
    } else {
        // insert
        $stmt = $pdo->prepare("INSERT INTO soins (dog_id, type, label, event_date, next_due, notes) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$dog_id, $type, $label, $event_date, $next_due, $notes]);
    }
    header("Location: /dogs/soins/list.php");
    exit;
}
?>

<div class="d-flex justify-content-between align-items-center">
  <h1 class="h4"><?php echo $id ? "Modifier" : "Ajouter"; ?> un soin</h1>
  <a class="btn btn-secondary" href="/dogs/soins/list.php">← Retour</a>
</div>

<form method="post" class="mt-3">
  <div class="mb-3">
    <label class="form-label">Chien</label>
    <select name="dog_id" class="form-select" required>
      <option value="">-- Sélectionner --</option>
      <?php foreach ($dogs as $d): ?>
        <option value="<?= $d['id']; ?>" <?php if ($dog_id == $d['id']) echo 'selected'; ?>>
          <?= htmlspecialchars($d['name']); ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Type</label>
    <select name="type" class="form-select" required>
      <?php 
      $types=[
        'vaccine'=>'Vaccination',
        'deworm'=>'Vermifuge',
        'parasite'=>'Antiparasitaire',
        'vet'=>'Visite vétérinaire',
        'other'=>'Autre'
      ]; 
      ?>
      <?php foreach ($types as $k=>$v): ?>
        <option value="<?= $k; ?>" <?php if ($type==$k) echo 'selected'; ?>><?= $v; ?></option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="mb-3">
    <label class="form-label">Produit / Libellé</label>
    <input type="text" name="label" class="form-control" value="<?= htmlspecialchars($label); ?>" required>
  </div>

  <div class="mb-3">
    <label class="form-label">Date du soin</label>
    <input type="date" name="event_date" class="form-control" value="<?= htmlspecialchars($event_date); ?>" required>
  </div>

  <div class="mb-3">
    <label class="form-label">Prochain dû</label>
    <input type="date" name="next_due" class="form-control" value="<?= htmlspecialchars($next_due); ?>">
  </div>

  <div class="mb-3">
    <label class="form-label">Notes</label>
    <textarea name="notes" class="form-control" rows="3"><?= htmlspecialchars($notes); ?></textarea>
  </div>

  <button type="submit" class="btn btn-primary">Enregistrer</button>
</form>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
