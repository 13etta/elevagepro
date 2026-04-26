<?php
require __DIR__ . '/includes/config.php'; // Connexion BDD
require __DIR__ . '/includes/auth.php';   // Session + helpers

try {
    // Vérifie si la table users existe
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    $usersTableExists = $stmt->rowCount() > 0;

    // Vérifie si la table breeder existe
    $stmt = $pdo->query("SHOW TABLES LIKE 'breeder'");
    $breederTableExists = $stmt->rowCount() > 0;

    // Si une table n’existe pas → setup
    if (!$usersTableExists || !$breederTableExists) {
        header("Location: /settings/setup.php");
        exit;
    }

    // Vérifie s’il y a au moins 1 admin et un éleveur
    $hasUser = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $hasBreeder = $pdo->query("SELECT COUNT(*) FROM breeder")->fetchColumn();

    if ($hasUser == 0 || $hasBreeder == 0) {
        header("Location: /settings/setup.php");
        exit;
    }

    // Si utilisateur déjà connecté → dashboard
    if (!empty($_SESSION['user_id'])) {
        header("Location: /dashboard.php");
        exit;
    }

    // Sinon → login
    header("Location: /auth/login.php");
    exit;

} catch (Exception $e) {
    // En cas d’erreur → setup
    header("Location: /settings/setup.php");
    exit;
}
