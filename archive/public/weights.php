<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    db()->prepare('INSERT INTO weights (breeder_id,dog_id,weight_date,weight_kg,body_condition,notes) VALUES (:bid,:dog,:date,:kg,:bc,:notes)')->execute(['bid'=>breeder_id(),'dog'=>post_value('dog_id'),'date'=>post_value('weight_date'),'kg'=>post_value('weight_kg'),'bc'=>post_value('body_condition'),'notes'=>post_value('notes')]);
    $_SESSION['flash']='Poids enregistré.'; redirect('/weights.php?dog_id='.(int)post_value('dog_id'));
}
$selected=(int)($_GET['dog_id'] ?? 0);
$rows=[]; $json='[]';
if($selected){$stmt=db()->prepare('SELECT w.*, d.name dog_name FROM weights w JOIN dogs d ON d.id=w.dog_id WHERE w.breeder_id=:bid AND w.dog_id=:dog ORDER BY w.weight_date ASC');$stmt->execute(['bid'=>breeder_id(),'dog'=>$selected]);$rows=$stmt->fetchAll();$json=json_encode($rows, JSON_THROW_ON_ERROR);} 
render_header('Suivi du poids'); flash();
?>
<div class="card"><h2>Nouvelle pesée</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><div class="form-grid"><label>Chien<select name="dog_id" required><?= dogs_options($selected) ?></select></label><label>Date<input type="date" name="weight_date" required></label><label>Poids kg<input type="number" step="0.01" name="weight_kg" required></label><label>État corporel<input name="body_condition" placeholder="sec, parfait, lourd..."></label><label>Notes<textarea name="notes"></textarea></label></div><div class="actions"><button class="btn">Enregistrer</button><a class="btn secondary" href="/weights.php?dog_id=<?= $selected ?>">Afficher courbe</a></div></form></div>
<div class="card" style="margin-top:16px"><h2>Courbe</h2><canvas id="weightChart" class="chart"></canvas><script>window.addEventListener('load',()=>drawWeightChart('weightChart',<?= $json ?>));</script><table><tr><th>Date</th><th>Chien</th><th>Poids</th><th>État</th><th>Notes</th></tr><?php foreach($rows as $r): ?><tr><td><?= e($r['weight_date']) ?></td><td><?= e($r['dog_name']) ?></td><td><?= e($r['weight_kg']) ?> kg</td><td><?= e($r['body_condition']) ?></td><td><?= e($r['notes']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
