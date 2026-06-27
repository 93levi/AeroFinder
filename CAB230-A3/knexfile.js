require('dotenv').config();

// Managed MySQL providers (Aiven, TiDB Cloud, etc.) require a TLS connection.
// Set DB_SSL=true in production. rejectUnauthorized:false keeps the traffic
// encrypted without having to ship a provider-specific CA certificate.
const useSsl = process.env.DB_SSL === 'true';

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
  },
  // Keep the pool small — free DB tiers cap concurrent connections.
  pool: { min: 0, max: 5 }
};
