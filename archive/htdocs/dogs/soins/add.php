<?php
require '../includes/config.php';
require '../includes/header.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $stmt = $pdo->prepare("INSERT INTO soins (dog_id,type,name,date_admin,next_due,notes) VALUES (?,?,?,?,?,?)");
    $stmt->execute([
        $_POST['dog_id'],
        $_POST['type'],
        $_POST['name'],
        $_POST['date_admin'],
        $_POST['next_due'] ?: null,
        $_POST['notes']
    ]);
    header("Location: list.php");
    exit;
}

$dogs = $pdo->query("SELECT id, name FROM dogs ORDER BY name")->fetchAll();
?>

<h1 class="h4">Ajouter un soin</h1>
<form method="post" class="row g-3">
  <div class="col-md-4">
    <label class="form-label">Chien</label>
    <select name="dog_id" class="form-select" required>
      <?php foreach($dogs as $d): ?>
        <option value="<?= $d['id'] ?>"><?= htmlspecialchars($d['name']) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <div class="col-md-4">
    <label class="form-label">Type</label>
    <select name="type" class="form-select">
      <option value="vaccination">Vaccination</option>
      <option value="vermifuge">Vermifuge</option>
      <option value="antiparasite">Antiparasitaire</option>
    </select>
  </div>
  <div class="col-md-4">
    <label class="form-label">Nom du produit</label>
    <input type="text" name="name" class="form-control" required>
  </div>
  <div class="col-md-4">
    <label class="form-label">Date d’administration</label>
    <input type="date" name="date_admin" class="form-control" required>
  </div>
  <div class="col-md-4">
    <label class="form-label">Prochain rappel</label>
    <input type="date" name="next_due" class="form-control">
  </div>
  <div class="col-md-12">
    <label class="form-label">Notes</label>
    <textarea name="notes" class="form-control"></textarea>
  </div>
  <div class="col-12">
    <button class="btn btn-success">Enregistrer</button>
  </div>
</form>

<?php require '../includes/footer.php'; ?>
