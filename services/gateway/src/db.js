// services/gateway/src/db.js
// Exports a single pg.Pool instance shared across all route handlers.
// Max pool size is 5 to stay within Neon's free-tier connection limit (10).

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] Unexpected client error:', err.message);
});

// Lightweight connectivity check used by /health
async function healthCheck() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.healthCheck = healthCheck;
