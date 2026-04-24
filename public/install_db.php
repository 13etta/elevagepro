<?php
// 1. On charge la connexion à la base de données Render
require '../includes/config.php';

try {
    // 2. On lit le contenu entier du fichier schema.sql
    $sql = file_get_contents('../sql/schema.sql');
    
    if ($sql === false) {
        die("Erreur : Impossible de lire le fichier schema.sql");
    }

    // 3. On exécute toutes les requêtes SQL d'un coup
    $pdo->exec($sql);
    
    echo "<h1>Succès !</h1>";
    echo "<p>La base de données a été initialisée avec toutes les tables.</p>";
    echo "<p>L'utilisateur administrateur (admin@elevage.local) a été créé.</p>";
    echo "<p style='color: red; font-weight: bold;'>SÉCURITÉ : Supprime immédiatement ce fichier (install_db.php) de ton code source et refais un push.</p>";
    echo '<a href="/">Retourner à l\'accueil</a>';

} catch (PDOException $e) {
    echo "<h1>Erreur lors de l'installation :</h1>";
    echo "<pre>" . e($e->getMessage()) . "</pre>";
}