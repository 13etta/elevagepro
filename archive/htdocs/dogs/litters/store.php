<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id            = $_POST['id'] ?? null;
$mating_id     = $_POST['mating_id'] ?? null;
$birth_date    = $_POST['birth_date'] ?? null;
$puppies_count = $_POST['puppies_count'] ?? 0;
$notes         = $_POST['notes'] ?? '';

if (!$mating_id || !$birth_date) {
    die("Erreur : la saillie et la date de mise bas sont obligatoires.");
}

if ($id) {
    // Mise à jour
    $stmt = $pdo->prepare("
        UPDATE litters 
        SET mating_id = ?, birth_date = ?, puppies_count = ?, notes = ?
        WHERE id = ?
    ");
    $stmt->execute([$mating_id, $birth_date, $puppies_count, $notes, $id]);
} else {
    // Insertion
    $stmt = $pdo->prepare("
        INSERT INTO litters (mating_id, birth_date, puppies_count, notes)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$mating_id, $birth_date, $puppies_count, $notes]);
}

header("Location: list.php");
exit;
