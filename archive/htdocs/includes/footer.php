<?php
// Charger les infos éleveur
$stmt = $pdo->query("SELECT * FROM breeder LIMIT 1");
$breeder = $stmt->fetch(PDO::FETCH_ASSOC);
?>
    </div> <!-- fermeture du .container ouverte dans header -->

    <footer class="mt-5 py-3 border-top text-center small 
        <?= ($breeder['theme'] ?? 'light') === 'dark' ? 'bg-dark text-light' : 'bg-light text-muted' ?>">
        
        <?php if (!empty($breeder['logo'])): ?>
            <div class="mb-2">
                <img src="/uploads/<?= htmlspecialchars($breeder['logo']) ?>" 
                     alt="Logo élevage" height="40" class="rounded">
            </div>
        <?php endif; ?>

        <div>
            <strong><?= htmlspecialchars($breeder['name'] ?? 'Mon Élevage') ?></strong><br>
            <?= htmlspecialchars(($breeder['first_name'] ?? '') . ' ' . ($breeder['last_name'] ?? '')) ?><br>
            <?php if (!empty($breeder['siret'])): ?>
                SIRET : <?= htmlspecialchars($breeder['siret']) ?><br>
            <?php endif; ?>
            <?php if (!empty($breeder['producer_number'])): ?>
                N° Producteur : <?= htmlspecialchars($breeder['producer_number']) ?><br>
            <?php endif; ?>
        </div>

        <div class="mt-2">
            &copy; <?= date('Y') ?> - Tous droits réservés
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
