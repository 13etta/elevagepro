<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    insert_row($pdo, 'heats', [
        'breeder_id' => $bid,
        'female_id'  => $_POST['female_id'] ?: null,
        'start_date' => $_POST['start_date'] ?: null,
        'stage'      => $_POST['stage'],
        'notes'      => $_POST['notes']
    ]);
    header('Location: /?page=heats'); 
    exit;
} 

$rows = list_rows($pdo, 'heats', $bid); 
$stmt = $pdo->prepare("SELECT id, name FROM dogs WHERE breeder_id = :bid AND (sex = 'Femelle' OR sex = 'femelle') ORDER BY name ASC");
$stmt->execute(['bid' => $bid]);
$females = $stmt->fetchAll();
?>

<header class="hero"><h1>Chaleurs</h1><p>Suivi des cycles et calcul de fertilité.</p></header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        <select name="female_id" required>
            <option value="">-- Choisir une femelle --</option>
            <?php foreach($females as $f): ?>
                <option value="<?= $f['id'] ?>"><?= e($f['name']) ?></option>
            <?php endforeach; ?>
        </select>
        <input type="date" name="start_date" required>
        <input name="stage" placeholder="Phase (ex: Proestrus)">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button>Enregistrer le début du cycle</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead>
            <tr>
                <th>Femelle</th>
                <th>Début</th>
                <th>Fenêtre de Saillie (J11 - J15)</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach($rows as $r): 
                $win_start = ""; $win_end = "";
                if ($r['start_date']) {
                    $d = new DateTime($r['start_date']);
                    $win_start = (clone $d)->modify('+11 days')->format('d/m');
                    $win_end = (clone $d)->modify('+15 days')->format('d/m');
                }
            ?>
            <tr>
                <td><?=e($r['female_id'])?></td>
                <td><?=e($r['start_date'])?></td>
                <td style="color:var(--bronze)"><strong><?= $win_start ?> au <?= $win_end ?></strong></td>
                <td>
                    <a href="/?page=matings&female_id=<?= $r['female_id'] ?>" class="button-small">Déclarer saillie</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>