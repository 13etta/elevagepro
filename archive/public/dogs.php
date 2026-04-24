<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $stmt=db()->prepare('INSERT INTO dogs (breeder_id,name,sex,breed,lof,chip_number,id_scc,status,birth_date,pedigree,notes) VALUES (:bid,:name,:sex,:breed,:lof,:chip,:scc,:status,:birth,:pedigree,:notes)');
    $stmt->execute(['bid'=>breeder_id(),'name'=>post_value('name'),'sex'=>post_value('sex'),'breed'=>post_value('breed'),'lof'=>post_value('lof'),'chip'=>post_value('chip_number'),'scc'=>post_value('id_scc'),'status'=>post_value('status','actif'),'birth'=>post_value('birth_date') ?: null,'pedigree'=>post_value('pedigree'),'notes'=>post_value('notes')]);
    $_SESSION['flash']='Chien ajouté.'; redirect('/dogs.php');
}
$rows=db()->prepare('SELECT * FROM dogs WHERE breeder_id=:bid ORDER BY created_at DESC'); $rows->execute(['bid'=>breeder_id()]);
render_header('Chiens'); flash();
?>
<div class="card"><h2>Ajouter un chien</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><div class="form-grid"><label>Nom<input name="name" required></label><label>Sexe<select name="sex"><option>Mâle</option><option>Femelle</option></select></label><label>Race<input name="breed" placeholder="Setter anglais"></label><label>LOF<input name="lof"></label><label>Puce<input name="chip_number"></label><label>ID SCC<input name="id_scc"></label><label>Statut<input name="status" value="actif"></label><label>Naissance<input type="date" name="birth_date"></label><label>Pedigree<textarea name="pedigree"></textarea></label></div><label>Notes<textarea name="notes"></textarea></label><div class="actions"><button class="btn">Enregistrer</button></div></form></div>
<div class="card" style="margin-top:16px"><h2>Cheptel</h2><table><tr><th>Nom</th><th>Sexe</th><th>Race</th><th>LOF</th><th>Puce</th><th>Statut</th></tr><?php foreach($rows as $d): ?><tr><td><?= e($d['name']) ?></td><td><?= e($d['sex']) ?></td><td><?= e($d['breed']) ?></td><td><?= e($d['lof']) ?></td><td><?= e($d['chip_number']) ?></td><td><?= e($d['status']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
