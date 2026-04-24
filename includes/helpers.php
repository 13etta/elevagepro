<?php
require_once __DIR__ . '/layout.php';

function dogs_options(?int $selected = null): string
{
    $stmt = db()->prepare('SELECT id, name FROM dogs WHERE breeder_id = :bid ORDER BY name');
    $stmt->execute(['bid' => breeder_id()]);
    $html = '<option value="">—</option>';
    foreach ($stmt as $dog) {
        $sel = ((int)$dog['id'] === (int)$selected) ? ' selected' : '';
        $html .= '<option value="' . (int)$dog['id'] . '"' . $sel . '>' . e($dog['name']) . '</option>';
    }
    return $html;
}

function count_table(string $table): int
{
    $allowed = ['dogs','puppies','litters','sales','reminders','soins','weights','disinfections','health_protocols'];
    if (!in_array($table, $allowed, true)) return 0;
    $stmt = db()->prepare("SELECT COUNT(*) FROM {$table} WHERE breeder_id = :bid");
    $stmt->execute(['bid' => breeder_id()]);
    return (int)$stmt->fetchColumn();
}

function post_value(string $key, $default = null)
{
    return $_POST[$key] ?? $default;
}
