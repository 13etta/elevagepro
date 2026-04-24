<?php
require_once '../includes/helpers.php';
require_once '../includes/layout.php';
require_login();

// Récupération des rappels avec jointure sur les chiens
$due = db()->prepare("SELECT r.*, d.name AS dog_name

FROM reminders r
LEFT JOIN dogs d ON d.id = r.dog_id
WHERE r.breeder_id = :bid
AND r.due_date <= CURRENT_DATE + INTERVAL '30

days'

ORDER BY r.due_date ASC LIMIT 8");

$due->execute(['bid' => breeder_id()]);
$reminders = $due->fetchAll();
render_header('Tableau de bord');
flash();
?>
<section class="dashboard-grid">
<div class="stat-card">
<h3>Chiens</h3>
<p class="number"><?= count_table('dogs') ?></p>
</div>
<div class="stat-card">
<h3>Portées</h3>
<p class="number"><?= count_table('litters') ?></p>
</div>
<div class="stat-card">
<h3>Chiots disponibles</h3>
<p class="number"><?= count_table('puppies') ?></p>
</div>
<div class="stat-card">
<h3>Ventes</h3>
<p class="number"><?= count_table('sales') ?></p>
</div>
</section>
<section class="reminders-section">
<h2>Prochains rappels</h2>
<table>
<thead>
<tr>
<th>Date</th>
<th>Sujet</th>
<th>Cible</th>
</tr>
</thead>
<tbody>
<?php foreach ($reminders as $r): ?>
<tr>
<td><?= date('d/m/Y', strtotime($r['due_date']))

?></td>

<td><?= e($r['title']) ?></td>
<td><?= $r['dog_name'] ? e($r['dog_name']) : 'Élevage'

?></td>

</tr>
<?php endforeach; ?>
</tbody>
</table>
</section>
<?php render_footer(); ?>