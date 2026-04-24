<?php
if (session_status() === PHP_SESSION_NONE) {
    session_save_path('/tmp');
    session_start();
}

function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

function require_login(): array {
    if (empty($_SESSION['user'])) {
        header('Location: /login.php'); // C'est cette ligne qui corrigeait la boucle
        exit;
    }
    return $_SESSION['user'];
}

function breeder_id(): ?int {
    return isset($_SESSION['user']['breeder_id']) ? (int)$_SESSION['user']['breeder_id'] : null;
}