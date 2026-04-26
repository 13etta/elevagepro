<?php
require '../includes/config.php'; // Connexion PDO

$message = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email']);
    $new_password = $_POST['new_password'];

    if (!empty($email) && !empty($new_password)) {
        // Hash sécurisé du nouveau mot de passe
        $hashed = password_hash($new_password, PASSWORD_DEFAULT);

        // Mise à jour en base
        $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
        $stmt->execute([$hashed, $email]);

        if ($stmt->rowCount() > 0) {
            $message = "✅ Mot de passe mis à jour pour $email.";
        } else {
            $message = "⚠️ Utilisateur non trouvé.";
        }
    } else {
        $message = "⚠️ Veuillez remplir tous les champs.";
    }
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Réinitialiser le mot de passe</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex items-center justify-center h-screen">

  <div class="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
    <h1 class="text-2xl font-bold text-gray-800 mb-6">🔑 Réinitialiser le mot de passe</h1>

    <?php if ($message): ?>
      <div class="mb-4 p-3 rounded bg-gray-100 text-gray-800">
        <?= htmlspecialchars($message) ?>
      </div>
    <?php endif; ?>

    <form method="POST" class="space-y-4">
      <div>
        <label class="block text-gray-700 mb-1">Email de l'utilisateur</label>
        <input type="email" name="email" class="w-full border rounded px-3 py-2" required>
      </div>

      <div>
        <label class="block text-gray-700 mb-1">Nouveau mot de passe</label>
        <input type="password" name="new_password" class="w-full border rounded px-3 py-2" required>
      </div>

      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg">
        Réinitialiser
      </button>
    </form>
  </div>

</body>
</html>
