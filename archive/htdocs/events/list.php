<?php require __DIR__ . '/../includes/header.php'; ?>
<?php
$from = $_GET['from'] ?? date('Y-m-d');
$to = $_GET['to'] ?? date('Y-m-d', strtotime('+30 days'));

$stmt = $pdo->prepare("SELECT * FROM events WHERE date_time BETWEEN ? AND ? ORDER BY date_time ASC");
$stmt->execute([$from . " 00:00:00", $to . " 23:59:59"]);
$rows = $stmt->fetchAll();
?>
<h1 class="h4">Agenda</h1>
<form class="row g-2 align-items-end my-2">
  <div class="col-md-3">
    <label class="form-label">Du</label>
    <input type="date" class="form-control" name="from" value="<?php echo h($from); ?>">
  </div>
  <div class="col-md-3">
    <label class="form-label">Au</label>
    <input type="date" class="form-control" name="to" value="<?php echo h($to); ?>">
  </div>
  <div class="col-md-2"><button class="btn btn-outline-secondary w-100">Filtrer</button></div>
</form>
<div class="table-responsive">
<table class="table table-striped align-middle">
  <thead><tr><th>Date/Heure</th><th>Titre</th><th>Type</th><th>Terminé</th></tr></thead>
  <tbody>
    <?php foreach($rows as $r): ?>
      <tr>
        <td><?php echo h($r['date_time']); ?></td>
        <td><?php echo h($r['title']); ?></td>
        <td><span class="badge bg-secondary"><?php echo h($r['type']); ?></span></td>
        <td><?php echo $r['completed'] ? '✔' : '—'; ?></td>
      </tr>
    <?php endforeach; ?>
    <?php if(empty($rows)): ?>
      <tr><td colspan="4" class="text-muted">Aucun événement.</td></tr>
    <?php endif; ?>
  </tbody>
</table>
</div>
<?php require __DIR__ . '/../includes/footer.php'; ?>
