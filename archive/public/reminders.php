<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    db()->prepare('INSERT INTO reminders (breeder_id,title,due_date,type,dog_id,notes) VALUES (:bid,:title,:due,:type,:dog,:notes)')->execute(['bid'=>breeder_id(),'title'=>post_value('title'),'due'=>post_value('due_date'),'type'=>post_value('type'),'dog'=>post_value('dog_id') ?: null,'notes'=>post_value('notes')]);
    $_SESSION['flash']='Rappel ajouté.'; redirect('/reminders.php');
}
$rows=db()->prepare('SELECT r.*, d.name dog_name FROM reminders r LEFT JOIN dogs d ON d.id=r.dog_id WHERE r.breeder_id=:bid ORDER BY r.due_date ASC');$rows->execute(['bid'=>breeder_id()]);
render_header('Rappels'); flash();
?>
<div class="card"><h2>Ajouter un rappel</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><div class="form-grid"><label>Titre<input name="title" required></label><label>Date<input type="date" name="due_date" required></label><label>Type<input name="type" placeholder="Vaccin, vermifuge, désinfection..."></label><label>Chien<select name="dog_id"><?= dogs_options() ?></select></label><label>Notes<textarea name="notes"></textarea></label></div><button class="btn">Enregistrer</button></form></div>
<div class="card" style="margin-top:16px"><table><tr><th>Date</th><th>Type</th><th>Titre</th><th>Chien</th><th>Notes</th></tr><?php foreach($rows as $r): ?><tr><td><?= e($r['due_date']) ?></td><td><?= e($r['type']) ?></td><td><?= e($r['title']) ?></td><td><?= e($r['dog_name']) ?></td><td><?= e($r['notes']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
