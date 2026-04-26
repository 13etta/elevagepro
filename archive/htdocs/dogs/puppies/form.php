<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/header.php';

$id = $_GET['id'] ?? null;

$name = $chip_number = $sex = $color = $status = $sale_price = $birth_date = $notes = "";
$litter_id = null;

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM puppies WHERE id = ?");
    $stmt->execute([$id]);
    $puppy = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($puppy) {
        $name        = $puppy['name'];
        $chip_number = $puppy['chip_number'];
        $sex         = $puppy['sex'];
        $color       = $puppy['color'];
        $status      = $puppy['status'];
        $sale_price  = $puppy['sale_price'];
        $birth_date  = $puppy['birth_date'];
        $notes       = $puppy['notes'];
        $litter_id   = $puppy['litter_id'];
    }
}

// Récupérer les portées
$litters = $pdo->query("SELECT id, birth_date FROM litters ORDER BY birth_date DESC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container my-4">
  <h1 class="h4"><?= $id ? "Modifier" : "Nouveau"; ?> chiot</h1>
  <a href="list.php" class="btn btn-secondary mb-3">← Retour</a>

  <form method="post" action="store.php" class="card p-3 shadow-sm">
    <input type="hidden" name="id" value="<?= htmlspecialchars($id) ?>">

    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Nom</label>
        <input type="text" name="name" class="form-control" value="<?= htmlspecialchars($name) ?>" required>
      </div>
      <div class="col-md-6">
        <label class="form-label">N° Puce</label>
        <input type="text" name="chip_number" class="form-control" value="<?= htmlspecialchars($chip_number) ?>">
      </div>
    </div>

    <div class="row mb-3">
      <div class="col-md-3">
        <label class="form-label">Sexe</label>
        <select name="sex" class="form-select" required>
          <option value="">-- Choisir --</option>
          <option value="M" <?= $sex==='M'?'selected':'' ?>>Mâle</option>
          <option value="F" <?= $sex==='F'?'selected':'' ?>>Femelle</option>
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label">Couleur</label>
        <input type="text" name="color" class="form-control" value="<?= htmlspecialchars($color) ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Naissance</label>
        <input type="date" name="birth_date" class="form-control" value="<?= htmlspecialchars($birth_date) ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Prix (€)</label>
        <input type="number" step="0.01" name="sale_price" class="form-control" value="<?= htmlspecialchars($sale_price) ?>">
      </div>
    </div>

    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Portée</label>
        <select name="litter_id" class="form-select" required>
          <option value="">-- Choisir --</option>
          <?php foreach ($litters as $l): ?>
            <option value="<?= $l['id'] ?>" <?= $litter_id==$l['id']?'selected':'' ?>>
              Portée du <?= date('d/m/Y', strtotime($l['birth_date'])) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Statut</label>
        <select name="status" class="form-select">
          <option value="Actif" <?= $status==='Actif'?'selected':'' ?>>Disponible</option>
          <option value="Réservé" <?= $status==='Réservé'?'selected':'' ?>>Réservé</option>
          <option value="Vendu" <?= $status==='Vendu'?'selected':'' ?>>Vendu</option>
          <option value="Décédé" <?= $status==='Décédé'?'selected':'' ?>>Décédé</option>
        </select>
      </div>
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
