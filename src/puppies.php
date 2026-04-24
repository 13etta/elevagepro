<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if($_SERVER['REQUEST_METHOD']==='POST'){
    insert_row($pdo,'puppies',[
        'breeder_id'  => $bid,
        'litter_id'   => $_POST['litter_id'] ?: null,
        'name'        => $_POST['name'],
        'sex'         => $_POST['sex'],
        'birth_date'  => $_POST['birth_date'] ?: null,
        'chip_number' => $_POST['chip_number'],
        'color'       => $_POST['color'],
        'sale_price'  => $_POST['sale_price'] ?: null,
        'status'      => $_POST['status'],
        'is_sold'     => isset($_POST['is_sold']) ? 'true' : 'false',
        'notes'       => $_POST['notes']
    ]); 
    header('Location: /?page=puppies&litter_id='.$_POST['litter_id']); 
    exit;
} 

$rows = list_rows($pdo,'puppies',$bid); 
?>

<header class="hero"><h1>Chiots</h1><p>Suivi individuel.</p></header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <input name="litter_id" placeholder="ID portée" value="<?= e($_GET['litter_id'] ?? '') ?>" required>
        <input name="name" placeholder="Nom" required>
        <select name="sex"><option>Mâle</option><option>Femelle</option></select>
        <input type="date" name="birth_date" value="<?= e($_GET['birth_date'] ?? '') ?>">
        <input name="chip_number" placeholder="Puce">
        <input name="color" placeholder="Couleur">
        <input type="number" step="0.01" name="sale_price" placeholder="Prix">
        <input name="status" placeholder="Statut" value="Disponible">
        <label class="check"><input type="checkbox" name="is_sold"> Vendu</label>
        <textarea name="notes" placeholder="Notes"></textarea>
        <button>Ajouter le chiot</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead><tr><th>Nom</th><th>Sexe</th><th>Statut</th><th>Vendu</th></tr></thead>
        <tbody>
            <?php foreach($rows as $r): ?>
            <tr>
                <td><?=e($r['name'])?></td>
                <td><?=e($r['sex'])?></td>
                <td><?=e($r['status'])?></td>
                <td><?= $r['is_sold'] ? 'Oui' : 'Non' ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>