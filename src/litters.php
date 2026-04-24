<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if($_SERVER['REQUEST_METHOD']==='POST'){
    insert_row($pdo,'litters',[
        'breeder_id'   => $bid,
        'pregnancy_id' => $_POST['pregnancy_id'] ?: null,
        'mating_id'    => $_POST['mating_id'] ?: null,
        'female_id'    => $_POST['female_id'] ?: null,
        'birth_date'   => $_POST['birth_date'] ?: null,
        'nb_puppies'   => $_POST['nb_puppies'] ?: 0,
        'status'       => $_POST['status'],
        'notes'        => $_POST['notes']
    ]); 
    header('Location: /?page=litters'); 
    exit;
} 

$rows = list_rows($pdo,'litters',$bid); 
?>

<header class="hero"><h1>Portées</h1><p>Registre des naissances.</p></header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <input name="female_id" placeholder="ID femelle" value="<?= e($_GET['female_id'] ?? '') ?>">
        <input name="pregnancy_id" placeholder="ID gestation" value="<?= e($_GET['pregnancy_id'] ?? '') ?>">
        <input name="mating_id" placeholder="ID saillie" value="<?= e($_GET['mating_id'] ?? '') ?>">
        <input type="date" name="birth_date" required>
        <input type="number" name="nb_puppies" placeholder="Nombre chiots" required>
        <input name="status" placeholder="Statut">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button>Ajouter la portée</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead><tr><th>Femelle</th><th>Naissance</th><th>Chiots</th><th>Action</th></tr></thead>
        <tbody>
            <?php foreach($rows as $r): ?>
            <tr>
                <td><?=e($r['female_id'])?></td>
                <td><?=e($r['birth_date'])?></td>
                <td><?=e($r['nb_puppies'] ?: $r['puppies_count'])?></td>
                <td>
                    <a href="/?page=puppies&litter_id=<?= $r['id'] ?>&birth_date=<?= $r['birth_date'] ?>" class="button-small">Ajouter les chiots</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>