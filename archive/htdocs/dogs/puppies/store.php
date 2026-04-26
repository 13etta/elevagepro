<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';

$id          = $_POST['id'] ?? null;
$name        = $_POST['name'] ?? null;
$chip_number = $_POST['chip_number'] ?? null;
$sex         = $_POST['sex'] ?? null;
$color       = $_POST['color'] ?? null;
$birth_date  = $_POST['birth_date'] ?? null; // ✅ nouvelle donnée
$status      = $_POST['status'] ?? 'Actif';  // ✅ correspond aux ENUM de ta BDD
$sale_price  = $_POST['sale_price'] ?? null;
$litter_id   = $_POST['litter_id'] ?? null;
$notes       = $_POST['notes'] ?? '';

if (!$name || !$sex || !$litter_id) {
    die("Erreur : le nom, le sexe et la portée sont obligatoires.");
}

if ($id) {
    // ✅ Mise à jour
    $stmt = $pdo->prepare("
        UPDATE puppies
        SET name = ?, chip_number = ?, sex = ?, color = ?, birth_date = ?, status = ?, sale_price = ?, litter_id = ?, notes = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $name,
        $chip_number,
        $sex,
        $color,
        $birth_date ?: null,
        $status,
        $sale_price ?: null,
        $litter_id,
        $notes,
        $id
    ]);
} else {
    // ✅ Insertion
    $stmt = $pdo->prepare("
        INSERT INTO puppies (name, chip_number, sex, color, birth_date, status, sale_price, litter_id, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $name,
        $chip_number,
        $sex,
        $color,
        $birth_date ?: null,
        $status,
        $sale_price ?: null,
        $litter_id,
        $notes
    ]);
}

// Redirection vers la liste
header("Location: /dogs/puppies/list.php");
exit;
