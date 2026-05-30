<?php
require '../includes/auth.php'; // Vérifie la session
require '../includes/config.php'; // Connexion BDD
require '../includes/header.php'; // Header commun

// =====================
// Filtres & recherche
// =====================
$q      = trim($_GET['q'] ?? '');
$sex    = $_GET['sex'] ?? '';
$breed  = $_GET['breed'] ?? '';
$status = $_GET['status'] ?? 'ACTIF';

$where = ["1=1"];
$args  = [];

// Par défaut, on masque les chiens sortis du cheptel.
// L'utilisateur peut les revoir avec le filtre "Tous" ou "Sortis".
if ($status === 'SORTI') {
    $where[] = "UPPER(COALESCE(d.status, 'ACTIF')) = 'SORTI'";
} elseif ($status === 'ALL') {
    // Aucun filtre de statut
} else {
    $where[] = "UPPER(COALESCE(d.status, 'ACTIF')) <> 'SORTI'";
}

// Recherche globale (nom ou puce)
if ($q !== '') {
    $where[] = "(d.name LIKE ? OR d.chip_number LIKE ? OR d.chip LIKE ?)";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
}

// Filtre sexe
if ($sex !== '') {
    $where[] = "d.sex = ?";
    $args[]  = $sex;
}

// Filtre race
if ($breed !== '') {
    $where[] = "d.breed = ?";
    $args[]  = $breed;
}

$sql = "
    SELECT d.id, d.name, d.sex, d.breed, d.birth_date, d.chip, d.chip_number, d.status
    FROM dogs d
    WHERE " . implode(" AND ", $where) . "
    ORDER BY d.name ASC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$dogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">
    <h1 class="mb-4">Chiens</h1>

    <?php if (($_GET['sortie'] ?? '') === 'ok'): ?>
        <div class="alert alert-success">
            Chien sorti du cheptel et inscrit au registre entrées/sorties.
        </div>
    <?php endif; ?>

    <div class="mb-3 d-flex gap-2 flex-wrap">
        <a href="form.php" class="btn btn-primary">
            <i class="bi bi-plus-circle"></i> Ajouter un chien
        </a>
        <a href="movements.php" class="btn btn-outline-secondary">
            <i class="bi bi-journal-text"></i> Registre entrées/sorties
        </a>
    </div>

    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control" placeholder="Rechercher par nom ou puce"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-2">
            <select name="sex" class="form-select">
                <option value="">-- Sexe --</option>
                <option value="M" <?= $sex === 'M' ? 'selected' : '' ?>>Mâle</option>
                <option value="F" <?= $sex === 'F' ? 'selected' : '' ?>>Femelle</option>
            </select>
        </div>
        <div class="col-md-3">
            <input type="text" name="breed" class="form-control" placeholder="Race"
                   value="<?= htmlspecialchars($breed) ?>">
        </div>
        <div class="col-md-2">
            <select name="status" class="form-select">
                <option value="ACTIF" <?= $status === 'ACTIF' ? 'selected' : '' ?>>Chiens actifs</option>
                <option value="SORTI" <?= $status === 'SORTI' ? 'selected' : '' ?>>Chiens sortis</option>
                <option value="ALL" <?= $status === 'ALL' ? 'selected' : '' ?>>Tous les chiens</option>
            </select>
        </div>
        <div class="col-md-2">
            <button type="submit" class="btn btn-primary w-100">
                <i class="bi bi-funnel"></i> Filtrer
            </button>
        </div>
    </form>

    <!-- Tableau -->
    <div class="card shadow-sm">
        <div class="card-body table-responsive">
            <?php if ($dogs): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th>Nom</th>
                            <th>Sexe</th>
                            <th>Race</th>
                            <th>Date de naissance</th>
                            <th>Puce</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($dogs as $dog): ?>
                            <?php $dogStatus = strtoupper($dog['status'] ?? 'ACTIF'); ?>
                            <tr>
                                <td class="fw-bold text-start"><?= htmlspecialchars($dog['name']) ?></td>
                                <td><?= $dog['sex'] === 'M' ? 'Mâle' : 'Femelle' ?></td>
                                <td><?= htmlspecialchars($dog['breed']) ?></td>
                                <td><?= $dog['birth_date'] ? date("d/m/Y", strtotime($dog['birth_date'])) : '-' ?></td>
                                <td><?= htmlspecialchars($dog['chip'] ?: ($dog['chip_number'] ?? '')) ?></td>
                                <td>
                                    <span class="badge <?= $dogStatus === 'SORTI' ? 'bg-secondary' : 'bg-success' ?>">
                                        <?= $dogStatus === 'SORTI' ? 'Sorti' : 'Actif' ?>
                                    </span>
                                </td>
                                <td class="text-nowrap">
                                    <a href="form.php?id=<?= (int) $dog['id'] ?>" class="btn btn-sm btn-warning" title="Modifier">
                                        <i class="bi bi-pencil-square"></i>
                                    </a>

                                    <?php if ($dogStatus !== 'SORTI'): ?>
                                        <a href="delete.php?id=<?= (int) $dog['id'] ?>"
                                           class="btn btn-sm btn-danger"
                                           title="Sortir du cheptel">
                                            <i class="bi bi-box-arrow-right"></i> Sortir
                                        </a>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p class="mb-0 text-center">Aucun chien trouvé.</p>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require '../includes/footer.php'; ?>
