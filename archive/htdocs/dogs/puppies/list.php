<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';
// =====================
// Filtres & recherche
// =====================
$q      = trim($_GET['q'] ?? '');
$sex    = $_GET['sex'] ?? '';
$status = $_GET['status'] ?? '';
$litter = $_GET['litter'] ?? '';

$where = ["1=1"];
$args  = [];

// Recherche nom ou puce
if ($q !== '') {
    $where[] = "(p.name LIKE ? OR p.chip_number LIKE ?)";
    $args[]  = "%$q%";
    $args[]  = "%$q%";
}

// Filtre sexe
if ($sex !== '') {
    $where[] = "p.sex = ?";
    $args[]  = $sex;
}

// Filtre statut
if ($status !== '') {
    $where[] = "p.status = ?";
    $args[]  = $status;
}

// Filtre portée
if ($litter !== '') {
    $where[] = "p.litter_id = ?";
    $args[]  = $litter;
}

$sql = "
    SELECT p.id, p.name, p.sex, p.birth_date, p.chip_number, p.status,
           l.birth_date AS litter_date, f.name AS female_name
    FROM puppies p
    LEFT JOIN litters l ON p.litter_id = l.id
    LEFT JOIN dogs f ON l.female_id = f.id
    WHERE " . implode(" AND ", $where) . "
    ORDER BY p.birth_date DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$puppies = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Portées pour filtre
$litters = $pdo->query("
    SELECT l.id, l.birth_date, f.name AS female_name
    FROM litters l
    LEFT JOIN dogs f ON l.female_id = f.id
    ORDER BY l.birth_date DESC
")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">

    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="mb-0">Chiots</h1>
        <a href="form.php" class="btn btn-success">
            <i class="bi bi-plus-circle"></i> Ajouter un chiot
        </a>
    </div>
    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control"
                   placeholder="Rechercher (nom ou puce)"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-2">
            <select name="sex" class="form-select">
                <option value="">-- Sexe --</option>
                <option value="M" <?= $sex === 'M' ? 'selected' : '' ?>>Mâle</option>
                <option value="F" <?= $sex === 'F' ? 'selected' : '' ?>>Femelle</option>
            </select>
        </div>
        <div class="col-md-2">
            <select name="status" class="form-select">
                <option value="">-- Statut --</option>
                <option value="available" <?= $status === 'available' ? 'selected' : '' ?>>Disponible</option>
                <option value="reserved" <?= $status === 'reserved' ? 'selected' : '' ?>>Réservé</option>
                <option value="sold" <?= $status === 'sold' ? 'selected' : '' ?>>Vendu</option>
            </select>
        </div>
        <div class="col-md-3">
            <select name="litter" class="form-select">
                <option value="">-- Portée --</option>
                <?php foreach ($litters as $l): ?>
                    <option value="<?= $l['id'] ?>" <?= $litter == $l['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($l['female_name']) ?> (<?= date("d/m/Y", strtotime($l['birth_date'])) ?>)
                    </option>
                <?php endforeach; ?>
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
            <?php if ($puppies): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th>Nom</th>
                            <th>Sexe</th>
                            <th>Date naissance</th>
                            <th>Puce</th>
                            <th>Portée</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($puppies as $p): ?>
                            <tr>
                                <td class="fw-bold text-start"><?= htmlspecialchars($p['name']) ?></td>
                                <td><?= $p['sex'] === 'M' ? 'Mâle' : 'Femelle' ?></td>
                                <td><?= $p['birth_date'] ? date("d/m/Y", strtotime($p['birth_date'])) : '-' ?></td>
                                <td><?= htmlspecialchars($p['chip_number']) ?></td>
                                <td>
                                    <?= htmlspecialchars($p['female_name']) ?>
                                    (<?= $p['litter_date'] ? date("d/m/Y", strtotime($p['litter_date'])) : '-' ?>)
                                </td>
                                <td>
                                    <?php if ($p['status'] === 'available'): ?>
                                        <span class="badge bg-success">Disponible</span>
                                    <?php elseif ($p['status'] === 'reserved'): ?>
                                        <span class="badge bg-warning text-dark">Réservé</span>
                                    <?php elseif ($p['status'] === 'sold'): ?>
                                        <span class="badge bg-danger">Vendu</span>
                                    <?php else: ?>
                                        <span class="badge bg-secondary">N/A</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <a href="form.php?id=<?= $p['id'] ?>" class="btn btn-sm btn-warning">
                                        <i class="bi bi-pencil-square"></i>
                                    </a>
                                    <a href="delete.php?id=<?= $p['id'] ?>"
                                       class="btn btn-sm btn-danger"
                                       onclick="return confirm('Supprimer ce chiot ?')">
                                        <i class="bi bi-trash"></i>
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p class="mb-0 text-center">Aucun chiot trouvé.</p>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
