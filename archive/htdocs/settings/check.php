<?php
require __DIR__ . '/../includes/config.php';
require __DIR__ . '/../includes/auth.php';

try {
    // Vérifie si la table users existe
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    $tableExists = $stmt->rowCount() > 0;

    if ($tableExists) {
        // Vérifie si au moins un admin existe
        $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        $adminCount = $stmt->fetchColumn();

        if ($adminCount > 0) {
            if (!empty($_SESSION['user_id'])) {
                // ✅ Déjà connecté → aller direct au dashboard
                header("Location: /dashboard.php");
                exit;
            } else {
                // ✅ Admin existe mais pas connecté → aller login
                header("Location: /auth/login.php");
                exit;
            }
        } else {
            // ✅ Table users mais pas d'admin → aller setup
            header("Location: /settings/setup.php");
            exit;
        }
    } else {
        // ✅ Pas de table users → aller setup
        header("Location: /settings/setup.php");
        exit;
    }

} catch (Exception $e) {
    // En cas d'erreur SQL → setup
    header("Location: /settings/setup.php");
    exit;
}
