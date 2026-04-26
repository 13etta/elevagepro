<?php
session_start();

// Vider la session
session_unset();
session_destroy();

// Redirection vers la page de connexion
header("Location: /auth/login.php");
exit;
