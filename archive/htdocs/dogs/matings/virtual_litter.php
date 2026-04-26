<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// Charger les chiens
function getDogsBySex(PDO $pdo, $sex) {
    $stmt = $pdo->prepare("SELECT id, name, id_scc FROM dogs WHERE sex=? ORDER BY name ASC");
    $stmt->execute([$sex]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$maleDogs   = getDogsBySex($pdo, 'M');
$femaleDogs = getDogsBySex($pdo, 'F');

$male_id   = $_GET['male_id'] ?? null;
$female_id = $_GET['female_id'] ?? null;

$male   = null;
$female = null;
$coi = null;

if ($male_id && $female_id) {
    $stmt = $pdo->prepare("SELECT * FROM dogs WHERE id=?");
    $stmt->execute([$male_id]);
    $male = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("SELECT * FROM dogs WHERE id=?");
    $stmt->execute([$female_id]);
    $female = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($male && $female) {
        $coi = calculateCOI($pdo, $male_id, $female_id, 5);
    }
}
?>

<div class="d-flex justify-content-between align-items-center">
  <h1 class="h4">Portée virtuelle</h1>
  <a class="btn btn-secondary" href="/dogs/matings/list.php">← Retour</a>
</div>

<form method="get" class="row g-3 mt-3">
  <div class="col-md-5">
    <label class="form-label">Mâle</label>
    <select name="male_id" class="form-select">
      <option value="">-- Choisir un mâle --</option>
      <?php foreach ($maleDogs as $dog): ?>
        <option value="<?= $dog['id']; ?>" <?= ($dog['id']==$male_id ? 'selected' : ''); ?>>
          <?= htmlspecialchars($dog['name']); ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="col-md-5">
    <label class="form-label">Femelle</label>
    <select name="female_id" class="form-select">
      <option value="">-- Choisir une femelle --</option>
      <?php foreach ($femaleDogs as $dog): ?>
        <option value="<?= $dog['id']; ?>" <?= ($dog['id']==$female_id ? 'selected' : ''); ?>>
          <?= htmlspecialchars($dog['name']); ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>

  <div class="col-md-2 d-flex align-items-end">
    <button type="submit" class="btn btn-primary w-100">Générer</button>
  </div>
</form>

<?php if ($male && $female): ?>
  <div class="mt-4">
    <h3>Résultat</h3>
    <p><strong>COI de la portée :</strong> <?= $coi; ?> %</p>

    <?php if (!empty($male['id_scc']) && !empty($female['id_scc'])): ?>
      <h5 class="mt-4">Portée virtuelle SCC</h5>
      <iframe 
        src="https://www.centrale-canine.fr/lofselect/alliance-virtuelle/result?chienMaleId=<?= $male['id_scc']; ?>&chienFemaleId=<?= $female['id_scc']; ?>&globalBreedId=223&globalBreedName=Setter%20anglais" 
        style="width:100%; height:900px; border:1px solid #ccc;">
      </iframe>
    <?php else: ?>
      <p class="text-danger">⚠️ Les parents n’ont pas encore d’ID SCC renseigné.</p>
    <?php endif; ?>
  </div>
<?php endif; ?>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
