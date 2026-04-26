<?php
require __DIR__ . '/includes/auth.php';
require __DIR__ . '/includes/config.php';
require __DIR__ . '/includes/header.php';

// Stats principales
$totalDogs = $pdo->query("SELECT COUNT(*) FROM dogs")->fetchColumn();
$totalLitters = $pdo->query("SELECT COUNT(*) FROM litters")->fetchColumn();
$totalPuppies = $pdo->query("SELECT COUNT(*) FROM puppies")->fetchColumn();
$availablePuppies = $pdo->query("SELECT COUNT(*) FROM puppies WHERE status = 'available'")->fetchColumn();
$gestations = $pdo->query("SELECT COUNT(*) FROM pregnancies WHERE result='ongoing'")->fetchColumn();
$chaleurs = $pdo->query("
    SELECT COUNT(*) 
    FROM heats 
    WHERE CURDATE() BETWEEN start_at AND IFNULL(end_at, DATE_ADD(start_at, INTERVAL 21 DAY))
")->fetchColumn();
// Rappels
$gestationsEnCours = $pdo->query("
    SELECT p.id, p.start_date, p.expected_date, d.name AS female_name
    FROM pregnancies p
    LEFT JOIN dogs d ON p.female_id = d.id
    WHERE p.result='ongoing'
    ORDER BY p.expected_date ASC
")->fetchAll(PDO::FETCH_ASSOC);

$porteesEnCours = $pdo->query("
    SELECT l.id, l.birth_date, f.name AS female_name
    FROM litters l
    LEFT JOIN dogs f ON l.female_id = f.id
    WHERE l.birth_date >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
    ORDER BY l.birth_date DESC
")->fetchAll(PDO::FETCH_ASSOC);

$soins = $pdo->query("
    SELECT s.id, s.dog_id, s.type, s.label, s.next_due, d.name AS dog_name
    FROM soins s
    LEFT JOIN dogs d ON s.dog_id = d.id
    WHERE s.next_due BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY s.next_due ASC
")->fetchAll(PDO::FETCH_ASSOC);


?>

<div class="container">
    <h1 class="mb-4">Tableau de bord</h1>

    <!-- Tuiles -->
<div class="row g-3 mb-4">
    <!-- Chiens -->
    <div class="col-md-3 col-sm-6">
        <a href="/dogs/list.php" class="text-decoration-none">
            <div class="dashboard-tile tile-blue">
                <i class="bi bi-shield-shaded tile-icon"></i>
                <h4>Chiens</h4>
                <p class="tile-value"><?= $totalDogs ?></p>
            </div>
        </a>
    </div>

    <!-- Portées -->
    <div class="col-md-3 col-sm-6">
        <a href="/dogs/litters/list.php" class="text-decoration-none">
            <div class="dashboard-tile tile-orange">
                <i class="bi bi-box2-heart tile-icon"></i>
                <h4>Portées</h4>
                <p class="tile-value"><?= $totalLitters ?></p>
            </div>
        </a>
    </div>

    <!-- Chiots -->
    <div class="col-md-3 col-sm-6">
        <a href="/dogs/puppies/list.php" class="text-decoration-none">
            <div class="dashboard-tile tile-green">
                <i class="bi bi-bag-heart tile-icon"></i>
                <h4>Chiots</h4>
                <p class="tile-value"><?= $totalPuppies ?></p>
            </div>
        </a>
    </div>

    <!-- Chiots disponibles -->
    <div class="col-md-3 col-sm-6">
        <a href="/dogs/puppies/list.php?status=available" class="text-decoration-none">
            <div class="dashboard-tile tile-purple">
                <i class="bi bi-star-fill tile-icon"></i>
                <h4>Disponibles</h4>
                <p class="tile-value"><?= $availablePuppies ?></p>
            </div>
        </a>
    </div>
	    <!-- Chaleurs -->
<div class="col-md-3 col-sm-6">
    <a href="/dogs/heats/list.php" class="text-decoration-none">
        <div class="dashboard-tile tile-pink">
            <i class="bi bi-fire tile-icon"></i>
            <h4>Chaleurs</h4>
            <p class="tile-value"><?= $chaleurs ?></p>
        </div>
    </a>
</div>
    <!-- Gestations -->
    <div class="col-md-3 col-sm-6">
        <a href="/dogs/pregnancies/list.php" class="text-decoration-none">
            <div class="dashboard-tile tile-red">
                <i class="bi bi-heart-pulse tile-icon"></i>
                <h4>Gestations</h4>
                <p class="tile-value"><?= $gestations ?></p>
            </div>
        </a>
    </div>
</div>


    <!-- Rappels -->
    <h2 class="mb-3">Rappels</h2>
    <div class="row">
        <!-- Gestations -->
        <div class="col-md-4 mb-3">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-red text-white">Gestations en cours</div>
                <div class="card-body small">
                    <?php if ($gestationsEnCours): ?>
                        <ul class="list-unstyled mb-0">
                            <?php foreach ($gestationsEnCours as $g): ?>
                                <li>
                                    <?= htmlspecialchars($g['female_name']) ?> 
                                    (mise bas prévue le <?= htmlspecialchars($g['expected_date']) ?>)
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else: ?>
                        <p class="mb-0">Aucune gestation en cours.</p>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Portées -->
        <div class="col-md-4 mb-3">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-orange text-white">Portées récentes</div>
                <div class="card-body small">
                    <?php if ($porteesEnCours): ?>
                        <ul class="list-unstyled mb-0">
                            <?php foreach ($porteesEnCours as $l): ?>
                                <li>
                                    <?= htmlspecialchars($l['female_name']) ?> 
                                    (<?= htmlspecialchars($l['birth_date']) ?>)
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else: ?>
                        <p class="mb-0">Aucune portée récente.</p>
                    <?php endif; ?>
                </div>
            </div>
        </div>

   <!-- Soins -->
<div class="col-md-4 mb-3">
    <div class="card shadow-sm h-100">
        <div class="card-header bg-blue text-white">Soins à venir</div>
        <div class="card-body small">
            <?php if ($soins): ?>
                <ul class="list-unstyled mb-0">
                    <?php foreach ($soins as $s): ?>
                        <li>
                            <?= htmlspecialchars($s['dog_name']) ?> : 
                            <?= htmlspecialchars($s['label']) ?> 
                            (<?= date("d/m/Y", strtotime($s['next_due'])) ?>)
                        </li>
                    <?php endforeach; ?>
                </ul>
            <?php else: ?>
                <p class="mb-0">Aucun soin prévu.</p>
            <?php endif; ?>
        </div>
    </div>
</div>

    </div>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
