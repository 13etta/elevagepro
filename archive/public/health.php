<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $stmt=db()->prepare('INSERT INTO health_protocols (breeder_id,dog_id,product,category,given_date,next_due,dose,notes) VALUES (:bid,:dog,:product,:category,:given,:next,:dose,:notes)');
    $stmt->execute(['bid'=>breeder_id(),'dog'=>post_value('dog_id') ?: null,'product'=>post_value('product'),'category'=>post_value('category'),'given'=>post_value('given_date'),'next'=>post_value('next_due') ?: null,'dose'=>post_value('dose'),'notes'=>post_value('notes')]);
    if (post_value('next_due')) db()->prepare('INSERT INTO reminders (breeder_id,title,due_date,type,dog_id,notes) VALUES (:bid,:t,:d,:type,:dog,:notes)')->execute(['bid'=>breeder_id(),'t'=>'Rappel '.post_value('product'),'d'=>post_value('next_due'),'type'=>post_value('category'),'dog'=>post_value('dog_id') ?: null,'notes'=>post_value('notes')]);
    $_SESSION['flash']='Suivi sanitaire ajouté.'; redirect('/health.php');
}
$rows=db()->prepare('SELECT h.*, d.name dog_name FROM health_protocols h LEFT JOIN dogs d ON d.id=h.dog_id WHERE h.breeder_id=:bid ORDER BY COALESCE(h.next_due,h.given_date) DESC'); $rows->execute(['bid'=>breeder_id()]);
render_header('Santé : vaccins, Milbemax, Bravecto'); flash();
?>
<div class="card"><h2>Ajouter un acte sanitaire</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><div class="form-grid"><label>Chien<select name="dog_id"><?= dogs_options() ?></select></label><label>Produit<input name="product" placeholder="Milbemax, Bravecto, CHPPiL..." required></label><label>Catégorie<select name="category"><option>Vaccin</option><option>Vermifuge</option><option>Antiparasitaire externe</option><option>Soin</option></select></label><label>Date donnée<input type="date" name="given_date" required></label><label>Prochain rappel<input type="date" name="next_due"></label><label>Dose<input name="dose"></label></div><label>Notes<textarea name="notes"></textarea></label><div class="actions"><button class="btn">Enregistrer</button></div></form></div>
<div class="card" style="margin-top:16px"><h2>Historique sanitaire</h2><table><tr><th>Chien</th><th>Catégorie</th><th>Produit</th><th>Date</th><th>Rappel</th><th>Dose</th></tr><?php foreach($rows as $r): ?><tr><td><?= e($r['dog_name']) ?></td><td><?= e($r['category']) ?></td><td><?= e($r['product']) ?></td><td><?= e($r['given_date']) ?></td><td><?= e($r['next_due']) ?></td><td><?= e($r['dose']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
