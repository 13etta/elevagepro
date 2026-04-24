<?php
require_once '../includes/helpers.php'; // On charge tout d'un coup

if (current_user()) redirect('/');

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $stmt = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $_POST['email'] ?? '']);
    $user = $stmt->fetch();
    
    if ($user && password_verify($_POST['password'] ?? '', $user['password_hash'])) {
        // Restauration de l'array attendu par l'application
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'breeder_id' => (int)$user['breeder_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
        redirect('/');
    }
    $error = 'Identifiants incorrects.';
}
?>