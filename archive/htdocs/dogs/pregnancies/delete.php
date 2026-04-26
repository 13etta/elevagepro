<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id = $_GET['id'] ?? null;
if (!$id || !is_numeric($id)) {
    header("Location: /dogs/pregnancies/list.php");
    exit;
}

$stmt = $pdo->prepare("SELECT id FROM pregnancies WHERE id=?");
$stmt->execute([$id]);
$preg = $stmt->fetch();

if (!$preg) {
    header("Location: /dogs/pregnancies/list.php");
    exit;
}

$stmt = $pdo->prepare("DELETE FROM pregnancies WHERE id=?");
$stmt->execute([$id]);

header("Location: /dogs/pregnancies/list.php");
exit;
?>
