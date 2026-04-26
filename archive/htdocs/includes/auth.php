<?php
// ================================
// auth.php → gestion de la session
// ================================

// Démarrer la session si pas déjà active
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// Vérifie si l’utilisateur est connecté
function require_login() {
    if (empty($_SESSION['user_id'])) {
        header("Location: /auth/login.php?next=" . urlencode($_SERVER['REQUEST_URI'] ?? '/dashboard.php'));
        exit;
    }
}

// Récupère l’utilisateur courant
function current_user() {
    return [
        'id'    => $_SESSION['user_id']   ?? null,
        'name'  => $_SESSION['user_name'] ?? null,
        'email' => $_SESSION['user_email']?? null,
        'role'  => $_SESSION['user_role'] ?? null,
    ];
}
