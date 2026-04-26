<?php
// Exemple session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$userEmail = $_SESSION['user_email'] ?? 'admin@example.com';

// Connexion BDD
require_once __DIR__ . '/config.php';

// Charger infos éleveur
$stmt = $pdo->query("SELECT * FROM breeder LIMIT 1");
$breeder = $stmt->fetch(PDO::FETCH_ASSOC);

// Déterminer le thème
$theme = $breeder['theme'] ?? 'light';
$bodyClass   = ($theme === 'dark') ? 'bg-dark text-light' : '';
$navbarClass = ($theme === 'dark') ? 'navbar-dark bg-dark' : 'navbar-light bg-light border-bottom';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($breeder['name'] ?? 'Élevage Pro') ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/assets/css/style.css" rel="stylesheet"> <!-- ton CSS custom -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
</head>
<body class="<?= $bodyClass ?>">

<!-- Navbar -->
<nav class="navbar navbar-expand-lg <?= $navbarClass ?> shadow-sm">
  <div class="container-fluid">

    <!-- Logo + Nom élevage -->
    <a class="navbar-brand d-flex align-items-center" href="/dashboard.php">
      <?php if (!empty($breeder['logo'])): ?>
        <img src="/uploads/<?= htmlspecialchars($breeder['logo']) ?>" 
             alt="Logo" height="30" class="me-2 rounded">
      <?php endif; ?>
      <?= htmlspecialchars($breeder['name'] ?? 'Mon Élevage') ?>
    </a>

    <!-- Burger menu (mobile) -->
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <!-- Menu -->
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">

        <!-- Dashboard -->
        <li class="nav-item">
          <a class="nav-link" href="/dashboard.php">Accueil</a>
        </li>

        <!-- Gestion chiens -->
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="dogsMenu" role="button" data-bs-toggle="dropdown" aria-expanded="false">
            Chiens
          </a>
          <ul class="dropdown-menu" aria-labelledby="dogsMenu">
            <li><a class="dropdown-item" href="/dogs/list.php">Liste des chiens</a></li>
            <li><a class="dropdown-item" href="/dogs/heats/list.php">Chaleurs</a></li>
            <li><a class="dropdown-item" href="/dogs/soins/list.php">Suivi soins</a></li>
          </ul>
        </li>

        <!-- Reproduction -->
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="reproMenu" role="button" data-bs-toggle="dropdown" aria-expanded="false">
            Reproduction
          </a>
          <ul class="dropdown-menu" aria-labelledby="reproMenu">
            <li><a class="dropdown-item" href="/dogs/matings/list.php">Saillies</a></li>
            <li><a class="dropdown-item" href="/dogs/pregnancies/list.php">Gestations</a></li>
            <li><a class="dropdown-item" href="/dogs/litters/list.php">Portées</a></li>
            <li><a class="dropdown-item" href="/dogs/puppies/list.php">Chiots</a></li>
          </ul>
        </li>
      </ul>

      <!-- Bouton Paramètres -->
      <a href="/settings/breeder.php" class="btn btn-sm btn-outline-secondary me-2" title="Paramètres">
        <i class="bi bi-gear-fill"></i>
      </a>

      <!-- User + logout -->
      <span class="navbar-text <?= ($theme === 'dark') ? 'text-light' : 'text-dark' ?>">
        <?= htmlspecialchars($userEmail) ?>
      </span>
<a href="/auth/logout.php" class="btn btn-outline-light ms-2">Déconnexion</a>
    </div>
  </div>
</nav>

<div class="container mt-4">
