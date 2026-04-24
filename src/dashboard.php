<?php
$bid = breeder_id();
function count_table(PDO $pdo, string $table, int $bid): int {
    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM {$table} WHERE breeder_id = :bid");
    $stmt->execute(['bid' => $bid]);
    return (int)$stmt->fetch()['c'];
}
$stats = [
    'Chiens' => count_table($pdo, 'dogs', $bid),
    'Chiots' => count_table($pdo, 'puppies', $bid),
    'Portées' => count_table($pdo, 'litters', $bid),
    'Rappels' => count_table($pdo, 'reminders', $bid),
];
$reminders = $pdo->prepare('SELECT * FROM reminders WHERE breeder_id = :bid ORDER BY due_date ASC LIMIT 8');
$reminders->execute(['bid' => $bid]);
?>
<header class="hero"><h1>Tableau de bord</h1><p>Vision synthétique de l’activité d’élevage.</p></header>
<section class="stats">
<?php foreach ($stats as $label => $value): ?>
    <article><strong><?= $value ?></strong><span><?= e($label) ?></span></article>
<?php endforeach; ?>
</section>
<section class="panel">
    <h2>Rappels à venir</h2>
    <table><thead><tr><th>Date</th><th>Titre</th><th>Type</th></tr></thead><tbody>
    <?php foreach ($reminders as $r): ?><tr><td><?= e($r['due_date']) ?></td><td><?= e($r['title']) ?></td><td><?= e($r['type']) ?></td></tr><?php endforeach; ?>
    </tbody></table>
</section>
