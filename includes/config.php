<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Récupération de l'URL de la base de données
$databaseUrl = getenv('DATABASE_URL');

if ($databaseUrl) {
    // Analyse de l'URL style postgres://user:pass@host:port/db
    $params = parse_url($databaseUrl);
    
    $host = $params['host'];
    $port = $params['port'] ?? 5432;
    $dbName = ltrim($params['path'], '/');
    $user = $params['user'];
    $password = $params['pass'];

    $dsn = "pgsql:host=$host;port=$port;dbname=$dbName";
} else {
    // Configuration locale par défaut
    $dsn = 'pgsql:host=localhost;port=5432;dbname=elevage';
    $user = 'postgres';
    $password = 'postgres';
}

try {
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    // En développement, tu peux décommenter la ligne suivante pour voir l'erreur réelle :
    // exit('Erreur : ' . $e->getMessage());
    exit('Erreur de connexion base de données. Vérifiez la configuration.');
}

function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $token = $_POST['_csrf'] ?? '';
        if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            http_response_code(419);
            exit('CSRF invalide.');
        }
    }
}