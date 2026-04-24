<?php
require_once '../includes/helpers.php';

// Si déjà connecté, on va à l'accueil
if (current_user()) redirect('/');

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $stmt = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $_POST['email'] ?? '']);
    $user = $stmt->fetch();
    
    if ($user && password_verify($_POST['password'] ?? '', $user['password_hash'])) {
        // Stockage complet de l'utilisateur pour le SaaS
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

// Le reste du fichier (HTML) ne change pas
include '../includes/layout.php'; // Pour charger le CSS et le début du HTML
?>
<main class="login-main">
    <section class="login-card">
        <h1>Connexion élevage</h1>
        <p>Accès sécurisé à votre registre d’élevage.</p>
        <?php if ($error): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
        <form method="post">
            <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
            <label>Email<input name="email" type="email" required></label>
            <label>Mot de passe<input name="password" type="password" required></label>
            <button>Se connecter</button>
        </form>
    </section>
</main>