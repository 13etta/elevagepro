<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// =====================
// Filtres & recherche
// =====================
$q        = trim($_GET['q'] ?? '');
$male     = $_GET['male'] ?? '';
$female   = $_GET['female'] ?? '';
$method   = $_GET['method'] ?? '';
$start    = $_GET['start_date'] ?? '';
$end      = $_GET['end_date'] ?? '';

$where = ["1=1"];
$args  = [];

// Recherche globale (mâle, femelle, notes)
if ($q !== '') {
    $where[] = "(m.name LIKE ? OR f.name LIKE ? OR ma.notes LIKE ?)";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
}

// Filtre mâle
if ($male !== '') {
    $where[] = "ma.male_id = ?";
    $args[]  = $male;
}

// Filtre femelle
if ($female !== '') {
    $where[] = "ma.female_id = ?";
    $args[]  = $female;
}

// Filtre méthode
if ($method !== '') {
    $where[] = "ma.method = ?";
    $args[]  = $method;
}

// Filtre période
if ($start !== '' && $end !== '') {
    $where[] = "ma.date BETWEEN ? AND ?";
    $args[]  = $start;
    $args[]  = $end;
}

$sql = "
    SELECT ma.id, ma.date, ma.mating_date, ma.method, ma.place, ma.notes,
           m.name AS male_name, m.id_scc AS male_id_scc,
           f.name AS female_name, f.id_scc AS female_id_scc
    FROM matings ma
    LEFT JOIN dogs m ON ma.male_id = m.id
    LEFT JOIN dogs f ON ma.female_id = f.id
    WHERE " . implode(" AND ", $where) . "
    ORDER BY ma.date DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$matings = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Récupération des chiens pour les filtres
$males   = $pdo->query("SELECT id, name FROM dogs WHERE sex='M' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex='F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">

    <!-- Titre + bouton Ajouter -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="mb-0">Saillies</h1>
        <a href="form.php" class="btn btn-success">
            <i class="bi bi-plus-circle"></i> Ajouter une saillie
        </a>
    </div>

    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control"
                   placeholder="Rechercher (mâle, femelle, notes)"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-2">
            <select name="male" class="form-select">
                <option value="">-- Mâle --</option>
                <?php foreach ($males as $m): ?>
                    <option value="<?= $m['id'] ?>" <?= $male == $m['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($m['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <select name="female" class="form-select">
                <option value="">-- Femelle --</option>
                <?php foreach ($females as $f): ?>
                    <option value="<?= $f['id'] ?>" <?= $female == $f['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($f['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <select name="method" class="form-select">
                <option value="">-- Méthode --</option>
                <option value="Naturelle" <?= $method === 'Naturelle' ? 'selected' : '' ?>>Naturelle</option>
                <option value="IA" <?= $method === 'IA' ? 'selected' : '' ?>>IA</option>
            </select>
        </div>
        <div class="col-md-2">
            <input type="date" name="start_date" class="form-control" value="<?= htmlspecialchars($start) ?>">
        </div>
        <div class="col-md-2">
            <input type="date" name="end_date" class="form-control" value="<?= htmlspecialchars($end) ?>">
        </div>
        <div class="col-md-2 d-flex gap-2">
            <button type="submit" class="btn btn-primary w-100">
                <i class="bi bi-funnel"></i> Filtrer
            </button>
            <a href="list.php" class="btn btn-outline-secondary w-100">
                <i class="bi bi-x-circle"></i>
            </a>
        </div>
    </form>

    <!-- Résultats -->
    <?php if ($matings && count($matings) > 0): ?>
        <p class="text-muted mb-3"><?= count($matings) ?> saillie(s) trouvée(s)</p>
    <?php endif; ?>

    <!-- Tableau -->
    <div class="card shadow-sm">
        <div class="card-body table-responsive">
            <?php if ($matings): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Mâle</th>
                            <th scope="col">Femelle</th>
                            <th scope="col">Date</th>
                            <th scope="col">Méthode</th>
                            <th scope="col">Lieu</th>
                            <th scope="col">Notes</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($matings as $ma): ?>
                            <tr>
                                <td data-label="Mâle" class="fw-bold text-start"><?= htmlspecialchars($ma['male_name']) ?></td>
                                <td data-label="Femelle"><?= htmlspecialchars($ma['female_name']) ?></td>
                                <td data-label="Date"><?= date("d/m/Y", strtotime($ma['date'])) ?></td>
                                <td data-label="Méthode">
                                    <?php if ($ma['method'] === 'Naturelle'): ?>
                                        <span class="badge bg-success">Naturelle</span>
                                    <?php elseif ($ma['method'] === 'IA'): ?>
                                        <span class="badge bg-info text-dark">IA</span>
                                    <?php else: ?>
                                        <span class="badge bg-secondary">Autre</span>
                                    <?php endif; ?>
                                </td>
                                <td data-label="Lieu"><?= htmlspecialchars($ma['place']) ?></td>
                                <td data-label="Notes"><?= htmlspecialchars($ma['notes']) ?></td>
                                <td data-label="Actions">
                                    <div class="dropdown">
                                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                            Actions
                                        </button>
                                        <ul class="dropdown-menu">
                                            <li><a class="dropdown-item" href="form.php?id=<?= $ma['id'] ?>"><i class="bi bi-pencil-square"></i> Modifier</a></li>
                                            <li><a class="dropdown-item text-danger" href="delete.php?id=<?= $ma['id'] ?>" onclick="return confirm('Supprimer cette saillie ?')"><i class="bi bi-trash"></i> Supprimer</a></li>
                                        </ul>
										 <?php if (!empty($ma['male_id_scc']) && !empty($ma['female_id_scc'])): ?>
                    <a class="btn btn-sm btn-info"
                       href="https://www.centrale-canine.fr/lofselect/alliance-virtuelle/result?chienMaleId=<?= urlencode($ma['male_id_scc']); ?>&chienFemaleId=<?= urlencode($ma['female_id_scc']); ?>&globalBreedId=223&globalBreedName=Setter%20anglais"
                       target="_blank">
                       Voir portée SCC
                    </a>
                  <?php else: ?>
                    <span class="text-muted small">ID SCC manquant</span>
                  <?php endif; ?>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle"></i> Aucune saillie trouvée pour vos critères.
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
