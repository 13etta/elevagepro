<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

// Vérifie l'ID
$id = $_GET['id'] ?? null;
if (!$id || !is_numeric($id)) {
    header("Location: /dogs/soins/list.php");
    exit;
}

// Vérifie que le soin existe
$stmt = $pdo->prepare("SELECT id FROM soins WHERE id = ?");
$stmt->execute([$id]);
$soin = $stmt->fetch();

if (!$soin) {
    header("Location: /dogs/soins/list.php");
    exit;
}

// Supprime le soin
$stmt = $pdo->prepare("DELETE FROM soins WHERE id = ?");
$stmt->execute([$id]);

// Retour à la liste
header("Location: /dogs/soins/list.php");
exit;
