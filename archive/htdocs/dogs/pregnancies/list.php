<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// =====================
// Filtres & recherche
// =====================
$q       = trim($_GET['q'] ?? '');
$female  = $_GET['female'] ?? '';
$status  = $_GET['status'] ?? '';
$start   = $_GET['start_date'] ?? '';
$end     = $_GET['end_date'] ?? '';

$where = ["1=1"];
$args  = [];

// Recherche globale (femelle, notes)
if ($q !== '') {
    $where[] = "(f.name LIKE ? OR p.notes LIKE ?)";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
}

// Filtre femelle
if ($female !== '') {
    $where[] = "f.id = ?";
    $args[]  = $female;
}

// Filtre statut
if ($status !== '') {
    $where[] = "p.result = ?";
    $args[]  = $status;
}

// Filtre période
if ($start !== '' && $end !== '') {
    $where[] = "p.start_date BETWEEN ? AND ?";
    $args[]  = $start;
    $args[]  = $end;
}

$sql = "
    SELECT p.id, p.start_date, p.expected_date, p.result, p.notes,
           f.name AS female_name
    FROM pregnancies p
    LEFT JOIN dogs f ON p.female_id = f.id
    WHERE " . implode(" AND ", $where) . "
    ORDER BY p.start_date DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$pregnancies = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Femelles pour filtre
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex='F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">

    <!-- Titre + bouton Ajouter -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="mb-0">Gestations</h1>
        <a href="form.php" class="btn btn-success">
            <i class="bi bi-plus-circle"></i> Ajouter une gestation
        </a>
    </div>

    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control"
                   placeholder="Rechercher (femelle, notes)"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-3">
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
            <select name="status" class="form-select">
                <option value="">-- Statut --</option>
                <option value="En cours" <?= $status === 'En cours' ? 'selected' : '' ?>>En cours</option>
                <option value="Réussie" <?= $status === 'Réussie' ? 'selected' : '' ?>>Réussie</option>
                <option value="Échec" <?= $status === 'Échec' ? 'selected' : '' ?>>Échec</option>
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
    <?php if ($pregnancies && count($pregnancies) > 0): ?>
        <p class="text-muted mb-3"><?= count($pregnancies) ?> gestation(s) trouvée(s)</p>
    <?php endif; ?>

    <!-- Tableau -->
    <div class="card shadow-sm">
        <div class="card-body table-responsive">
            <?php if ($pregnancies): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Femelle</th>
                            <th scope="col">Date saillie</th>
                            <th scope="col">Date mise bas prévue</th>
                            <th scope="col">Statut</th>
                            <th scope="col">Notes</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($pregnancies as $p): ?>
                            <tr>
                                <td data-label="Femelle" class="fw-bold text-start"><?= htmlspecialchars($p['female_name']) ?></td>
                                <td data-label="Date saillie"><?= date("d/m/Y", strtotime($p['start_date'])) ?></td>
                                <td data-label="Date prévue"><?= date("d/m/Y", strtotime($p['expected_date'])) ?></td>
                                <td data-label="Statut">
                                    <?php if ($p['result'] === 'En cours'): ?>
                                        <span class="badge bg-warning text-dark">En cours</span>
                                    <?php elseif ($p['result'] === 'Réussie'): ?>
                                        <span class="badge bg-success">Réussie</span>
                                    <?php elseif ($p['result'] === 'Échec'): ?>
                                        <span class="badge bg-danger">Échec</span>
                                    <?php else: ?>
                                        <span class="badge bg-secondary">N/A</span>
                                    <?php endif; ?>
                                </td>
                                <td data-label="Notes"><?= htmlspecialchars($p['notes']) ?></td>
                                <td data-label="Actions">
                                    <div class="dropdown">
                                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                            Actions
                                        </button>
                                        <ul class="dropdown-menu">
                                            <li><a class="dropdown-item" href="form.php?id=<?= $p['id'] ?>"><i class="bi bi-pencil-square"></i> Modifier</a></li>
                                            <li><a class="dropdown-item text-danger" href="delete.php?id=<?= $p['id'] ?>" onclick="return confirm('Supprimer cette gestation ?')"><i class="bi bi-trash"></i> Supprimer</a></li>
                                            <li><a class="dropdown-item text-info" href="../litters/virtual_litter.php?pregnancy_id=<?= $p['id'] ?>" target="_blank"><i class="bi bi-box-arrow-up-right"></i> Portée SCC</a></li>
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle"></i> Aucune gestation trouvée pour vos critères.
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
