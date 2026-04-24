<?php
/**
 * public/login.php
 * Gestion de l'authentification sécurisée
 */

// On charge la configuration (qui lance la session) et les outils
require_once '../includes/config.php';
require_once '../includes/helpers.php';

// Si l'utilisateur est déjà connecté, on le redirige vers l'accueil
if (isset($_SESSION['breeder_id'])) {
    redirect('/index.php');
}

$error = null;

// Traitement du formulaire de connexion
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim(post_value('email'));
    $password = post_value('password');

    if ($email && $password) {
        $stmt = db()->prepare("SELECT id, password_hash FROM breeders WHERE email = :email");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            // Régénération de l'ID de session pour prévenir la fixation de session
            session_regenerate_id(true);
            
            $_SESSION['breeder_id'] = $user['id'];
            
            // Redirection vers le tableau de bord avec un chemin absolu
            redirect('/index.php');
        } else {
            $error = "Identifiants invalides. Veuillez réessayer.";
        }
    } else {
        $error = "Veuillez remplir tous les champs.";
    }
}

// Début de l'affichage (on n'utilise pas render_header ici car le menu ne doit pas s'afficher)
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion - ÉlevagePro</title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="auth-page">
    <main class="auth-container">
        <div class="auth-card">
            <h1>ÉlevagePro</h1>
            <p class="subtitle">Connectez-vous à votre espace gestion</p>

            <?php if ($error): ?>
                <div class="alert alert-danger">
                    <?= e($error) ?>
                </div>
            <?php endif; ?>

            <form method="POST" action="login.php">
                <div class="form-group">
                    <label for="email">Email professionnel</label>
                    <input type="email" name="email" id="email" required autofocus 
                           value="<?= e(post_value('email')) ?>">
                </div>

                <div class="form-group">
                    <label for="password">Mot de passe</label>
                    <input type="password" name="password" id="password" required>
                </div>

                <button type="submit" class="btn-primary">Se connecter</button>
            </form>

            <div class="auth-footer">
                <p>Pas encore de compte ? <a href="register.php">Créer un accès</a></p>
            </div>
        </div>
    </main>
</body>
</html>