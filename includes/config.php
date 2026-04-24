<?php
/**
 * Configuration globale et connexion PostgreSQL
 */
if (session_status() === PHP_SESSION_NONE) {
    session_save_path('/tmp');
    session_start();
}

// Chargement des variables d'environnement locales (.env) si présent
$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value, " \t\n\r\0\x0B\"");
    }
}

// Récupération et parsing de l'URL de la base de données (Priorité Render)
$databaseUrl = getenv('DATABASE_URL') ?: ($_ENV['DATABASE_URL'] ?? null);

if ($databaseUrl) {
    $params = parse_url($databaseUrl);
    $host = $params['host'];
    $port = $params['port'] ?? 5432;
    $dbName = ltrim($params['path'], '/');
    $dbUser = $params['user'];
    $dbPassword = $params['pass'];
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbName";
} else {
    // Configuration par défaut pour le développement local
    $dsn = 'pgsql:host=localhost;port=5432;dbname=elevage';
    $dbUser = $_ENV['DB_USER'] ?? 'postgres';
    $dbPassword = $_ENV['DB_PASSWORD'] ?? 'postgres';
}

try {
    $pdo = new PDO($dsn, $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    // En production, on évite d'afficher les détails techniques à l'utilisateur
    exit('Erreur de connexion base de données. Vérifiez la configuration.');
}

/**
 * Échappement des sorties HTML (Protection XSS)
 */
function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

/**
 * Génère ou récupère un jeton CSRF pour les formulaires
 */
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Vérifie la validité du jeton CSRF lors d'une requête POST
 */
function verify_csrf(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $token = $_POST['_csrf'] ?? '';
        if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            http_response_code(419);
            exit('CSRF invalide.');
        }
    }
}
function db(): PDO {
    global $pdo;
    return $pdo;
}