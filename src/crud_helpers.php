<?php
function list_rows(PDO $pdo, string $table, int $bid): array {
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE breeder_id = :bid ORDER BY id DESC LIMIT 200");
    $stmt->execute(['bid' => $bid]);
    return $stmt->fetchAll();
}
function insert_row(PDO $pdo, string $table, array $data): void {
    $cols = array_keys($data);
    $sql = sprintf('INSERT INTO %s (%s) VALUES (%s)', $table, implode(',', $cols), ':' . implode(',:', $cols));
    $stmt = $pdo->prepare($sql);
    $stmt->execute($data);
}
function delete_row(PDO $pdo, string $table, int $id, int $bid): void {
    $stmt = $pdo->prepare("DELETE FROM {$table} WHERE id = :id AND breeder_id = :bid");
    $stmt->execute(['id'=>$id,'bid'=>$bid]);
}
