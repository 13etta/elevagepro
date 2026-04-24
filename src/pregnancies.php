<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $start_date = $_POST['start_date'] ?: null;
    $expected_date = $_POST['expected_date'] ?: null;
    $female_id = $_POST['female_id'] ?: null;

    // --- LOGIQUE AUTOMATISÉE SAAS ---
    // Calcul de la date de mise bas (+63 jours)
    if ($start_date && !$expected_date) {
        $date = new DateTime($start_date);
        $date->modify('+63 days');
        $expected_date = $date->format('Y-m-d');
    }

    // Sauvegarde
    insert_row($pdo, 'pregnancies', [
        'breeder_id'    => $bid,
        'mating_id'     => $_POST['mating_id'] ?: null,
        'female_id'     => $female_id,
        'start_date'    => $start_date,
        'expected_date' => $expected_date,
        'result'        => $_POST['result'],
        'notes'         => $_POST['notes']
    ]);

    // Génération automatique d'un rappel d'échographie à J+25
    if ($start_date && $female_id) {
        $echo_date = new DateTime($start_date);
        $echo_date->modify('+25 days');

        insert_row($pdo, 'reminders', [
            'breeder_id' => $bid,
            'title'      => 'Échographie de contrôle (Gestation)',
            'due_date'   => $echo_date->format('Y-m-d'),
            'type'       => 'Reproduction',
            'dog_id'     => $female_id,
            'notes'      => 'Généré automatiquement par le système.'
        ]);
    }
    // --- FIN LOGIQUE AUTOMATISÉE ---

    header('Location: /?page=pregnancies'); 
    exit;
} 

// 1. Récupération des gestations pour le tableau
$rows = list_rows($pdo, 'pregnancies', $bid); 

// 2. NOUVEAU : Récupération exclusive des femelles de cet élevage pour le formulaire
$stmt = $pdo->prepare("SELECT id, name FROM dogs WHERE breeder_id = :bid AND (sex = 'Femelle' OR sex = 'femelle') ORDER BY name ASC");
$stmt->execute(['bid' => $bid]);
$females = $stmt->fetchAll();
?>
<header class="hero">
    <h1>Gestations</h1>
    <p>Prévision de mise bas et résultat.</p>
</header>

<section class="panel">
    <form method="post" class="grid-form">
        <input type="hidden" name="_csrf" value="<?= csrf_token() ?>">
        
        <input name="mating_id" placeholder="ID saillie (Optionnel)">
        
        <select name="female_id" required>
            <option value="">-- Choisir une femelle --</option>
            <?php foreach($females as $f): ?>
                <option value="<?= $f['id'] ?>"><?= e($f['name']) ?></option>
            <?php endforeach; ?>
        </select>

        <input type="date" name="start_date" required title="Date de début">
        <input type="date" name="expected_date" title="Terme (Laisser vide pour calcul auto)">
        <input name="result" placeholder="Résultat">
        <textarea name="notes" placeholder="Notes"></textarea>
        
        <button>Ajouter la gestation</button>
    </form>
</section>

<section class="panel">
    <table>
        <thead>
            <tr>
                <th>Femelle (ID)</th>
                <th>Début</th>
                <th>Terme prévu</th>
                <th>Résultat</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach($rows as $r): ?>
            <tr>
                <td><?=e($r['female_id'])?></td>
                <td><?=e($r['start_date'])?></td>
                <td><?=e($r['expected_date'] ?: $r['due_date'])?></td>
                <td><?=e($r['result'])?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</section>