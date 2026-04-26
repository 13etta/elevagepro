<?php
require __DIR__ . '/../includes/config.php';

header('Content-Type: application/json; charset=utf-8');

// Vérification clé API (dans config.php → define('API_KEY', '...'))
$key = $_GET['key'] ?? (isset($_SERVER['HTTP_AUTHORIZATION']) 
    ? preg_replace('/^Bearer\s+/i','',$_SERVER['HTTP_AUTHORIZATION']) 
    : ''
);
if ($key !== API_KEY) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

// Paramètres
$action = $_GET['action'] ?? 'ping';
$limit  = max(1, min(200, (int)($_GET['limit'] ?? 100)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

function fetch_all($pdo, $sql, $args = []) {
    $st = $pdo->prepare($sql);
    $st->execute($args);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

// Routes API
switch($action) {
    case 'ping':
        echo json_encode(['ok'=>true,'time'=>date('c')]);
        break;
    case 'dogs':
        echo json_encode(fetch_all($pdo, "SELECT * FROM dogs ORDER BY id DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'heats':
        echo json_encode(fetch_all($pdo, "SELECT * FROM heats ORDER BY start_date DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'soins':
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query("SELECT * FROM soins");
        echo json_encode($stmt->fetchAll());
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $stmt = $pdo->prepare("INSERT INTO soins (dog_id, type, name, date_admin, next_due, notes) VALUES (?,?,?,?,?,?)");
        $stmt->execute([
            $data['dog_id'], $data['type'], $data['name'],
            $data['date_admin'], $data['next_due'], $data['notes']
        ]);
        echo json_encode(["status" => "ok"]);
    }
    break;
    case 'events':
        echo json_encode(fetch_all($pdo, "SELECT * FROM events ORDER BY date_time DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'matings':
        echo json_encode(fetch_all($pdo, "SELECT * FROM matings ORDER BY date DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'pregnancies':
        echo json_encode(fetch_all($pdo, "SELECT * FROM pregnancies ORDER BY id DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'litters':
        echo json_encode(fetch_all($pdo, "SELECT * FROM litters ORDER BY id DESC LIMIT $limit OFFSET $offset"));
        break;
    case 'puppies':
        echo json_encode(fetch_all($pdo, "SELECT * FROM puppies ORDER BY id DESC LIMIT $limit OFFSET $offset"));
        break;
    default:
        http_response_code(400);
        echo json_encode(['error'=>'unknown action']);
}
