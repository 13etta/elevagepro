<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id = $_GET['id'] ?? null;

if ($id) {
    $stmt = $pdo->prepare("DELETE FROM heats WHERE id = ?");
    $stmt->execute([$id]);
}

// Retour à la liste
header("Location: list.php");
exit;
