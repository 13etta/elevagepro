<?php
ob_start(); // Active la temporisation de sortie (mise en cache) du HTML
require '../includes/auth.php'; // Vérifie la session
require '../includes/config.php'; // Connexion à la base de données

$page = $_GET['page'] ?? 'dashboard';
$publicPages = ['login','register'];

if (!in_array($page, $publicPages, true)) {
    require_login();
}

verify_csrf();

$routes = [
    'login' => '../src/login.php',
    'register' => '../src/register.php',
    'logout' => '../src/logout.php',
    'dashboard' => '../src/dashboard.php',
    'dogs' => '../src/dogs.php',
    'heats' => '../src/heats.php',
    'matings' => '../src/matings.php',
    'pregnancies' => '../src/pregnancies.php',
    'litters' => '../src/litters.php',
    'puppies' => '../src/puppies.php',
    'soins' => '../src/soins.php',
    'sales' => '../src/sales.php',
    'reminders' => '../src/reminders.php',
    'breeder' => '../src/breeder.php',
];

if (!isset($routes[$page])) {
    http_response_code(404);
    exit('Page introuvable.');
}

include '../src/layout_top.php';
include $routes[$page];
include '../src/layout_bottom.php';

ob_end_flush(); // Envoie tout le HTML généré au navigateur à la toute fin