<?php
/**
 * Template générique de liste
 * Variables attendues :
 * - $title (string) : titre de la page
 * - $icon (string) : classe d’icône Bootstrap Icons (ex: "bi-shield-shaded")
 * - $addUrl (string) : lien du bouton Ajouter
 * - $addLabel (string) : texte du bouton Ajouter
 * - $description (string, optionnel)
 * - $filters (array) : filtres à afficher
 * - $columns (array) : colonnes du tableau (clé => label)
 * - $rows (array) : données à afficher (résultats SQL)
 */
?>

<div class="container my-4">

  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-4">
    <div>
      <h1 class="h3 fw-bold mb-0"><i class="bi <?= $icon ?> me-2"></i> <?= $title ?></h1>
      <?php if (!empty($description)): ?>
        <small class="text-muted"><?= $description ?></small>
      <?php endif; ?>
    </div>
    <a class="btn btn-primary shadow-sm rounded-pill px-3" href="<?= $addUrl ?>">
      <i class="bi bi-plus-lg me-1"></i> <?= $addLabel ?>
    </a>
  </div>

  <!-- Filtres -->
  <?php if (!empty($filters)): ?>
  <div class="card shadow-sm mb-4">
    <div class="card-body">
      <form class="row g-2">
        <?php foreach ($filters as $filter): ?>
          <div class="col-md-<?= $filter['width'] ?? 3 ?>">
            <?php if (($filter['type'] ?? 'select') === 'select'): ?>
              <select name="<?= $filter['name'] ?>" class="form-select">
                <option value=""><?= $filter['label'] ?></option>
                <?php foreach ($filter['options'] as $val => $label): ?>
                  <option value="<?= $val ?>" <?= ($_GET[$filter['name']] ?? '')==$val?'selected':'' ?>>
                    <?= $label ?>
                  </option>
                <?php endforeach; ?>
              </select>
            <?php elseif ($filter['type']==='search'): ?>
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" name="<?= $filter['name'] ?>" 
                       class="form-control" placeholder="<?= $filter['placeholder'] ?? $filter['label'] ?>" 
                       value="<?= htmlspecialchars($_GET[$filter['name']] ?? '') ?>">
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
        <div class="col-md-2 d-flex gap-2">
          <button type="submit" class="btn btn-secondary w-100"><i class="bi bi-funnel"></i></button>
          <a href="<?= $_SERVER['PHP_SELF'] ?>" class="btn btn-light w-100"><i class="bi bi-x-circle"></i></a>
        </div>
      </form>
    </div>
  </div>
  <?php endif; ?>

  <!-- Table -->
  <div class="card shadow-sm">
    <div class="card-body table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <?php foreach ($columns as $label): ?>
              <th><?= $label ?></th>
            <?php endforeach; ?>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php if (!empty($rows)): ?>
            <?php foreach ($rows as $row): ?>
              <tr>
                <?php foreach ($columns as $key => $label): ?>
                  <td data-label="<?= $label ?>">
                    <?= htmlspecialchars($row[$key] ?? '-') ?>
                  </td>
                <?php endforeach; ?>
                <td class="text-end">
                  <a href="form.php?id=<?= $row['id'] ?>" 
                     class="btn btn-sm btn-light border action-btn" 
                     data-bs-toggle="tooltip" title="Modifier">
                    <i class="bi bi-pencil text-secondary"></i>
                  </a>
                  <a href="delete.php?id=<?= $row['id'] ?>" 
                     class="btn btn-sm btn-light border action-btn" 
                     data-bs-toggle="tooltip" title="Supprimer"
                     onclick="return confirm('Supprimer ?');">
                    <i class="bi bi-trash text-danger"></i>
                  </a>
                </td>
              </tr>
            <?php endforeach; ?>
          <?php else: ?>
            <tr><td colspan="<?= count($columns)+1 ?>" class="text-center text-muted">Aucune donnée trouvée.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
