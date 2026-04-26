<?php
require '../includes/auth.php';
require '../includes/config.php';
require '../includes/header.php';

// Charger infos éleveur (une seule ligne)
$stmt = $pdo->query("SELECT * FROM breeder LIMIT 1");
$breeder = $stmt->fetch(PDO::FETCH_ASSOC);

// Si aucune ligne → en créer une
if (!$breeder) {
    $pdo->exec("INSERT INTO breeder (name, first_name, last_name) VALUES ('', '', '')");
    $stmt = $pdo->query("SELECT * FROM breeder LIMIT 1");
    $breeder = $stmt->fetch(PDO::FETCH_ASSOC);
}

// Traitement du formulaire
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name            = trim($_POST['name']);
    $first_name      = trim($_POST['first_name']);
    $last_name       = trim($_POST['last_name']);
    $siret           = trim($_POST['siret']);
    $producer_number = trim($_POST['producer_number']);
    $theme           = $_POST['theme'] ?? 'light';
    $logo            = $breeder['logo'];

// Upload du logo si fourni
if (!empty($_FILES['logo']['name'])) {
    $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));

    // Vérification extension autorisée
    $allowed = ['jpg','jpeg','png','gif','webp'];
    if (in_array($ext, $allowed)) {
        $filename = 'logo_' . time() . '.' . $ext;
        $target   = __DIR__ . '/../uploads/' . $filename;

        if (move_uploaded_file($_FILES['logo']['tmp_name'], $target)) {
            $logo = $filename;
        } else {
            echo "<div class='alert alert-danger'>Erreur lors de l'upload du fichier.</div>";
        }
    } else {
        echo "<div class='alert alert-warning'>Format non autorisé. Seuls JPG, PNG, GIF, WEBP sont acceptés.</div>";
    }
}

    // Mise à jour
    $sql = "UPDATE breeder 
            SET name=?, first_name=?, last_name=?, siret=?, producer_number=?, logo=?, theme=? 
            WHERE id=?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$name, $first_name, $last_name, $siret, $producer_number, $logo, $theme, $breeder['id']]);

    header("Location: breeder.php?success=1");
    exit;
}
?>

<div class="container">
    <h1 class="mb-4">Paramètres de l'éleveur</h1>

    <?php if (!empty($_GET['success'])): ?>
        <div class="alert alert-success">
            <i class="bi bi-check-circle"></i> Informations mises à jour avec succès.
        </div>
    <?php endif; ?>

    <form method="post" enctype="multipart/form-data" class="card p-3 shadow-sm">
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label">Nom de l'élevage</label>
                <input type="text" name="name" class="form-control" 
                       value="<?= htmlspecialchars($breeder['name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
                <label class="form-label">Logo</label>
                <input type="file" name="logo" class="form-control">
                <?php if (!empty($breeder['logo'])): ?>
                    <img src="../uploads/<?= htmlspecialchars($breeder['logo']) ?>" 
                         class="img-thumbnail mt-2" height="60">
                <?php endif; ?>
            </div>
            <div class="col-md-6">
                <label class="form-label">Prénom</label>
                <input type="text" name="first_name" class="form-control" 
                       value="<?= htmlspecialchars($breeder['first_name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
                <label class="form-label">Nom</label>
                <input type="text" name="last_name" class="form-control" 
                       value="<?= htmlspecialchars($breeder['last_name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
                <label class="form-label">SIRET</label>
                <input type="text" name="siret" class="form-control" 
                       value="<?= htmlspecialchars($breeder['siret'] ?? '') ?>">
            </div>
            <div class="col-md-6">
                <label class="form-label">Numéro de producteur</label>
                <input type="text" name="producer_number" class="form-control" 
                       value="<?= htmlspecialchars($breeder['producer_number'] ?? '') ?>">
            </div>
            <div class="col-md-6">
                <label class="form-label">Mode d'affichage</label>
                <select name="theme" class="form-select">
                    <option value="light" <?= ($breeder['theme'] ?? 'light') === 'light' ? 'selected' : '' ?>>Clair</option>
                    <option value="dark" <?= ($breeder['theme'] ?? '') === 'dark' ? 'selected' : '' ?>>Sombre</option>
                </select>
            </div>
        </div>
        <div class="mt-3 text-end">
            <button type="submit" class="btn btn-primary">
                <i class="bi bi-save"></i> Enregistrer
            </button>
        </div>
    </form>
</div>

<?php require '../includes/footer.php'; ?>
