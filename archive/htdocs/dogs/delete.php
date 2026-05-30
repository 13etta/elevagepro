<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/config.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : (int) ($_POST['id'] ?? 0);
$errors = [];
$dog = null;

if ($id <= 0) {
    header('Location: list.php');
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, name, breed, chip, chip_number, status FROM dogs WHERE id = ?");
    $stmt->execute([$id]);
    $dog = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$dog) {
        header('Location: list.php');
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $movementDate = trim($_POST['movement_date'] ?? date('Y-m-d'));
        $reason = trim($_POST['reason'] ?? '');
        $notes = trim($_POST['notes'] ?? '');

        if ($movementDate === '') {
            $errors[] = "La date de sortie est obligatoire.";
        }

        if ($reason === '') {
            $errors[] = "Le motif de sortie est obligatoire.";
        }

        if (!$errors) {
            $pdo->beginTransaction();

            $update = $pdo->prepare("UPDATE dogs SET status = 'SORTI' WHERE id = ?");
            $update->execute([$id]);

            $insert = $pdo->prepare("
                INSERT INTO dog_movements (dog_id, movement_type, movement_date, reason, notes)
                VALUES (?, 'SORTIE', ?, ?, ?)
            ");
            $insert->execute([$id, $movementDate, $reason, $notes !== '' ? $notes : null]);

            $pdo->commit();

            header('Location: list.php?sortie=ok');
            exit;
        }
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    die("Erreur SQL : " . $e->getMessage());
}

require __DIR__ . '/../includes/header.php';
?>

<div class="container">
    <h1 class="mb-4">Sortir un chien du cheptel</h1>

    <div class="alert alert-warning">
        <strong>Attention :</strong> cette action ne supprime pas le chien de la base. Elle le retire de la liste active et inscrit une sortie dans le registre entrées/sorties.
    </div>

    <?php if ($errors): ?>
        <div class="alert alert-danger">
            <ul class="mb-0">
                <?php foreach ($errors as $error): ?>
                    <li><?= htmlspecialchars($error) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <div class="card shadow-sm">
        <div class="card-body">
            <h2 class="h5 mb-3"><?= htmlspecialchars($dog['name']) ?></h2>
            <p class="text-muted mb-4">
                <?= htmlspecialchars($dog['breed'] ?? '') ?>
                <?php if (!empty($dog['chip']) || !empty($dog['chip_number'])): ?>
                    — Identification : <?= htmlspecialchars($dog['chip'] ?: $dog['chip_number']) ?>
                <?php endif; ?>
            </p>

            <form method="post">
                <input type="hidden" name="id" value="<?= (int) $dog['id'] ?>">

                <div class="mb-3">
                    <label for="movement_date" class="form-label">Date de sortie *</label>
                    <input type="date" id="movement_date" name="movement_date" class="form-control" value="<?= htmlspecialchars($_POST['movement_date'] ?? date('Y-m-d')) ?>" required>
                </div>

                <div class="mb-3">
                    <label for="reason" class="form-label">Motif de sortie *</label>
                    <select id="reason" name="reason" class="form-select" required>
                        <option value="">-- Sélectionner un motif --</option>
                        <?php
                        $reasons = ['Vente', 'Cession gratuite', 'Décès', 'Réforme reproduction', 'Export', 'Perdu/volé', 'Erreur de saisie', 'Autre'];
                        $selectedReason = $_POST['reason'] ?? '';
                        foreach ($reasons as $reasonOption):
                        ?>
                            <option value="<?= htmlspecialchars($reasonOption) ?>" <?= $selectedReason === $reasonOption ? 'selected' : '' ?>>
                                <?= htmlspecialchars($reasonOption) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="mb-3">
                    <label for="notes" class="form-label">Commentaire</label>
                    <textarea id="notes" name="notes" class="form-control" rows="4" placeholder="Précisions utiles : acquéreur, circonstances, référence de document, etc."><?= htmlspecialchars($_POST['notes'] ?? '') ?></textarea>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-danger" onclick="return confirm('Confirmer la sortie administrative de ce chien ?')">
                        Confirmer la sortie
                    </button>
                    <a href="list.php" class="btn btn-secondary">Annuler</a>
                </div>
            </form>
        </div>
    </div>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
