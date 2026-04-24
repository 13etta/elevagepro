<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $start_date = $_POST['start_date'] ?: null;
    $expected_date = $_POST['expected_date'] ?: null;
    $female_id = $_POST['female_id'] ?: null;

    if ($start_date && !$expected_date) {
        $date = new DateTime($start_date);
        $date->modify('+63 days');
        $expected_date = $date->format('Y-m-d');
    }

    insert_row($pdo, 'pregnancies', [
        'breeder_id'    => $bid,
        'mating_id'     => $_POST['mating_id'] ?: null,
        'female_id'     => $female_id,
        'start_date'    => $start_date,
        'expected_date' => $expected_date,
        'result'        => $_POST['result'],
        'notes'         => $_POST['notes']
    ]);

    if ($start_date && $female_id) {
        $echo_date = new DateTime($start_date);
        $echo_date->modify('+25 days');
        insert_row($pdo, 'reminders', [
            'breeder_id' => $bid,
            'title'      => 'Échographie de contrôle (Gestation)',
            'due_date'   => $echo_date->format('Y-m-d'),
            'type'       => 'Reproduction',
            'dog_id'     => $female_id,
            'notes'      => 'Généré automatiquement.'
        ]);
    }
    header('Location: /?page=pregnancies'); 
    exit;
} 

$rows = list_rows($pdo, 'pregnancies', $bid); 
$stmt = $pdo->prepare("SELECT id, name FROM dogs WHERE breeder_id = :bid AND (sex = 'Femelle' OR sex = 'femelle') ORDER BY name ASC");
$stmt->execute(['bid' => $bid]);
$females = $stmt->fetchAll();
?>

<header class="hero"><h1>Gestations</h1><p>Suivi et prévisions.</p></header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <select name="female_id" required>
            <option value="">-- Choisir une femelle --</option>
            <?php foreach($females as $f): ?>
                <option value="<?= $f['id'] ?>"><?= e($f['name']) ?></option>
            <?php endforeach; ?>
        </select>
        <input name="mating_id" placeholder="ID saillie" value="<?= e($_GET['mating_id'] ?? '') ?>">
        <input type="date" name="start_date" required>
        <input type="date" name="expected_date">
        <input name="result" placeholder="Résultat">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button>Ajouter</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead><tr><th>Femelle</th><th>Début</th><th>Terme prévu</th><th>Action</th></tr></thead>
        <tbody>
            <?php foreach($rows as $r): ?>
            <tr>
                <td><?=e($r['female_id'])?></td>
                <td><?=e($r['start_date'])?></td>
                <td><?=e($r['expected_date'] ?: $r['due_date'])?></td>
                <td>
                    <a href="/?page=litters&pregnancy_id=<?= $r['id'] ?>&mating_id=<?= $r['mating_id'] ?>&female_id=<?= $r['female_id'] ?>" class="button-small">Déclarer naissance</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>