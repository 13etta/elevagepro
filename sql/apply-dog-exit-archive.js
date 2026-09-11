// Historical archive scripts must never be replayed implicitly on a populated database.
console.error('Commande historique désactivée. Utiliser npm run db:check puis les migrations versionnées validées en préproduction.');
process.exitCode = 1;
