const { Router } = require('express');
const pool = require('../db');

const router = Router();

router.get('/list', async function(req, res) {
  try {
    const result = await pool.query('SELECT * FROM portfolios ORDER BY created_at ASC');
    res.json({ portfolios: result.rows });
  } catch (err) {
    console.error('[portfolios] list error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/create', async function(req, res) {
  const { name, currency } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Portfolio name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO portfolios (name, currency) VALUES ($1, $2) RETURNING *',
      [name.trim(), currency || 'USD']
    );
    res.status(201).json({ portfolio: result.rows[0] });
  } catch (err) {
    console.error('[portfolios] create error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:portfolioId/rename', async function(req, res) {
  const { portfolioId } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Portfolio name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE portfolios SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), portfolioId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    res.json({ portfolio: result.rows[0] });
  } catch (err) {
    console.error('[portfolios] rename error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/:portfolioId', async function(req, res) {
  const { portfolioId } = req.params;

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM portfolios');
    if (parseInt(countResult.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete your only portfolio' });
    }

    const result = await pool.query('DELETE FROM portfolios WHERE id = $1', [portfolioId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('[portfolios] delete error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
