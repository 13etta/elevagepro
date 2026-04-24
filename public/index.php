<?php
/**
 * public/index.php
 */
require_once '../includes/helpers.php';
require_once '../includes/layout.php';

require_login();

render_header('Tableau de bord');
flash();
?>

<section class="dashboard-grid">
    <div class="stat-card">
        <h3>Chiens</h3>
        <p class="number"><?= count_table('dogs') ?></p>
    </div>
    <div class="stat-card">
        <h3>Portées</h3>
        <p class="number"><?= count_table('litters') ?></p>
    </div>
    <div class="stat-card">
        <h3>Chiots disponibles</h3>
        <p class="number"><?= count_table('puppies') ?></p>
    </div>
    <div class="stat-card">
        <h3>Ventes</h3>
        <p class="number"><?= count_table('sales') ?></p>
    </div>
</section>

<?php render_footer(); ?>