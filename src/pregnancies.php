<?php 
require_once __DIR__.'/crud_helpers.php'; 
$bid = breeder_id(); 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $start_date = $_POST['start_date'] ?: null;
    $expected_date = $_POST['expected_date'] ?: null;
    $female_id = $_POST['female_id'] ?: null;

    // --- LOGIQUE AUTOMATISÉE SAAS ---
    // 1. Calcul de la date de mise bas (Moyenne 63 jours pour les chiens)
    if ($start_date && !$expected_date) {
        $date = new DateTime($start_date);
        $date->modify('+63 days');
        $expected_date = $date->format('Y-m-d');
    }

    // Sauvegarde de la gestation
    insert_row($pdo, 'pregnancies', [
        'breeder_id'    => $bid,
        'mating_id'     => $_POST['mating_id'] ?: null,
        'female_id'     => $female_id,
        'start_date'    => $start_date,
        'expected_date' => $expected_date,
        'result'        => $_POST['result'],
        'notes'         => $_POST['notes']
    ]);

    // 2. Génération automatique d'un rappel (Échographie à J+25)
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

$rows = list_rows($pdo, 'pregnancies', $bid); 
?>
<header class="hero"><h1>Gestations</h1><p>Prévision de mise bas et résultat.</p></header>
<section class="panel"><form method="post" class="grid-form"><input type="hidden" name="_csrf" value="<?= csrf_token() ?>"><input name="mating_id" placeholder="ID saillie"><input name="female_id" placeholder="ID femelle"><input type="date" name="start_date"><input type="date" name="expected_date" title="Laissez vide pour un calcul automatique"><input name="result" placeholder="Résultat"><textarea name="notes" placeholder="Notes"></textarea><button>Ajouter</button></form></section>
<section class="panel"><table><thead><tr><th>Femelle</th><th>Début</th><th>Terme prévu</th><th>Résultat</th></tr></thead><tbody><?php foreach($rows as $r): ?><tr><td><?=e($r['female_id'])?></td><td><?=e($r['start_date'])?></td><td><?=e($r['expected_date'] ?: $r['due_date'])?></td><td><?=e($r['result'])?></td></tr><?php endforeach; ?></tbody></table></section>