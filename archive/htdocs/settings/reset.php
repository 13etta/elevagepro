<?php
require_once __DIR__ . '/../includes/config.php';

try {
    // Désactiver les contraintes le temps du reset
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Lister les tables existantes
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

    foreach ($tables as $table) {
        $pdo->exec("DROP TABLE IF EXISTS `$table`");
    }

    // Réactiver les contraintes
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Rediriger vers setup
    header("Location: /settings/setup.php?reset=1");
    exit;

} catch (Exception $e) {
    die("Erreur lors du reset : " . $e->getMessage());
}
