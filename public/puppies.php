<?php
require_once '../includes/helpers.php';
require_login(); csrf_check();
if ($_SERVER['REQUEST_METHOD']==='POST') {
    if(post_value('kind')==='litter'){
        db()->prepare('INSERT INTO litters (breeder_id,female_id,birth_date,status,nb_puppies,puppies_count,notes) VALUES (:bid,:female,:birth,:status,:nb,:nb,:notes)')->execute(['bid'=>breeder_id(),'female'=>post_value('female_id') ?: null,'birth'=>post_value('birth_date') ?: null,'status'=>post_value('status','née'),'nb'=>post_value('nb_puppies') ?: 0,'notes'=>post_value('notes')]);
    } else {
        db()->prepare('INSERT INTO puppies (breeder_id,litter_id,name,sex,birth_date,color,chip_number,sale_price,status,notes) VALUES (:bid,:litter,:name,:sex,:birth,:color,:chip,:price,:status,:notes)')->execute(['bid'=>breeder_id(),'litter'=>post_value('litter_id') ?: null,'name'=>post_value('name'),'sex'=>post_value('sex'),'birth'=>post_value('birth_date') ?: null,'color'=>post_value('color'),'chip'=>post_value('chip_number'),'price'=>post_value('sale_price') ?: null,'status'=>post_value('status','disponible'),'notes'=>post_value('notes')]);
    }
    $_SESSION['flash']='Enregistrement ajouté.'; redirect('/puppies.php');
}
$litters=db()->prepare('SELECT l.*, d.name female FROM litters l LEFT JOIN dogs d ON d.id=l.female_id WHERE l.breeder_id=:bid ORDER BY l.birth_date DESC NULLS LAST');$litters->execute(['bid'=>breeder_id()]);$littersRows=$litters->fetchAll();
$puppies=db()->prepare('SELECT p.*, l.birth_date litter_birth FROM puppies p LEFT JOIN litters l ON l.id=p.litter_id WHERE p.breeder_id=:bid ORDER BY p.created_at DESC');$puppies->execute(['bid'=>breeder_id()]);
render_header('Portées et chiots'); flash();
?>
<section class="grid2"><div class="card"><h2>Créer une portée</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><input type="hidden" name="kind" value="litter"><label>Femelle<select name="female_id"><?= dogs_options() ?></select></label><label>Date naissance<input type="date" name="birth_date"></label><label>Nombre chiots<input type="number" name="nb_puppies"></label><label>Statut<input name="status" value="née"></label><label>Notes<textarea name="notes"></textarea></label><button class="btn">Créer</button></form></div><div class="card"><h2>Ajouter un chiot</h2><form method="post"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><label>Portée<select name="litter_id"><option value="">—</option><?php foreach($littersRows as $l): ?><option value="<?= (int)$l['id'] ?>"><?= e(($l['female']?:'Portée').' · '.$l['birth_date']) ?></option><?php endforeach; ?></select></label><label>Nom<input name="name"></label><label>Sexe<select name="sex"><option>Mâle</option><option>Femelle</option></select></label><label>Naissance<input type="date" name="birth_date"></label><label>Couleur<input name="color"></label><label>Puce<input name="chip_number"></label><label>Prix<input type="number" step="0.01" name="sale_price"></label><label>Statut<input name="status" value="disponible"></label><button class="btn">Ajouter</button></form></div></section>
<div class="card" style="margin-top:16px"><h2>Chiots</h2><table><tr><th>Nom</th><th>Sexe</th><th>Naissance</th><th>Couleur</th><th>Puce</th><th>Prix</th><th>Statut</th></tr><?php foreach($puppies as $p): ?><tr><td><?= e($p['name']) ?></td><td><?= e($p['sex']) ?></td><td><?= e($p['birth_date']) ?></td><td><?= e($p['color']) ?></td><td><?= e($p['chip_number']) ?></td><td><?= e($p['sale_price']) ?></td><td><?= e($p['status']) ?></td></tr><?php endforeach; ?></table></div>
<?php render_footer(); ?>
