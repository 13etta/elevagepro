<?php
require_once '../includes/helpers.php';
$user = require_login();
render_header('Tableau de bord'); flash();
$due = db()->prepare("SELECT r.*, d.name AS dog_name FROM reminders r LEFT JOIN dogs d ON d.id=r.dog_id WHERE r.breeder_id=:bid AND r.due_date <= CURRENT_DATE + INTERVAL '30 days' ORDER BY r.due_date ASC LIMIT 8");
$due->execute(['bid'=>breeder_id()]);
?>
<section class="grid">
  <div class="card"><div class="muted">Chiens</div><div class="kpi"><?= count_table('dogs') ?></div></div>
  <div class="card"><div class="muted">Chiots</div><div class="kpi"><?= count_table('puppies') ?></div></div>
  <div class="card"><div class="muted">Portées</div><div class="kpi"><?= count_table('litters') ?></div></div>
  <div class="card"><div class="muted">Rappels</div><div class="kpi"><?= count_table('reminders') ?></div></div>
</section>
<section class="grid2" style="margin-top:16px">
 <div class="card"><h2>Échéances à 30 jours</h2><table><tr><th>Date</th><th>Type</th><th>Action</th><th>Chien</th></tr><?php foreach($due as $r): ?><tr><td><?= e($r['due_date']) ?></td><td><?= e($r['type']) ?></td><td><?= e($r['title']) ?></td><td><?= e($r['dog_name']) ?></td></tr><?php endforeach; ?></table></div>
 <div class="card"><h2>Modules actifs</h2><p class="muted">Élevage, reproduction, ventes, vaccins, Milbemax, Bravecto, désinfections, courbes de poids et génération automatique de site web.</p><a class="btn" href="/site_builder.php">Configurer le site public</a></div>
</section>
<?php render_footer(); ?>
