<?php
require __DIR__ . '/../includes/config.php';

$email = "admin@example.com";   // Ton email de connexion
$name  = "Administrateur";      // Ton nom
$role  = "admin";               // Rôle
$password = "Test123";          // Ton mot de passe

$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)");
$stmt->execute([$name, $email, $hash, $role]);

echo "✅ Compte admin créé : $email / $password";
