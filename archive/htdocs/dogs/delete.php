<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/config.php';

// Vérifie que l'id est fourni
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id > 0) {
    try {
        // Vérifier que le chien existe
        $stmt = $pdo->prepare("SELECT id, name FROM dogs WHERE id = ?");
        $stmt->execute([$id]);
        $dog = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($dog) {
            // Suppression du chien
            $delete = $pdo->prepare("DELETE FROM dogs WHERE id = ?");
            $delete->execute([$id]);
        }
    } catch (PDOException $e) {
        die("Erreur SQL : " . $e->getMessage());
    }
}

// Redirection après suppression
header("Location: list.php");
exit;
