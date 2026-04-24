<?php
require_once __DIR__ . '/config.php'; // Charge la base de données
require_once __DIR__ . '/layout.php'; // Charge l'auth et le layout

/**
 * Redirection simplifiée
 */
function redirect(string $url): void {
    header("Location: $url");
    exit;
}

/**
 * Raccourci pour la vérification CSRF
 */
function csrf_check(): void {
    verify_csrf();
}

/**
 * Génère les options du select pour les chiens
 */
function dogs_options(?int $selected = null): string {
    $stmt = db()->prepare('SELECT id, name FROM dogs WHERE breeder_id = :bid ORDER BY name');
    $stmt->execute(['bid' => breeder_id()]);
    $html = '<option value="">—</option>';
    foreach ($stmt as $dog) {
        $sel = ((int)$dog['id'] === (int)$selected) ? ' selected' : '';
        $html .= '<option value="' . (int)$dog['id'] . '"' . $sel . '>' . e($dog['name']) . '</option>';
    }
    return $html;
}

/**
 * Compte les entrées d'une table pour le dashboard
 */
function count_table(string $table): int {
    $allowed = ['dogs','puppies','litters','sales','reminders','soins','weights','disinfections'];
    if (!in_array($table, $allowed, true)) return 0;
    $stmt = db()->prepare("SELECT COUNT(*) FROM {$table} WHERE breeder_id = :bid");
    $stmt->execute(['bid' => breeder_id()]);
    return (int)$stmt->fetchColumn();
}

function post_value(string $key, $default = null) {
    return $_POST[$key] ?? $default;
}