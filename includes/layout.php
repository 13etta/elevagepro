<?php
// Le layout charge les helpers, qui eux-mêmes chargent auth.php et config.php
require_once __DIR__ . '/helpers.php';

function render_header(string $title): void
{
    $user = current_user();
    ?>
    <!doctype html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= e($title) ?> · ElevagePro</title>
        <link rel="stylesheet" href="/assets/css/app.css">
        <script defer src="/assets/js/app.js"></script>
    </head>
    <body>
    <aside class="sidebar">
        <div class="brand">Elevage<span>Pro</span></div>
        <nav>
            <a href="/">Tableau de bord</a>
            <a href="/dogs.php">Chiens</a>
            <a href="/reproduction.php">Reproduction</a>
            <a href="/puppies.php">Chiots</a>
            <a href="/health.php">Santé</a>
            <a href="/weights.php">Poids</a>
            <a href="/disinfections.php">Désinfections</a>
            <a href="/reminders.php">Rappels</a>
            <a href="/sales.php">Ventes</a>
            <a href="/site_builder.php">Site automatique</a>
        </nav>
    </aside>
    <main class="main">
        <header class="topbar">
            <div>
                <p class="eyebrow">Cockpit cynotechnique</p>
                <h1><?= e($title) ?></h1>
            </div>
            <div class="userbox">
                <?= $user ? e($user['name']) . ' · Élevage #' . e($user['breeder_id']) : '' ?>
                <?php if ($user): ?><a href="/logout.php">Déconnexion</a><?php endif; ?>
            </div>
        </header>
    <?php
}

function render_footer(): void
{
    echo '</main></body></html>';
}

function flash(): void
{
    if (!empty($_SESSION['flash'])) {
        echo '<div class="flash">' . e($_SESSION['flash']) . '</div>';
        unset($_SESSION['flash']);
    }
}