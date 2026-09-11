// URL SSL parameters otherwise override node-postgres's explicit TLS settings.
function databaseOptions(env = process.env) {
  let connectionString = env.DATABASE_URL;
  if (connectionString) {
    const url = new URL(connectionString);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
    connectionString = url.toString();
  }
  const ssl = env.DATABASE_SSL === 'false' ? false : {
    rejectUnauthorized: true,
    ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}),
  };
  if (env.NODE_ENV === 'production' && ssl === false) throw new Error('TLS PostgreSQL obligatoire en production.');
  return { connectionString, ssl, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 };
}
module.exports = { databaseOptions };
