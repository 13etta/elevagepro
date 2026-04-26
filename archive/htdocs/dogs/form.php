<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/config.php';
require __DIR__ . '/../includes/functions.php';
require __DIR__ . '/../includes/header.php';

// Récupération de l'ID s'il existe (édition)
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$dog = [
    'name' => '',
    'sex' => '',
    'breed' => 'Setter Anglais',
    'lof' => '',
    'chip' => '',
    'id_scc' => '',
    'status' => 'Actif',
    'birth_date' => '',
    'pedigree' => '',
    'notes' => '',
    'father_id' => null,
    'mother_id' => null
];

// Liste des chiens pour sélectionner les parents
$parents = $pdo->query("SELECT id, name, sex FROM dogs ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

if ($id > 0) {
    $stmt = $pdo->prepare("SELECT * FROM dogs WHERE id = ?");
    $stmt->execute([$id]);
    $dog = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$dog) {
        die("Chien introuvable.");
    }
}
?>

<div class="container my-4">
  <h1 class="h3 mb-4"><?= $id ? "Modifier le chien" : "Ajouter un chien"; ?></h1>

  <form method="post" action="store.php">
    <input type="hidden" name="id" value="<?= $dog['id'] ?? 0; ?>">

    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Nom *</label>
        <input type="text" name="name" class="form-control" required value="<?= htmlspecialchars($dog['name']); ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Sexe *</label>
        <select name="sex" class="form-select" required>
          <option value="">-- Choisir --</option>
          <option value="M" <?= $dog['sex']==='M'?'selected':''; ?>>Mâle</option>
          <option value="F" <?= $dog['sex']==='F'?'selected':''; ?>>Femelle</option>
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label">Race</label>
        <input type="text" name="breed" class="form-control" value="<?= htmlspecialchars($dog['breed']); ?>">
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-md-3">
        <label class="form-label">LOF</label>
        <input type="text" name="lof" class="form-control" value="<?= htmlspecialchars($dog['lof']); ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Puce</label>
        <input type="text" name="chip" class="form-control" value="<?= htmlspecialchars($dog['chip']); ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">ID SCC</label>
        <input type="text" name="id_scc" class="form-control" value="<?= htmlspecialchars($dog['id_scc']); ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Naissance</label>
        <input type="date" name="birth_date" class="form-control" value="<?= $dog['birth_date']; ?>">
      </div>
    </div>

    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Père</label>
        <select name="father_id" class="form-select">
          <option value="">-- Aucun --</option>
          <?php foreach ($parents as $p): if ($p['sex']==='M'): ?>
            <option value="<?= $p['id']; ?>" <?= $dog['father_id']==$p['id']?'selected':''; ?>>
              <?= htmlspecialchars($p['name']); ?>
            </option>
          <?php endif; endforeach; ?>
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Mère</label>
        <select name="mother_id" class="form-select">
          <option value="">-- Aucune --</option>
          <?php foreach ($parents as $p): if ($p['sex']==='F'): ?>
            <option value="<?= $p['id']; ?>" <?= $dog['mother_id']==$p['id']?'selected':''; ?>>
              <?= htmlspecialchars($p['name']); ?>
            </option>
          <?php endif; endforeach; ?>
        </select>
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label">Pedigree</label>
      <input type="text" name="pedigree" class="form-control" value="<?= htmlspecialchars($dog['pedigree']); ?>">
    </div>

    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea name="notes" class="form-control"><?= htmlspecialchars($dog['notes']); ?></textarea>
    </div>

    <div class="mb-3">
      <label class="form-label">Statut *</label>
      <select name="status" class="form-select" required>
        <option value="Actif" <?= $dog['status']==='Actif'?'selected':''; ?>>Actif</option>
        <option value="Réservé" <?= $dog['status']==='Réservé'?'selected':''; ?>>Réservé</option>
        <option value="Vendu" <?= $dog['status']==='Vendu'?'selected':''; ?>>Vendu</option>
        <option value="Retraité" <?= $dog['status']==='Retraité'?'selected':''; ?>>Retraité</option>
        <option value="Décédé" <?= $dog['status']==='Décédé'?'selected':''; ?>>Décédé</option>
      </select>
    </div>

    <button type="submit" class="btn btn-success">💾 Enregistrer</button>
    <a href="list.php" class="btn btn-secondary">Annuler</a>
  </form>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
