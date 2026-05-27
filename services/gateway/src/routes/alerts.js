// services/gateway/src/routes/alerts.js
// CRUD for price alerts. Evaluation is handled by the Notifier service.

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /api/alerts/:portfolioId?status=active
router.get('/:portfolioId', async (req, res) => {
  const { portfolioId } = req.params;
  const { status } = req.query;

  try {
    const params = [portfolioId];
    const statusFilter = status ? ' AND status = $2' : '';
    if (status) params.push(status);

    const { rows } = await pool.query(
      `SELECT * FROM alerts
        WHERE portfolio_id = $1${statusFilter}
        ORDER BY created_at DESC`,
      params
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error('[alerts] GET error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/alerts/:portfolioId
router.post('/:portfolioId', async (req, res) => {
  const { portfolioId } = req.params;
  const { coinId, symbol, condition, targetPrice } = req.body;

  if (!coinId || !symbol || !condition || targetPrice === undefined)
    return res.status(400).json({ error: 'Missing required fields: coinId, symbol, condition, targetPrice' });
  if (!['above', 'below'].includes(condition))
    return res.status(400).json({ error: 'condition must be "above" or "below"' });
  const tp = parseFloat(targetPrice);
  if (isNaN(tp) || tp <= 0)
    return res.status(400).json({ error: 'targetPrice must be a positive number' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO alerts (portfolio_id, coin_id, coin_symbol, condition, target_price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [portfolioId, coinId, symbol, condition, tp]
    );
    res.status(201).json({ alert: rows[0] });
  } catch (err) {
    console.error('[alerts] POST error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/alerts/:alertId
router.delete('/:alertId', async (req, res) => {
  const { alertId } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM alerts WHERE id = $1', [alertId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[alerts] DELETE error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
