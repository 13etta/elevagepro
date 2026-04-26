<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id          = $_POST['id'] ?? null;
$male_id     = $_POST['male_id'] ?? null;
$female_id   = $_POST['female_id'] ?? null;
$mating_date = $_POST['mating_date'] ?? null;
$method      = $_POST['method'] ?? 'Naturelle';
$place       = $_POST['place'] ?? null;
$notes       = $_POST['notes'] ?? null;

// Vérification obligatoire
if (!$male_id || !$female_id || !$mating_date) {
    die("⚠️ La date de la saillie, le mâle et la femelle sont obligatoires.");
}

try {
    if ($id) {
        // 🔄 Mise à jour
        $stmt = $pdo->prepare("UPDATE matings 
                               SET male_id=?, female_id=?, mating_date=?, method=?, place=?, notes=? 
                               WHERE id=?");
        $stmt->execute([
            $male_id,
            $female_id,
            $mating_date,
            $method,
            $place,
            $notes,
            $id
        ]);
    } else {
        // ➕ Insertion
        $stmt = $pdo->prepare("INSERT INTO matings (male_id, female_id, mating_date, method, place, notes) 
                               VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $male_id,
            $female_id,
            $mating_date,
            $method,
            $place,
            $notes
        ]);
    }
} catch (PDOException $e) {
    die("Erreur SQL : " . $e->getMessage());
}

// ✅ Retour à la liste
header("Location: list.php");
exit;
