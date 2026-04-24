<?php $user = current_user(); ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Logiciel Élevage</title>
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<?php if ($user): ?>
<aside class="sidebar">
    <div class="brand">ÉLEVAGE<span>PRO</span></div>
    <nav>
        <a href="/?page=dashboard">Tableau de bord</a>
        <a href="/?page=dogs">Chiens</a>
        <a href="/?page=heats">Chaleurs</a>
        <a href="/?page=matings">Saillies</a>
        <a href="/?page=pregnancies">Gestations</a>
        <a href="/?page=litters">Portées</a>
        <a href="/?page=puppies">Chiots</a>
        <a href="/?page=soins">Soins</a>
        <a href="/?page=sales">Ventes</a>
        <a href="/?page=reminders">Rappels</a>
        <a href="/?page=breeder">Élevage</a>
        <a href="/?page=logout">Déconnexion</a>
    </nav>
</aside>
<main class="main">
<?php else: ?>
<main class="login-main">
<?php endif; ?>
