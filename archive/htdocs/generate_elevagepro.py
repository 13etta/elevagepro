import os, textwrap

BASE = "E:/xampp/htdocs/elevagepro-ultimate"

def w(path, content):
    """Écrit un fichier avec son contenu"""
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(textwrap.dedent(content).lstrip("\n"))

w("breeding/matings/list.php", """
<?php require __DIR__ . '/../../includes/header.php'; ?>
<?php
$q = trim($_GET['q'] ?? '');
$where = ["1=1"]; $args=[];
if ($q!==''){ 
    $where[]="(f.name LIKE ? OR m.name LIKE ? OR DATE_FORMAT(mt.date,'%Y-%m-%d') LIKE ?)";
    $args=["%$q%","%$q%","%$q%"]; 
}
$sql = "SELECT mt.*, f.name AS female_name, m.name AS male_name
        FROM matings mt
        JOIN dogs f ON f.id=mt.female_id
        JOIN dogs m ON m.id=mt.male_id
        WHERE ".implode(" AND ",$where)." ORDER BY mt.date DESC";
$stmt=$pdo->prepare($sql); $stmt->execute($args); $rows=$stmt->fetchAll();
?>
<div class="d-flex justify-content-between align-items-center">
  <h1 class="h4">Saillies</h1>
  <div class="btn-group">
    <a class="btn btn-primary" href="<?php echo base_url('breeding/matings/form.php'); ?>">+ Nouvelle saillie</a>
    <a class="btn btn-sm btn-outline-secondary" href="?export=1">Exporter CSV</a>
  </div>
</div>

<table class="table table-striped">
<thead><tr><th>Date</th><th>Femelle</th><th>Mâle</th><th>Méthode</th><th>Notes</th><th></th></tr></thead>
<tbody>
<?php foreach($rows as $r): ?>
<tr>
  <td><?php echo h($r['date']); ?></td>
  <td><?php echo h($r['female_name']); ?></td>
  <td><?php echo h($r['male_name']); ?></td>
  <td><?php echo h($r['method']); ?></td>
  <td><?php echo nl2br(h($r['notes'])); ?></td>
  <td>
    <a class="btn btn-sm btn-outline-secondary" href="form.php?id=<?php echo $r['id']; ?>">Modifier</a>
    <a class="btn btn-sm btn-outline-primary" href="../pregnancies/form.php?mating_id=<?php echo $r['id']; ?>">→ Créer gestation</a>
    <a class="btn btn-sm btn-outline-danger" href="delete.php?id=<?php echo $r['id']; ?>" onclick="return confirm('Supprimer ?');">Supprimer</a>
  </td>
</tr>
<?php endforeach; ?>
<?php if(empty($rows)): ?><tr><td colspan="6" class="text-muted">Aucune saillie.</td></tr><?php endif; ?>
</tbody></table>

<?php if(isset($_GET['export'])){ require __DIR__.'/../../includes/export.php'; array_to_csv_download($rows,'matings.csv'); } ?>
<?php require __DIR__ . '/../../includes/footer.php'; ?>
""")

w("breeding/matings/form.php", """
<?php require __DIR__ . '/../../includes/header.php'; ?>
<?php
$id = (int)($_GET['id'] ?? 0);
$dogsF = $pdo->query("SELECT id,name FROM dogs WHERE sex='F' ORDER BY name")->fetchAll();
$dogsM = $pdo->query("SELECT id,name FROM dogs WHERE sex='M' ORDER BY name")->fetchAll();
$m = ['female_id'=>'','male_id'=>'','date'=>date('Y-m-d'),'method'=>'naturelle','notes'=>''];
if($id){
  $st=$pdo->prepare("SELECT * FROM matings WHERE id=?"); $st->execute([$id]); $m=$st->fetch() ?: $m;
}
?>
<h1 class="h4"><?php echo $id?'Modifier':'Nouvelle'; ?> saillie</h1>
<form method="post" action="store.php">
  <input type="hidden" name="id" value="<?php echo (int)$id; ?>">
  <div class="row g-3">
    <div class="col-md-6">
      <label class="form-label">Femelle</label>
      <select class="form-select" name="female_id">
        <?php foreach($dogsF as $d): ?>
          <option value="<?php echo $d['id']; ?>" <?php if($m['female_id']==$d['id']) echo 'selected'; ?>><?php echo h($d['name']); ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-6">
      <label class="form-label">Mâle</label>
      <select class="form-select" name="male_id">
        <?php foreach($dogsM as $d): ?>
          <option value="<?php echo $d['id']; ?>" <?php if($m['male_id']==$d['id']) echo 'selected'; ?>><?php echo h($d['name']); ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-4">
      <label class="form-label">Date</label>
      <input type="date" class="form-control" name="date" value="<?php echo h($m['date']); ?>">
    </div>
    <div class="col-md-4">
      <label class="form-label">Méthode</label>
      <input class="form-control" name="method" value="<?php echo h($m['method']); ?>">
    </div>
    <div class="col-12">
      <label class="form-label">Notes</label>
      <textarea class="form-control" name="notes"><?php echo h($m['notes']); ?></textarea>
    </div>
  </div>
  <div class="mt-3">
    <button class="btn btn-primary">Enregistrer</button>
    <a class="btn btn-secondary" href="list.php">Annuler</a>
  </div>
</form>
<?php require __DIR__ . '/../../includes/footer.php'; ?>
""")

w("breeding/matings/store.php", """
<?php
require __DIR__ . '/../../includes/config.php';
$id=(int)($_POST['id']??0);
$fields=[
 'female_id'=>(int)$_POST['female_id'],
 'male_id'=>(int)$_POST['male_id'],
 'date'=>$_POST['date'],
 'method'=>$_POST['method'],
 'notes'=>$_POST['notes'],
];
if($id){
  $sql="UPDATE matings SET female_id=:female_id,male_id=:male_id,date=:date,method=:method,notes=:notes WHERE id=:id";
  $fields['id']=$id;
  $pdo->prepare($sql)->execute($fields);
}else{
  $sql="INSERT INTO matings(female_id,male_id,date,method,notes) VALUES(:female_id,:male_id,:date,:method,:notes)";
  $pdo->prepare($sql)->execute($fields);
}
header('Location: list.php');
""")

w("breeding/matings/delete.php", """
<?php
require __DIR__ . '/../../includes/config.php';
$id=(int)($_GET['id']??0);
if($id){ $pdo->prepare("DELETE FROM matings WHERE id=?")->execute([$id]); }
header('Location: list.php');
""")
