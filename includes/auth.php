<?php
// Vérifie la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

function require_login(): void {
    if (empty($_SESSION['user'])) {
        header('Location: /?page=login');
        exit;
    }
}

function breeder_id(): ?int {
    return isset($_SESSION['user']['breeder_id']) ? (int)$_SESSION['user']['breeder_id'] : null;
}
