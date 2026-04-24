<?php
require '../includes/config.php';

$stmt = $pdo->query("SELECT count(*) FROM users");
$count = $stmt->fetchColumn();

echo "Nombre d'utilisateurs en base : " . $count;

$stmt = $pdo->query("SELECT email FROM users");
while ($row = $stmt->fetch()) {
    echo "<br>Email présent : " . $row['email'];

}