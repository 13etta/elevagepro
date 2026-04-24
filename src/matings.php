<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

// Récupération de l'ID en cascade si présent dans l'URL
$preselected_female = $_GET['female_id'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    insert_row($pdo, 'matings', [
        'breeder_id'  => $bid,
        'male_id'     => $_POST['male_id'] ?: null,
        'female_id'   => $_POST['female_id'] ?: null,
        'mating_date' => $_POST['mating_date'] ?: null,
        'method'      => $_POST['method'],
        'place'       => $_POST['place'],
        'notes'       => $_POST['notes']
    ]);
    header('Location: /?page=matings'); 
    exit;
} 

$rows = list_rows($pdo, 'matings', $bid); 
$dogs = list_rows($pdo, 'dogs', $bid);
?>

<header class="hero"><h1>Saillies</h1><p>Historique des accouplements.</p></header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <select name="male_id" required>
            <option value="">-- Mâle --</option>
            <?php foreach($dogs as $d): if($d['sex'] === 'Mâle') : ?>
                <option value="<?= $d['id'] ?>"><?= e($d['name']) ?></option>
            <?php endif; endforeach; ?>
        </select>

        <select name="female_id" required>
            <option value="">-- Femelle --</option>
            <?php foreach($dogs as $d): if($d['sex'] === 'Femelle') : ?>
                <option value="<?= $d['id'] ?>" <?= $preselected_female == $d['id'] ? 'selected' : '' ?>>
                    <?= e($d['name']) ?>
                </option>
            <?php endif; endforeach; ?>
        </select>

        <input type="date" name="mating_date" required>
        <input name="method" placeholder="Méthode (Naturelle, IA...)">
        <input name="place" placeholder="Lieu">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button>Enregistrer la saillie</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead>
            <tr>
                <th>Mâle</th>
                <th>Femelle</th>
                <th>Date</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach($rows as $r): ?>
            <tr>
                <td><?=e($r['male_id'])?></td>
                <td><?=e($r['female_id'])?></td>
                <td><?=e($r['mating_date'] ?: $r['date'])?></td>
                <td>
                    <a href="/?page=pregnancies&mating_id=<?= $r['id'] ?>&female_id=<?= $r['female_id'] ?>" class="button-small">Gestation ?</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>