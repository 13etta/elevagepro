<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id = $_GET['id'] ?? null;

if ($id) {
    $stmt = $pdo->prepare("DELETE FROM puppies WHERE id=?");
    $stmt->execute([$id]);
}

header("Location: /dogs/puppies/list.php");
exit;
?>
