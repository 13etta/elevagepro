<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id = $_POST['id'] ?? 0;

// Sécurisation des champs
$data = [
    'dog_id'   => !empty($_POST['dog_id']) ? (int)$_POST['dog_id'] : null,
    'start_at' => !empty($_POST['start_at']) ? $_POST['start_at'] : null,
    'end_at'   => !empty($_POST['end_at']) ? $_POST['end_at'] : null,
    'stage'    => $_POST['stage'] ?? null
];

// Vérification obligatoire
if (!$data['dog_id'] || !$data['start_at']) {
    die("⚠️ Chienne et date de début obligatoires.");
}

try {
    if ($id) {
        // 🔄 Mise à jour
        $sql = "UPDATE heats 
                SET dog_id = ?, start_at = ?, end_at = ?, stage = ?
                WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $data['dog_id'],
            $data['start_at'],
            $data['end_at'],
            $data['stage'],
            $id
        ]);
    } else {
        // ➕ Insertion
        $sql = "INSERT INTO heats (dog_id, start_at, end_at, stage) 
                VALUES (?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $data['dog_id'],
            $data['start_at'],
            $data['end_at'],
            $data['stage']
        ]);
    }
} catch (PDOException $e) {
    die("Erreur SQL : " . $e->getMessage());
}

// ✅ Redirection
header("Location: list.php");
exit;
