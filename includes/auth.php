<?php
/**
 * Gestion de l'authentification et de la session
 */
if (session_status() === PHP_SESSION_NONE) {
    // Indispensable sur Render pour éviter les erreurs de droits d'écriture
    session_save_path('/tmp');
    session_start();
}

/**
 * Retourne les données de l'utilisateur connecté ou null
 */
function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

/**
 * Force la redirection vers la page de connexion si l'utilisateur n'est pas authentifié
 */
function require_login(): void {
    if (empty($_SESSION['user'])) {
        header('Location: /?page=login');
        exit;
    }
}

/**
 * Retourne l'ID de l'élevage associé à l'utilisateur actuel
 */
function breeder_id(): ?int {
    return isset($_SESSION['user']['breeder_id']) ? (int)$_SESSION['user']['breeder_id'] : null;
}