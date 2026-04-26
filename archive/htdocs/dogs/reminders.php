<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/config.php';
require __DIR__ . '/../includes/header.php';

$today = new DateTime();
$month = $today->format('m');

$stmt = $pdo->query("SELECT id, name, birth_date FROM dogs WHERE birth_date IS NOT NULL");
$dogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

$anniversaires = [];
foreach ($dogs as $dog) {
    $d = new DateTime($dog['birth_date']);
    if ($d->format('m') === $month) {
        $age = $today->format('Y') - $d->format('Y');
        $anniversaires[] = [
            'name' => $dog['name'],
            'date' => $d->format('d/m'),
            'age'  => $age
        ];
    }
}
?>

<h2>Rappels du mois</h2>

<h4>Anniversaires</h4>
<ul>
  <?php foreach ($anniversaires as $a): ?>
    <li><?= htmlspecialchars($a['name']); ?> → <?= $a['date']; ?> (<?= $a['age']; ?> ans)</li>
  <?php endforeach; ?>
  <?php if (empty($anniversaires)): ?>
    <li>Aucun anniversaire ce mois-ci.</li>
  <?php endif; ?>
</ul>

<?php require __DIR__ . '/../includes/footer.php'; ?>
