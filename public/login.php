<?php
/**
 * public/login.php
 */
require_once '../includes/helpers.php';

if (current_user()) {
    redirect('/index.php');
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'breeder_id' => (int)$user['breeder_id'],
            'name' => $user['name'],
            'email' => $user['email']
        ];
        redirect('/index.php');
    }
    $error = 'Identifiants incorrects ou compte inexistant.';
}
?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Connexion · ÉlevagePro</title>
    <link rel="stylesheet" href="/assets/css/app.css">
    <style>
        body.login-page { background: #1a202c; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #fff; font-family: sans-serif; }
        .login-card { background: #2d3748; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 100%; max-width: 400px; }
        .login-card h1 { margin-top: 0; font-size: 1.5rem; text-align: center; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; color: #a0aec0; }
        input { width: 100%; padding: 0.75rem; border-radius: 4px; border: 1px solid #4a5568; background: #1a202c; color: #fff; box-sizing: border-box; }
        .btn-login { width: 100%; padding: 0.75rem; border: none; border-radius: 4px; background: #4299e1; color: white; font-weight: bold; cursor: pointer; margin-top: 1rem; }
        .error-msg { background: #f56565; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.9rem; }
    </style>
</head>
<body class="login-page">
    <div class="login-card">
        <h1>Élevage<span>Pro</span></h1>
        <?php if($error): ?>
            <div class="error-msg"><?= e($error) ?></div>
        <?php endif; ?>
        <form method="post">
            <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
            <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" required autofocus>
            </div>
            <div class="form-group">
                <label>Mot de passe</label>
                <input type="password" name="password" required>
            </div>
            <button type="submit" class="btn-login">Se connecter</button>
        </form>
    </div>
</body>
</html>