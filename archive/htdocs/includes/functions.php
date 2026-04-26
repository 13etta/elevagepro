<?php
// includes/functions.php — CSRF, flashes, helpers
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// =====================
// CSRF
// =====================
function csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf($token) {
    return hash_equals($_SESSION['csrf_token'] ?? '', $token ?? '');
}

// =====================
// Flash messages
// =====================
function flash($type, $msg) {
    $_SESSION['flash'][] = ['type' => $type, 'msg' => $msg];
}

function flashes() {
    $msgs = $_SESSION['flash'] ?? [];
    $_SESSION['flash'] = [];
    return $msgs;
}

// =====================
// Helpers
// =====================
function h($s) {
    return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8');
}

function paginate($total, $page, $perPage) {
    return [
        'total'    => $total,
        'page'     => $page,
        'per_page' => $perPage,
        'pages'    => max(1, (int)ceil($total / $perPage))
    ];
}

// ====================================
// Calcul du COI (Coefficient de consanguinité)
// ====================================
function getAncestors(PDO $pdo, $dog_id, $depth = 3, $level = 1) {
    if ($depth == 0 || !$dog_id) return [];
    $stmt = $pdo->prepare("SELECT father_id, mother_id FROM dogs WHERE id=?");
    $stmt->execute([$dog_id]);
    $dog = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$dog) return [];

    $ancestors = [];
    foreach (['father_id','mother_id'] as $parent) {
        if (!empty($dog[$parent])) {
            $ancestors[] = [
                'id'    => $dog[$parent],
                'level' => $level
            ];
            $ancestors = array_merge(
                $ancestors,
                getAncestors($pdo, $dog[$parent], $depth-1, $level+1)
            );
        }
    }
    return $ancestors;
}

function calculateCOI(PDO $pdo, $male_id, $female_id, $depth = 3) {
    if (!$male_id || !$female_id) return 0;

    $maleAnc   = getAncestors($pdo, $male_id, $depth);
    $femaleAnc = getAncestors($pdo, $female_id, $depth);

    $coi = 0.0;
    foreach ($maleAnc as $m) {
        foreach ($femaleAnc as $f) {
            if ($m['id'] == $f['id']) {
                // Formule simplifiée de Wright
                $coi += pow(0.5, $m['level'] + $f['level'] + 1);
            }
        }
    }
    return round($coi * 100, 2); // pourcentage avec 2 décimales
}
