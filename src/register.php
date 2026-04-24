<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Vérification de sécurité CSRF déjà présente dans ton architecture
    verify_csrf(); 

    // Nettoyage des entrées
    $breeder_name = trim($_POST['breeder_name'] ?? '');
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $password_confirm = $_POST['password_confirm'] ?? '';

    $error = null;

    // Validation des données
    if (!$breeder_name || !$name || !$email || !$password) {
        $error = "Tous les champs sont obligatoires.";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = "Format d'email invalide.";
    } elseif ($password !== $password_confirm) {
        $error = "Les mots de passe ne correspondent pas.";
    } elseif (strlen($password) < 8) {
        $error = "Le mot de passe doit faire au moins 8 caractères.";
    }

    if (!$error) {
        try {
            // Vérifier si l'email existe déjà dans le système
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
            $stmt->execute(['email' => $email]);
            if ($stmt->fetch()) {
                $error = "Cet email est déjà utilisé. Veuillez vous connecter.";
            } else {
                // DÉBUT DE LA TRANSACTION : Indispensable pour l'intégrité des données
                $pdo->beginTransaction();

                // 1. Créer le compte de l'élevage et récupérer son ID (PostgreSQL utilise RETURNING id)
                $stmt = $pdo->prepare('INSERT INTO breeder (name) VALUES (:name) RETURNING id');
                $stmt->execute(['name' => $breeder_name]);
                $breeder_id = $stmt->fetchColumn();

                // 2. Créer l'utilisateur avec le rôle administrateur de cet élevage
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare('INSERT INTO users (breeder_id, name, email, password_hash, role) VALUES (:bid, :name, :email, :hash, \'admin\') RETURNING id');
                $stmt->execute([
                    'bid' => $breeder_id,
                    'name' => $name,
                    'email' => $email,
                    'hash' => $hash
                ]);
                $user_id = $stmt->fetchColumn();

                // Validation définitive de la transaction
                $pdo->commit();

                // 3. Connecter l'utilisateur automatiquement après inscription
                $_SESSION['user'] = [
                    'id' => (int)$user_id,
                    'breeder_id' => (int)$breeder_id,
                    'name' => $name,
                    'email' => $email,
                    'role' => 'admin',
                ];
                
                header('Location: /?page=dashboard');
                exit;
            }
        } catch (Exception $e) {
            // En cas de crash, on annule les écritures partielles
            $pdo->rollBack();
            $error = "Une erreur technique est survenue lors de l'inscription.";
        }
    }
}
?>
<section class="login-card">
    <h1>Créer un compte</h1>
    <p>Démarrez la gestion de votre élevage haut de gamme.</p>
    
    <?php if (!empty($error)): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
    
    <form method="post">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        
        <label>Nom de l'élevage
            <input name="breeder_name" required value="<?= e($_POST['breeder_name'] ?? '') ?>" placeholder="Ex: Élevage du Val d'Or">
        </label>
        
        <label>Votre prénom et nom
            <input name="name" required value="<?= e($_POST['name'] ?? '') ?>" placeholder="Jean Dupont">
        </label>
        
        <label>Email
            <input name="email" type="email" required value="<?= e($_POST['email'] ?? '') ?>">
        </label>
        
        <label>Mot de passe
            <input name="password" type="password" required>
        </label>
        
        <label>Confirmer le mot de passe
            <input name="password_confirm" type="password" required>
        </label>
        
        <button>S'inscrire</button>
    </form>
    
    <p style="text-align:center; margin-top:18px; font-size:14px;">
        <a href="/?page=login" style="color:var(--bronze); text-decoration:none;">Déjà un compte ? Se connecter</a>
    </p>
</section>