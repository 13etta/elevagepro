<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id            = $_POST['id'] ?? null;
$mating_id     = !empty($_POST['mating_id']) ? (int)$_POST['mating_id'] : null;
$female_id     = $_POST['female_id'] ?? null;
$start_date    = $_POST['start_date'] ?? null;
$expected_date = $_POST['expected_date'] ?? null;
$due_date      = $_POST['due_date'] ?? null;
$result        = $_POST['result'] ?? 'En cours';
$notes         = $_POST['notes'] ?? '';

// Vérification minimum
if (!$female_id || !$start_date) {
    die("Erreur : la femelle et la date de début sont obligatoires.");
}

// Sécurisation des valeurs pour ENUM
$valid_results = ['En cours', 'Réussie', 'Échec'];
if (!in_array($result, $valid_results)) {
    $result = 'En cours';
}

if ($id) {
    // 🔄 Mise à jour
    $stmt = $pdo->prepare("
        UPDATE pregnancies 
        SET mating_id = ?, female_id = ?, start_date = ?, expected_date = ?, due_date = ?, result = ?, notes = ?
        WHERE id = ?
    ");
    $stmt->execute([$mating_id, $female_id, $start_date, $expected_date, $due_date, $result, $notes, $id]);
} else {
    // ➕ Insertion
    $stmt = $pdo->prepare("
        INSERT INTO pregnancies (mating_id, female_id, start_date, expected_date, due_date, result, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$mating_id, $female_id, $start_date, $expected_date, $due_date, $result, $notes]);
}

// ✅ Redirection
header("Location: /dogs/pregnancies/list.php");
exit;
