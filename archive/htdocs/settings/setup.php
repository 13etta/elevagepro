<?php
require_once __DIR__ . '/../includes/config.php';

// Vérifier si déjà configuré
try {
    $tables = $pdo->query("SHOW TABLES LIKE 'users'")->rowCount();
    $hasUser = $tables ? $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() : 0;
    $hasBreeder = $pdo->query("SHOW TABLES LIKE 'breeder'")->rowCount() 
        ? $pdo->query("SELECT COUNT(*) FROM breeder")->fetchColumn() 
        : 0;

    if ($hasUser > 0 && $hasBreeder > 0) {
        header("Location: /auth/login.php");
        exit;
    }
} catch (Exception $e) {
    die("Erreur BDD : " . $e->getMessage());
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Création des tables
    try {
        $schema = file_get_contents(__DIR__ . '/../install/schema.sql');
        $pdo->exec($schema);
    } catch (Exception $e) {
        die("Erreur lors de la création des tables : " . $e->getMessage());
    }

    // Données du formulaire
    $email    = trim($_POST['email']);
    $password = password_hash($_POST['password'], PASSWORD_BCRYPT);

    $name            = trim($_POST['name']);
    $first_name      = trim($_POST['first_name']);
    $last_name       = trim($_POST['last_name']);
    $siret           = trim($_POST['siret']);
    $producer_number = trim($_POST['producer_number']);
    $theme           = $_POST['theme'] ?? 'light';
    $logo            = null;

    // Upload logo
    if (!empty($_FILES['logo']['name'])) {
        $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg','jpeg','png','gif','webp'];
        if (in_array($ext, $allowed)) {
            $filename = 'logo_' . time() . '.' . $ext;
            $target   = __DIR__ . '/../uploads/' . $filename;
            if (move_uploaded_file($_FILES['logo']['tmp_name'], $target)) {
                $logo = $filename;
            }
        }
    }

    try {
        // Insérer admin
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')");
        $stmt->execute([$first_name . ' ' . $last_name, $email, $password]);

        // Insérer éleveur
        $stmt = $pdo->prepare("INSERT INTO breeder (name, logo, first_name, last_name, siret, producer_number, theme) 
                               VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $logo, $first_name, $last_name, $siret, $producer_number, $theme]);

        header("Location: /auth/login.php?setup=1");
        exit;
    } catch (Exception $e) {
        $error = "Erreur lors de l’installation : " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Installation - ÉlevagePro</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-5">
  <div class="card shadow-lg p-4">
    <h2 class="mb-4 text-center">Installation du logiciel</h2>
    <?php if ($error): ?>
      <div class="alert alert-danger"><?= $error ?></div>
    <?php endif; ?>

    <form method="post" enctype="multipart/form-data" class="row g-3">
      <h4>Compte administrateur</h4>
      <div class="col-md-6">
        <label>Email</label>
        <input type="email" name="email" class="form-control" required>
      </div>
      <div class="col-md-6">
        <label>Mot de passe</label>
        <input type="password" name="password" class="form-control" required>
      </div>

      <h4 class="mt-4">Informations éleveur</h4>
      <div class="col-md-6">
        <label>Nom de l'élevage</label>
        <input type="text" name="name" class="form-control" required>
      </div>
      <div class="col-md-6">
        <label>Logo</label>
        <input type="file" name="logo" class="form-control">
      </div>
      <div class="col-md-6">
        <label>Prénom</label>
        <input type="text" name="first_name" class="form-control" required>
      </div>
      <div class="col-md-6">
        <label>Nom</label>
        <input type="text" name="last_name" class="form-control" required>
      </div>
      <div class="col-md-6">
        <label>SIRET</label>
        <input type="text" name="siret" class="form-control">
      </div>
      <div class="col-md-6">
        <label>Numéro de producteur</label>
        <input type="text" name="producer_number" class="form-control">
      </div>
      <div class="col-md-6">
        <label>Thème</label>
        <select name="theme" class="form-select">
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>

      <div class="col-12 text-center mt-4">
        <button type="submit" class="btn btn-primary btn-lg">Lancer le logiciel</button>
      </div>
    </form>
  </div>
</div>
</body>
</html>
