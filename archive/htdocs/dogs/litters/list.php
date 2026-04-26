<?php
require __DIR__ . '/../../includes/auth.php';
require __DIR__ . '/../../includes/config.php';
require __DIR__ . '/../../includes/functions.php';
require __DIR__ . '/../../includes/header.php';

require_login();

$user = current_user();
$breederId = $user['breeder_id'];

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

// Recherche globale (nom femelle, notes)
if ($q !== '') {
    $where[] = "(f.name LIKE ? OR l.notes LIKE ?)";
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
    $where[] = "l.status = ?";
    $args[]  = $status;
}

// Filtre période
if ($start !== '' && $end !== '') {
    $where[] = "l.birth_date BETWEEN ? AND ?";
    $args[]  = $start;
    $args[]  = $end;
}

// Liste des portées de l’éleveur connecté
$stmt = $pdo->prepare("
    SELECT l.*, f.name AS female_name
    FROM litters l
    LEFT JOIN dogs f ON l.female_id = f.id
    WHERE l.breeder_id = ? OR f.breeder_id = ?
    ORDER BY l.birth_date DESC
");
$stmt->execute([$breederId, $breederId]);
$litters = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Femelles pour filtre
$females = $pdo->query("SELECT id, name FROM dogs WHERE sex = 'F' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container">

    <!-- Titre + bouton Ajouter -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="mb-0">Portées</h1>
        <a href="form.php" class="btn btn-success">
            <i class="bi bi-plus-circle"></i> Ajouter une portée
        </a>
    </div>

    <!-- Filtres -->
    <form method="get" class="row g-2 mb-4">
        <div class="col-md-3">
            <input type="text" name="q" class="form-control"
                   placeholder="Rechercher (nom femelle, notes)"
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
                <option value="en_cours" <?= $status === 'en_cours' ? 'selected' : '' ?>>En cours</option>
                <option value="terminee" <?= $status === 'terminee' ? 'selected' : '' ?>>Terminée</option>
                <option value="echec" <?= $status === 'echec' ? 'selected' : '' ?>>Échec</option>
            </select>
        </div>
        <div class="col-md-2">
            <input type="date" name="start_date" class="form-control" value="<?= htmlspecialchars($start) ?>">
        </div>
        <div class="col-md-2">
            <input type="date" name="end_date" class="form-control" value="<?= htmlspecialchars($end) ?>">
        </div>
        <div class="col-md-12 col-lg-2">
            <button type="submit" class="btn btn-primary w-100">
                <i class="bi bi-funnel"></i> Filtrer
            </button>
        </div>
    </form>

    <!-- Tableau -->
    <div class="card shadow-sm">
        <div class="card-body table-responsive">
            <?php if ($litters): ?>
                <table class="table table-hover align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th>Femelle</th>
                            <th>Date mise bas</th>
                            <th>Nombre de chiots</th>
                            <th>Statut</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($litters as $l): ?>
                            <tr>
                                <td class="fw-bold text-start"><?= htmlspecialchars($l['female_name']) ?></td>
                                <td><?= date("d/m/Y", strtotime($l['birth_date'])) ?></td>
                                <td><?= (int)$l['nb_puppies'] ?></td>
                                <td>
                                    <?php if ($l['status'] === 'en_cours'): ?>
                                        <span class="badge bg-warning text-dark">En cours</span>
                                    <?php elseif ($l['status'] === 'terminee'): ?>
                                        <span class="badge bg-success">Terminée</span>
                                    <?php elseif ($l['status'] === 'echec'): ?>
                                        <span class="badge bg-danger">Échec</span>
                                    <?php else: ?>
                                        <span class="badge bg-secondary">N/A</span>
                                    <?php endif; ?>
                                </td>
                                <td><?= htmlspecialchars($l['notes']) ?></td>
                                <td>
                                    <a href="form.php?id=<?= $l['id'] ?>" class="btn btn-sm btn-warning">
                                        <i class="bi bi-pencil-square"></i>
                                    </a>
                                    <a href="delete.php?id=<?= $l['id'] ?>"
                                       class="btn btn-sm btn-danger"
                                       onclick="return confirm('Supprimer cette portée ?')">
                                        <i class="bi bi-trash"></i>
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p class="mb-0 text-center">Aucune portée trouvée.</p>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
