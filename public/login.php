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
            'email' => $user['email'],
            'role' => $user['role'],
        ];
        redirect('/index.php');
    }
    $error = 'Identifiants incorrects.';
}
?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connexion ElevagePro</title>
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="login">
    <section class="card">
        <p class="eyebrow">ElevagePro</p>
        <h1>Connexion</h1>
        <?php if($error): ?><p class="danger"><?= e($error) ?></p><?php endif; ?>
        <form method="post">
            <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
            <label>Email<input name="email" type="email" required autofocus></label>
            <label>Mot de passe<input name="password" type="password" required></label>
            <div class="actions">
                <button class="btn">Entrer</button>
            </div>
        </form>
    </section>
</body>
</html>