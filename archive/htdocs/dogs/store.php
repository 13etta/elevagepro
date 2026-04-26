<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/config.php';

$id = $_POST['id'] ?? 0;

// Sécurité : récupération des champs
$data = [
    'name'       => trim($_POST['name'] ?? ''),
    'sex'        => $_POST['sex'] ?? '',
    'breed'      => $_POST['breed'] ?? '',
    'lof'        => $_POST['lof'] ?? '',
    'chip'       => $_POST['chip'] ?? '',
    'id_scc'     => $_POST['id_scc'] ?? '',
    'birth_date' => !empty($_POST['birth_date']) ? $_POST['birth_date'] : null,
    'pedigree'   => $_POST['pedigree'] ?? '',
    'notes'      => $_POST['notes'] ?? '',
    'status'     => $_POST['status'] ?? 'Actif',
    'father_id'  => !empty($_POST['father_id']) ? (int)$_POST['father_id'] : null,
    'mother_id'  => !empty($_POST['mother_id']) ? (int)$_POST['mother_id'] : null
];

if ($id) {
    // UPDATE
    $sql = "UPDATE dogs 
            SET name=?, sex=?, breed=?, lof=?, chip=?, id_scc=?, birth_date=?, pedigree=?, notes=?, status=?, father_id=?, mother_id=?
            WHERE id=?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['name'], $data['sex'], $data['breed'], $data['lof'], $data['chip'],
        $data['id_scc'], $data['birth_date'], $data['pedigree'], $data['notes'],
        $data['status'], $data['father_id'], $data['mother_id'], $id
    ]);
} else {
    // INSERT
    $sql = "INSERT INTO dogs (name, sex, breed, lof, chip, id_scc, birth_date, pedigree, notes, status, father_id, mother_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['name'], $data['sex'], $data['breed'], $data['lof'], $data['chip'],
        $data['id_scc'], $data['birth_date'], $data['pedigree'], $data['notes'],
        $data['status'], $data['father_id'], $data['mother_id']
    ]);
}

// Redirection
header("Location: list.php");
exit;
