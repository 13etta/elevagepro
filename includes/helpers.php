<?php
/**
* includes/helpers.php
*/
function db(): PDO {
global $pdo;
return $pdo;
}
function e($string): string {
return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}
function redirect($url) {
header("Location: $url");
exit;
}
function breeder_id(): int {
return $_SESSION['breeder_id'] ?? 0;
}
function post_value($key, $default = null) {
return $_POST[$key] ?? $default;
}
/**
* Génère les options d'un select pour les chiens avec filtre
optionnel
*/
function dogs_options(?int $selected = null, ?string $filterSex =
null): string
{
$sql = 'SELECT id, name FROM dogs WHERE breeder_id = :bid';

$params = ['bid' => breeder_id()];
if ($filterSex) {
$sql .= ' AND sex = :sex';
$params['sex'] = $filterSex;
}
$sql .= ' ORDER BY name';
$stmt = db()->prepare($sql);
$stmt->execute($params);
$html = '<option value="">—</option>';
while ($dog = $stmt->fetch()) {
$sel = ((int)$dog['id'] === (int)$selected) ? ' selected' :

'';

$html .= '<option value="' . (int)$dog['id'] . '"' . $sel .

'>' . e($dog['name']) . '</option>';
}
return $html;
}
function count_table($table): int {
$stmt = db()->prepare("SELECT COUNT(*) FROM $table WHERE
breeder_id = :bid");
$stmt->execute(['bid' => breeder_id()]);
return (int)$stmt->fetchColumn();
}
function flash() {
if (isset($_SESSION['flash'])) {
echo '<div class="alert">' . e($_SESSION['flash']) . '</div>';
unset($_SESSION['flash']);
}
}