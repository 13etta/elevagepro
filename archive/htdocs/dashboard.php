
<?php

require __DIR__ . '/includes/auth.php';
require __DIR__ . '/includes/config.php';
require __DIR__ . '/includes/header.php';

require_login();

$user = current_user();
?>

<?php
/* ==== Stats principales ==== */
$totalDogs         = $pdo->query("SELECT COUNT(*) FROM dogs")->fetchColumn();
$totalLitters      = $pdo->query("SELECT COUNT(*) FROM litters")->fetchColumn();
$totalPuppies      = $pdo->query("SELECT COUNT(*) FROM puppies")->fetchColumn();
$availablePuppies  = $pdo->query("SELECT COUNT(*) FROM puppies WHERE status = 'available'")->fetchColumn();

$gestationsEnCours = $pdo->query("SELECT COUNT(*) FROM pregnancies WHERE result = 'En cours'")->fetchColumn();

$chaleurs = $pdo->query("
    SELECT COUNT(*) 
    FROM heats 
    WHERE CURDATE() BETWEEN start_at AND IFNULL(end_at, DATE_ADD(start_at, INTERVAL 21 DAY))
")->fetchColumn();

/* ==== Rappels ==== */
$gestationsListe = $pdo->query("
    SELECT p.id, p.start_date, p.expected_date, d.name AS female_name
    FROM pregnancies p
    LEFT JOIN dogs d ON p.female_id = d.id
    WHERE p.result = 'En cours'
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
    SELECT s.id, s.dog_id, s.label, s.next_due, d.name AS dog_name
    FROM soins s
    LEFT JOIN dogs d ON s.dog_id = d.id
    WHERE s.next_due BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY s.next_due ASC
")->fetchAll(PDO::FETCH_ASSOC);

/* ==== Stats par femelle ==== */
$gestationsStats = $pdo->query("
    SELECT d.name AS female_name,
           COUNT(p.id) AS total,
           SUM(CASE WHEN p.result = 'En cours' THEN 1 ELSE 0 END) AS en_cours,
           SUM(CASE WHEN p.result = 'Réussie' THEN 1 ELSE 0 END) AS succes,
           SUM(CASE WHEN p.result = 'Échec' THEN 1 ELSE 0 END) AS echec
    FROM dogs d
    LEFT JOIN pregnancies p ON p.female_id = d.id
    WHERE d.sex = 'F'
    GROUP BY d.id, d.name
    ORDER BY d.name ASC
")->fetchAll(PDO::FETCH_ASSOC);

/* ==== Stats globales ==== */
$statsGlobales = $pdo->query("
    SELECT 
        SUM(CASE WHEN result = 'En cours' THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN result = 'Réussie' THEN 1 ELSE 0 END) AS succes,
        SUM(CASE WHEN result = 'Échec' THEN 1 ELSE 0 END) AS echec
    FROM pregnancies
")->fetch(PDO::FETCH_ASSOC);
?>

<div class="container">
    <h1 class="mb-4">Tableau de bord</h1>

    <!-- ===== Tuiles statistiques ===== -->
    <div class="row g-3 mb-4">
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/list.php" class="text-decoration-none">
                <div class="dashboard-tile tile-blue">
                    <i class="bi bi-shield-shaded tile-icon"></i>
                    <h4>Chiens</h4>
                    <p class="tile-value"><?= $totalDogs ?></p>
                </div>
            </a>
        </div>
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/litters/list.php" class="text-decoration-none">
                <div class="dashboard-tile tile-orange">
                    <i class="bi bi-box2-heart tile-icon"></i>
                    <h4>Portées</h4>
                    <p class="tile-value"><?= $totalLitters ?></p>
                </div>
            </a>
        </div>
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/puppies/list.php" class="text-decoration-none">
                <div class="dashboard-tile tile-green">
                    <i class="bi bi-bag-heart tile-icon"></i>
                    <h4>Chiots</h4>
                    <p class="tile-value"><?= $totalPuppies ?></p>
                </div>
            </a>
        </div>
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/puppies/list.php?status=available" class="text-decoration-none">
                <div class="dashboard-tile tile-purple">
                    <i class="bi bi-star-fill tile-icon"></i>
                    <h4>Disponibles</h4>
                    <p class="tile-value"><?= $availablePuppies ?></p>
                </div>
            </a>
        </div>

        <!-- Tuile Gestations en cours -->
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/pregnancies/list.php" class="text-decoration-none">
                <div class="dashboard-tile tile-red">
                    <i class="bi bi-heart-pulse tile-icon"></i>
                    <h4>Gestations en cours</h4>
                    <p class="tile-value"><?= $gestationsEnCours ?></p>
                </div>
            </a>
        </div>

        <!-- Tuile chaleurs -->
        <div class="col-md-3 col-sm-6">
            <a href="/dogs/heats/list.php" class="text-decoration-none">
                <div class="dashboard-tile tile-pink">
                    <i class="bi bi-fire tile-icon"></i>
                    <h4>Chaleurs</h4>
                    <p class="tile-value"><?= $chaleurs ?></p>
                </div>
            </a>
        </div>
    </div>

    <!-- ===== Rappels ===== -->
    <h2 class="mb-3">Rappels</h2>
    <div class="row">
        <!-- Gestations -->
        <div class="col-md-4 mb-3">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-red text-white">Gestations en cours</div>
                <div class="card-body small">
                    <?php if ($gestationsListe): ?>
                        <ul class="list-unstyled mb-0">
                            <?php foreach ($gestationsListe as $g): ?>
                                <li>
                                    <?= htmlspecialchars($g['female_name']) ?> 
                                    (mise bas prévue le <?= date("d/m/Y", strtotime($g['expected_date'])) ?>)
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
                                    (<?= date("d/m/Y", strtotime($l['birth_date'])) ?>)
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
                        <p class="mb-0">Aucun soin prévu dans les 30 jours.</p>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- ===== Statistiques gestations ===== -->
    <div class="mt-5">
      <div class="stats-header mb-3 d-flex align-items-center gap-2">
        <i class="bi bi-bar-chart-fill text-primary fs-3"></i>
        <h2 class="mb-0">Statistiques gestations</h2>
      </div>

      <div class="row">
        <!-- Tableau par femelle -->
        <div class="col-lg-6 mb-4">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">Par femelle</div>
            <div class="card-body">
              <?php if ($gestationsStats): ?>
                <div class="table-responsive">
                  <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                      <tr>
                        <th>Femelle</th>
                        <th>Total</th>
                        <th>En cours</th>
                        <th class="text-success">Réussies</th>
                        <th class="text-danger">Échecs</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($gestationsStats as $s): ?>
                        <tr>
                          <td class="text-start fw-bold"><?= htmlspecialchars($s['female_name']) ?></td>
                          <td><?= (int)$s['total'] ?></td>
                          <td><span class="badge bg-secondary"><?= (int)$s['en_cours'] ?></span></td>
                          <td><span class="badge bg-success"><?= (int)$s['succes'] ?></span></td>
                          <td><span class="badge bg-danger"><?= (int)$s['echec'] ?></span></td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              <?php else: ?>
                <p class="mb-0">Aucune donnée de gestation enregistrée.</p>
              <?php endif; ?>
            </div>
          </div>
        </div>

        <!-- Graphique global -->
        <div class="col-lg-6 mb-4">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-primary text-white">Vue d'ensemble</div>
            <div class="card-body">
              <canvas id="gestationsGlobalChart" height="200"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Graphique par femelle -->
      <div class="card shadow-sm mt-4">
        <div class="card-header bg-secondary text-white">Comparaison par femelle</div>
        <div class="card-body">
          <canvas id="gestationsParFemelleChart" height="120"></canvas>
        </div>
      </div>
    </div>
</div>

<!-- ===== Chart.js ===== -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
// ===== Graphique global (camembert) =====
const ctxGlobal = document.getElementById('gestationsGlobalChart');
new Chart(ctxGlobal, {
  type: 'pie',
  data: {
    labels: ['En cours', 'Réussies', 'Échecs'],
    datasets: [{
      data: [<?= (int)$statsGlobales['en_cours'] ?>, <?= (int)$statsGlobales['succes'] ?>, <?= (int)$statsGlobales['echec'] ?>],
      backgroundColor: ['#6c757d', '#28a745', '#dc3545']
    }]
  },
  options: { responsive: true }
});

// ===== Graphique par femelle (barres) =====
const ctxFemelles = document.getElementById('gestationsParFemelleChart');
new Chart(ctxFemelles, {
  type: 'bar',
  data: {
    labels: <?= json_encode(array_column($gestationsStats, 'female_name')) ?>,
    datasets: [
      {
        label: 'En cours',
        data: <?= json_encode(array_column($gestationsStats, 'en_cours')) ?>,
        backgroundColor: '#6c757d'
      },
      {
        label: 'Réussies',
        data: <?= json_encode(array_column($gestationsStats, 'succes')) ?>,
        backgroundColor: '#28a745'
      },
      {
        label: 'Échecs',
        data: <?= json_encode(array_column($gestationsStats, 'echec')) ?>,
        backgroundColor: '#dc3545'
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'top' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  }
});
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
