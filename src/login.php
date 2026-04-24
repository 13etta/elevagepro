<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'breeder_id' => (int)$user['breeder_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
        header('Location: /?page=dashboard'); exit;
    }
    $error = 'Identifiants incorrects.';
}
?>
<section class="login-card">
    <h1>Connexion élevage</h1>
    <p>Accès sécurisé à votre registre d’élevage.</p>
    <?php if (!empty($error)): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
    <form method="post">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <label>Email<input name="email" type="email" required></label>
        <label>Mot de passe<input name="password" type="password" required></label>
        <button>Se connecter</button>
    </form>
    <p style="text-align:center; margin-top:18px; font-size:14px;">
    <a href="/?page=register" style="color:var(--bronze); text-decoration:none;">Pas encore de compte ? S'inscrire</a>
</p>
</section>
