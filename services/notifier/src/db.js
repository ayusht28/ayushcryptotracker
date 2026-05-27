// services/notifier/src/db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,   // Notifier is low-frequency; keep pool small
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', err => console.error('[notifier:db] Client error:', err.message));

module.exports = pool;
