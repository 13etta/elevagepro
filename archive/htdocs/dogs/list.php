<?php
require '../includes/auth.php'; // Vérifie la session
require '../includes/config.php'; // Connexion BDD
require '../includes/header.php'; // Header commun

// =====================
// Filtres & recherche
// =====================
$q     = trim($_GET['q'] ?? '');
$sex   = $_GET['sex'] ?? '';
$breed = $_GET['breed'] ?? '';

$where = ["1=1"];
$args  = [];

// Recherche globale (nom ou puce)
if ($q !== '') {
    $where[] = "(d.name LIKE ? OR d.chip_number LIKE ?)";
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
    SELECT d.id, d.name, d.sex, d.breed, d.birth_date, d.chip, d.status
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
<div class="mb-3">
    <a href="form.php" class="btn btn-primary">
        <i class="bi bi-plus-circle"></i> Ajouter un chien
    </a>
</div>
    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-4">
            <input type="text" name="q" class="form-control" placeholder="Rechercher par nom ou puce"
                   value="<?= htmlspecialchars($q) ?>">
        </div>
        <div class="col-md-3">
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
                            <tr>
                                <td class="fw-bold text-start"><?= htmlspecialchars($dog['name']) ?></td>
                                <td><?= $dog['sex'] === 'M' ? 'Mâle' : 'Femelle' ?></td>
                                <td><?= htmlspecialchars($dog['breed']) ?></td>
                                <td><?= $dog['birth_date'] ? date("d/m/Y", strtotime($dog['birth_date'])) : '-' ?></td>
                                <td><?= htmlspecialchars($dog['chip']) ?></td>
                                <td>
                                    <span class="badge <?= $dog['status'] === 'active' ? 'bg-success' : 'bg-secondary' ?>">
                                        <?= htmlspecialchars($dog['status']) ?>
                                    </span>
                                </td>
                                <td>
                                    <a href="form.php?id=<?= $dog['id'] ?>" class="btn btn-sm btn-warning">
                                        <i class="bi bi-pencil-square"></i>
                                    </a>
                                    <a href="delete.php?id=<?= $dog['id'] ?>" 
                                       class="btn btn-sm btn-danger" 
                                       onclick="return confirm('Supprimer ce chien ?')">
                                        <i class="bi bi-trash"></i>
                                    </a>
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
