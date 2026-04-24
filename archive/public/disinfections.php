<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    db()->prepare('INSERT INTO disinfections (breeder_id,zone,product,disinfection_date,next_due,protocol,notes) VALUES (:bid,:zone,:product,:date,:next,:protocol,:notes)')->execute(['bid'=>breeder_id(),'zone'=>post_value('zone'),'product'=>post_value('product'),'date'=>post_value('disinfection_date'),'next'=>post_value('next_due') ?: null,'protocol'=>post_value('protocol'),'notes'=>post_value('notes')]);
    if (post_value('next_due')) db()->prepare('INSERT INTO reminders (breeder_id,title,due_date,type,notes) VALUES (:bid,:t,:d,:type,:notes)')->execute(['bid'=>breeder_id(),'t'=>'Désinfection '.post_value('zone'),'d'=>post_value('next_due'),'type'=>'Désinfection','notes'=>post_value('product')]);
    $_SESSION['flash']='Désinfection enregistrée.'; redirect('/disinfections.php');
}
$rows=db()->prepare('SELECT * FROM disinfections WHERE breeder_id=:bid ORDER BY disinfection_date DESC'); $rows->execute(['bid'=>breeder_id()]);
render_header('Désinfections'); flash();
?>
<div class="card"><h2>Traçabilité hygiène</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><div class="form-grid"><label>Zone<input name="zone" placeholder="Chenil, maternité, box..." required></label><label>Produit<input name="product"></label><label>Date<input type="date" name="disinfection_date" required></label><label>Prochain passage<input type="date" name="next_due"></label><label>Protocole<textarea name="protocol"></textarea></label><label>Notes<textarea name="notes"></textarea></label></div><div class="actions"><button class="btn">Enregistrer</button></div></form></div>
<div class="card" style="margin-top:16px"><table><tr><th>Date</th><th>Zone</th><th>Produit</th><th>Prochain</th><th>Protocole</th></tr><?php foreach($rows as $r): ?><tr><td><?= e($r['disinfection_date']) ?></td><td><?= e($r['zone']) ?></td><td><?= e($r['product']) ?></td><td><?= e($r['next_due']) ?></td><td><?= e($r['protocol']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
