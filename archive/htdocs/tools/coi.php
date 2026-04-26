<?php
require __DIR__ . '/../includes/config.php';
require __DIR__ . '/../includes/header.php';

// --- Fonctions calcul COI ---
function parse_pedigree($text) {
    // Format: Nom;Père;Mère (une ligne par chien)
    $tree = [];
    foreach (preg_split("/\r?\n/", $text) as $line) {
        $parts = array_map('trim', explode(';', $line));
        if (count($parts) >= 1 && $parts[0] !== '') {
            $tree[$parts[0]] = [
                'sire' => $parts[1] ?? null,
                'dam'  => $parts[2] ?? null
            ];
        }
    }
    return $tree;
}

function ancestors($tree, $name, $gen, $maxGen) {
    if ($gen > $maxGen || !$name) return [];
    if (!isset($tree[$name])) return [];
    $res = [];
    foreach (['sire','dam'] as $side) {
        $parent = $tree[$name][$side];
        if ($parent) {
            $res[$parent] = $gen;
            $res = array_merge($res, ancestors($tree, $parent, $gen+1, $maxGen));
        }
    }
    return $res;
}

function coi_wright($tree, $sire, $dam, $gens = 5) {
    $ancS = ancestors($tree, $sire, 1, $gens);
    $ancD = ancestors($tree, $dam, 1, $gens);
    $common = array_intersect_key($ancS, $ancD);
    $F = 0.0;
    foreach ($common as $ancestor => $_) {
        $n1 = $ancS[$ancestor];
        $n2 = $ancD[$ancestor];
        $F += pow(0.5, $n1 + $n2 + 1); // F_A supposé = 0
    }
    return $F;
}

// --- Variables ---
$result = null;
$pasted = $_POST['pasted'] ?? '';
$url = $_POST['url'] ?? '';

if ($_SERVER['REQUEST_METHOD']==='POST') {
    $sire = trim($_POST['sire'] ?? '');
    $dam  = trim($_POST['dam'] ?? '');
    $gens = max(3, min(5, (int)($_POST['gens'] ?? 5)));

    // Parser si texte collé
    $tree = [];
    if ($pasted) $tree = parse_pedigree($pasted);

    // Import depuis Pedigree Setter Anglais si URL fournie
    if ($url) {
        $html = @file_get_contents($url);
        if ($html !== false) {
            preg_match_all('/<td class="TabGene"[^>]*>(.*?)<\/td>/si', $html, $matches);
            $lines = [];
            foreach ($matches[1] as $block) {
                if (preg_match('/<a[^>]*>([^<]+)<\/a>/', $block, $m)) {
                    $name = trim($m[1]);
                } else {
                    $name = trim(strip_tags($block));
                }
                if ($name && strtolower($name) !== "inconnu") {
                    $lines[] = "$name;;";
                }
            }
            if ($lines) {
                $pasted .= "\n".implode("\n", $lines);
                $tree = parse_pedigree($pasted);
            }
        }
    }

    if ($sire && $dam && $tree) {
        $result = round(coi_wright($tree, $sire, $dam, $gens) * 100, 2);
    }
}
?>

<h1 class="h4">Calcul du COI (Wright)</h1>
<p class="text-muted">Calcule le COI sur 3–5 générations. Import possible par collage du pedigree (<code>Nom;Père;Mère</code>) ou en saisissant une URL Setter-Anglais.fr.</p>

<form method="post" class="row g-3 mb-3">
  <div class="col-md-4">
    <label class="form-label">Père (nom)</label>
    <input class="form-control" name="sire" value="<?php echo htmlspecialchars($_POST['sire'] ?? ''); ?>">
  </div>
  <div class="col-md-4">
    <label class="form-label">Mère (nom)</label>
    <input class="form-control" name="dam" value="<?php echo htmlspecialchars($_POST['dam'] ?? ''); ?>">
  </div>
  <div class="col-md-4">
    <label class="form-label">Générations</label>
    <select class="form-select" name="gens">
      <?php for($g=3;$g<=5;$g++): ?>
        <option value="<?php echo $g; ?>" <?php if(($g==(int)($_POST['gens'] ?? 5))) echo 'selected'; ?>><?php echo $g; ?></option>
      <?php endfor; ?>
    </select>
  </div>
  <div class="col-12">
    <label class="form-label">Pedigree (Nom;Père;Mère, un par ligne)</label>
    <textarea class="form-control" name="pasted" rows="6"><?php echo htmlspecialchars($pasted); ?></textarea>
  </div>
  <div class="col-12">
    <label class="form-label">Importer pedigree depuis Pedigree Setter Anglais</label>
    <input type="url" class="form-control" name="url" value="<?php echo htmlspecialchars($_POST['url'] ?? ''); ?>" placeholder="https://pedigree.setter-anglais.fr/genealogie/arbre.php?id=304300">
  </div>
  <div class="col-12">
    <button class="btn btn-primary">Calculer</button>
  </div>
</form>

<?php if($result !== null): ?>
  <div class="alert alert-success">COI estimé : <strong><?php echo $result; ?>%</strong></div>
<?php endif; ?>

<?php require __DIR__ . '/../includes/footer.php'; ?>
