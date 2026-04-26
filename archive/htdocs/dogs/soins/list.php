<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

// =====================
// Filtres & recherche
// =====================
$q       = trim($_GET['q'] ?? '');
$dog     = $_GET['dog'] ?? '';
$start   = $_GET['start_date'] ?? '';
$end     = $_GET['end_date'] ?? '';

$where = ["1=1"];
$args  = [];

// Recherche globale (chien, type de soin)
if ($q !== '') {
    $where[] = "(d.name LIKE ? OR s.label LIKE ?)";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
}

// Filtre chien
if ($dog !== '') {
    $where[] = "d.id = ?";
    $args[]  = $dog;
}

// Filtre période
if ($start !== '' && $end !== '') {
    $where[] = "s.next_due BETWEEN ? AND ?";
    $args[]  = $start;
    $args[]  = $end;
}

$sql = "
    SELECT s.id, s.label, s.next_due, s.notes, d.name AS dog_name
    FROM soins s
    LEFT JOIN dogs d ON s.dog_id = d.id
    WHERE " . implode(" AND ", $where) . "
    ORDER BY s.next_due ASC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$soins = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Récupération des chiens pour le filtre
$dogs = $pdo->query("SELECT id, name FROM dogs ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">

    <!-- Titre + bouton Ajouter -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="mb-0">Soins</h1>
        <a href="form.php" class="btn btn-success">
            <i class="bi bi-plus-circle"></i> Ajouter un soin
        </a>
    </div>

    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control"
                   placeholder="Rechercher (chien, soin)"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-3">
            <select name="dog" class="form-select">
                <option value="">-- Chien --</option>
                <?php foreach ($dogs as $d): ?>
                    <option value="<?= $d['id'] ?>" <?= $dog == $d['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($d['name']) ?>
                    </option>
                <?php endforeach; ?>
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
    <?php if ($soins && count($soins) > 0): ?>
        <p class="text-muted mb-3"><?= count($soins) ?> soin(s) trouvé(s)</p>
    <?php endif; ?>

    <!-- Tableau -->
    <div class="card shadow-sm">
        <div class="card-body table-responsive">
            <?php if ($soins): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Chien</th>
                            <th scope="col">Type de soin</th>
                            <th scope="col">Date prévue</th>
                            <th scope="col">Notes</th>
                            <th scope="col">Statut</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($soins as $s): 
                            $dueDate = strtotime($s['next_due']);
                            $today   = strtotime(date('Y-m-d'));
                        ?>
                            <tr>
                                <td data-label="Chien" class="fw-bold text-start"><?= htmlspecialchars($s['dog_name']) ?></td>
                                <td data-label="Type"><?= htmlspecialchars($s['label']) ?></td>
                                <td data-label="Date"><?= date("d/m/Y", $dueDate) ?></td>
                                <td data-label="Notes"><?= htmlspecialchars($s['notes']) ?></td>
                                <td data-label="Statut">
                                    <?php if ($dueDate < $today): ?>
                                        <span class="badge bg-danger">En retard</span>
                                    <?php elseif ($dueDate == $today): ?>
                                        <span class="badge bg-warning text-dark">Aujourd'hui</span>
                                    <?php else: ?>
                                        <span class="badge bg-success">À venir</span>
                                    <?php endif; ?>
                                </td>
                                <td data-label="Actions">
                                    <div class="dropdown">
                                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                            Actions
                                        </button>
                                        <ul class="dropdown-menu">
                                            <li><a class="dropdown-item" href="form.php?id=<?= $s['id'] ?>"><i class="bi bi-pencil-square"></i> Modifier</a></li>
                                            <li><a class="dropdown-item text-danger" href="delete.php?id=<?= $s['id'] ?>" onclick="return confirm('Supprimer ce soin ?')"><i class="bi bi-trash"></i> Supprimer</a></li>
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle"></i> Aucun soin trouvé pour vos critères.
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
