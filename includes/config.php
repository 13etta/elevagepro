<?php
/**
 * includes/config.php
 */
if (session_status() === PHP_SESSION_NONE) {
    // Indispensable sur Render pour maintenir la session
    if (!is_dir('/tmp/sessions')) { mkdir('/tmp/sessions', 0777, true); }
    session_save_path('/tmp/sessions');
    session_start();
}

// Récupération de l'URL de la base de données
$databaseUrl = getenv('DATABASE_URL');

if ($databaseUrl) {
    $params = parse_url($databaseUrl);
    $dsn = "pgsql:host={$params['host']};port=" . ($params['port'] ?? 5432) . ";dbname=" . ltrim($params['path'], '/');
    $dbUser = $params['user'];
    $dbPassword = $params['pass'];
} else {
    $dsn = 'pgsql:host=localhost;port=5432;dbname=elevage';
    $dbUser = 'postgres';
    $dbPassword = 'postgres';
}

try {
    $pdo = new PDO($dsn, $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    exit('Erreur de connexion base de données.');
}

function db(): PDO {
    global $pdo;
    return $pdo;
}

function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

/**
 * Génère ou récupère le jeton CSRF
 */
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Vérifie le jeton CSRF lors des requêtes POST
 */
function verify_csrf(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $token = $_POST['_csrf'] ?? '';
        if (empty($token) || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            // Debug: Décommenter pour voir le souci si besoin
            // exit("CSRF Erreur: Attendu " . ($_SESSION['csrf_token'] ?? 'vide') . " Reçu " . $token);
            http_response_code(419);
            exit('CSRF invalide. Veuillez rafraîchir la page.');
        }
    }
}