<?php
// includes/config.php — connexion PDO (UTF8MB4) + paramètres globaux

// >>> MODIFIE CES 4 LIGNES SELON TA CONFIG <<
$DB_HOST = getenv('DB_HOST') ?: 'localhost';
$DB_NAME = getenv('DB_NAME') ?: 'elevagepro';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: '';

// Connexion PDO
try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo "Erreur de connexion à la base de données : " . htmlspecialchars($e->getMessage());
    exit;
}

// Démarre la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Clé API simple (change-la en production)
if (!defined('API_KEY')) {
    define('API_KEY', getenv('ELEVAGEPRO_API_KEY') ?: 'dev-api-key-change-me');
}

// Helper base_url — protégé contre les redéfinitions
if (!function_exists('base_url')) {
    function base_url($path = '') {
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
        return $base === '' ? $path : ($base . '/' . ltrim($path, '/'));
    }
}
