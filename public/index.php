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

<div class="stats-overview">
    <div class="card stat-box">
        <span class="label">Mes Chiens</span>
        <span class="value"><?= count_table('dogs') ?></span>
    </div>
    <div class="card stat-box">
        <span class="label">Portées actives</span>
        <span class="value"><?= count_table('litters') ?></span>
    </div>
    <div class="card stat-box">
        <span class="label">Rappels urgents</span>
        <span class="value danger">2</span> </div>
    <div class="card stat-box">
        <span class="label">Ventes du mois</span>
        <span class="value">0.00 €</span> </div>
</div>

<div class="dashboard-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 20px;">
    <div class="card">
        <h2>Dernières activités</h2>
        <p style="color: #a0aec0;">Aucune activité récente pour le moment.</p>
    </div>
    <div class="card">
        <h2>Rappels à venir</h2>
        <ul class="reminder-list" style="list-style: none; padding: 0;">
            <li style="padding: 10px 0; border-bottom: 1px solid #4a5568;">
                <strong>Vaccin</strong> - Chien Alpha<br>
                <small style="color: #a0aec0;">Dans 3 jours</small>
            </li>
        </ul>
    </div>
</div>

<?php render_footer(); ?>