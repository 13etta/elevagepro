<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id = $_GET['id'] ?? null;
if (!$id || !is_numeric($id)) {
    header("Location: /dogs/matings/list.php");
    exit;
}

$stmt = $pdo->prepare("SELECT id FROM matings WHERE id=?");
$stmt->execute([$id]);
$mating = $stmt->fetch();

if (!$mating) {
    header("Location: /dogs/matings/list.php");
    exit;
}

$stmt = $pdo->prepare("DELETE FROM matings WHERE id=?");
$stmt->execute([$id]);

header("Location: /dogs/matings/list.php");
exit;
?>
