<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: /dogs/soins/list.php");
    exit;
}

$id         = $_POST['id'] ?? null;
$dog_id     = $_POST['dog_id'] ?? '';
$type       = $_POST['type'] ?? '';
$name       = $_POST['name'] ?? '';
$date_admin = $_POST['date_admin'] ?? null;
$next_due   = $_POST['next_due'] ?? null;
$notes      = $_POST['notes'] ?? '';

// Validation simple
if (empty($dog_id) || empty($type) || empty($name) || empty($date_admin)) {
    flash('danger', 'Veuillez renseigner au minimum le chien, le type, le produit et la date d\'administration.');
    header("Location: /dogs/soins/form.php" . ($id ? "?id=".$id : ""));
    exit;
}

if ($id) {
    // update
    $stmt = $pdo->prepare("UPDATE soins SET dog_id=?, type=?, name=?, date_admin=?, next_due=?, notes=? WHERE id=?");
    $stmt->execute([$dog_id, $type, $name, $date_admin, $next_due, $notes, $id]);
    flash('success', 'Soin modifié avec succès');
} else {
    // insert
    $stmt = $pdo->prepare("INSERT INTO soins (dog_id, type, name, date_admin, next_due, notes) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$dog_id, $type, $name, $date_admin, $next_due, $notes]);
    flash('success', 'Soin ajouté avec succès');
}

header("Location: /dogs/soins/list.php");
exit;
