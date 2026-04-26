<?php
require '../includes/auth.php';
require '../includes/config.php';
require '../includes/header.php';

require_login();

$user = current_user();
$breederId = $user['breeder_id'];

// Liste des chaleurs de l’éleveur connecté
$stmt = $pdo->prepare("
    SELECT h.*, d.name AS dog_name
    FROM heats h
    JOIN dogs d ON h.dog_id = d.id
    WHERE d.breeder_id = ?
    ORDER BY h.start_at DESC
");
$stmt->execute([$breederId]);
$heats = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<div class="container my-4">

  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-4">
    <div>
      <h1 class="h3 fw-bold mb-0"><i class="bi bi-fire text-danger me-2"></i> Chaleurs</h1>
      <small class="text-muted">Suivi des cycles des femelles</small>
    </div>
    <a class="btn btn-primary shadow-sm rounded-pill px-3" href="form.php">
      <i class="bi bi-plus-lg me-1"></i> Ajouter
    </a>
  </div>

  <!-- Table -->
  <div class="card shadow-sm">
    <div class="card-body table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Chienne</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Phase</th>
            <th>Notes</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($heats as $h): ?>
            <tr>
              <td data-label="Chienne"><?= h($h['dog_name']); ?></td>
              <td data-label="Début"><?= $h['start_at'] ? date('d/m/Y', strtotime($h['start_at'])) : '-'; ?></td>
              <td data-label="Fin"><?= $h['end_at'] ? date('d/m/Y', strtotime($h['end_at'])) : '-'; ?></td>
              <td data-label="Phase">
                <?php if ($h['stage']): ?>
                  <span class="badge bg-info text-dark"><?= h($h['stage']); ?></span>
                <?php else: ?>
                  <span class="text-muted">-</span>
                <?php endif; ?>
              </td>
              <td data-label="Notes"><?= h($h['notes'] ?? '-'); ?></td>
              <td class="text-end">
                <a href="form.php?id=<?= $h['id']; ?>" 
                   class="btn btn-sm btn-light border action-btn" 
                   data-bs-toggle="tooltip" title="Modifier">
                  <i class="bi bi-pencil text-secondary"></i>
                </a>
                <a href="delete.php?id=<?= $h['id']; ?>" 
                   onclick="return confirm('Supprimer cette chaleur ?');" 
                   class="btn btn-sm btn-light border action-btn" 
                   data-bs-toggle="tooltip" title="Supprimer">
                  <i class="bi bi-trash text-danger"></i>
                </a>
              </td>
            </tr>
          <?php endforeach; ?>
          <?php if (empty($heats)): ?>
            <tr>
              <td colspan="6" class="text-center text-muted">Aucune chaleur enregistrée.</td>
            </tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- CSS responsive cartes -->
<style>
@media (max-width: 768px) {
  table thead { display: none; }
  table tbody tr { 
    display: block; 
    margin-bottom: 1rem; 
    border: 1px solid #eee; 
    border-radius: 8px; 
    padding: 10px;
    background: #fff;
  }
  table tbody td { 
    display: flex; 
    justify-content: space-between; 
    padding: 6px 0; 
  }
  table tbody td::before {
    content: attr(data-label);
    font-weight: bold;
    color: #555;
  }
}
.action-btn:hover .bi-pencil { color: #0d6efd !important; }
.action-btn:hover .bi-trash { color: #dc3545 !important; }
</style>

<?php require __DIR__ . '/../../includes/footer.php'; ?>
