// services/gateway/src/routes/portfolio.js
// All portfolio, holdings, trade, and square-off endpoints.

const { Router } = require('express');
const pool = require('../db');
const { getLatestPrices } = require('../pricePoller');

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPriceMap() {
  return getLatestPrices().reduce((m, c) => {
    m[c.id] = c.price_usd;
    return m;
  }, {});
}

function calcUnrealizedPnl(holding, currentPrice) {
  const qty = parseFloat(holding.quantity);
  const avg = parseFloat(holding.avg_buy_price);
  if (holding.position_type === 'long') return (currentPrice - avg) * qty;
  return (avg - currentPrice) * qty;
}

function calcUnrealizedPct(holding, currentPrice) {
  const avg = parseFloat(holding.avg_buy_price);
  if (avg === 0) return 0;
  if (holding.position_type === 'long') return ((currentPrice - avg) / avg) * 100;
  return ((avg - currentPrice) / avg) * 100;
}

function validateBody(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return `Missing required field: ${f}`;
    }
  }
  return null;
}

// ─── GET /api/portfolio/init ──────────────────────────────────────────────────
// Called by frontend on first load to ensure a default portfolio exists.
router.get('/init', async (req, res) => {
  try {
    let { rows } = await pool.query('SELECT id FROM portfolios LIMIT 1');
    if (rows.length === 0) {
      const ins = await pool.query(
        "INSERT INTO portfolios (name, currency) VALUES ('My Portfolio', 'USD') RETURNING id"
      );
      rows = ins.rows;
    }
    res.json({ portfolioId: rows[0].id });
  } catch (err) {
    console.error('[portfolio] /init error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET /api/portfolio/:portfolioId ─────────────────────────────────────────
router.get('/:portfolioId', async (req, res) => {
  const { portfolioId } = req.params;
  const priceMap = getPriceMap();

  try {
    const [portRes, holdRes, closedRes] = await Promise.all([
      pool.query('SELECT * FROM portfolios WHERE id = $1', [portfolioId]),
      pool.query('SELECT * FROM holdings WHERE portfolio_id = $1 ORDER BY opened_at', [portfolioId]),
      pool.query(
        'SELECT COALESCE(SUM(realized_pnl),0) AS total FROM closed_positions WHERE portfolio_id = $1',
        [portfolioId]
      ),
    ]);

    if (!portRes.rows.length) return res.status(404).json({ error: 'Portfolio not found' });

    const holdings = holdRes.rows.map(h => {
      const cur = priceMap[h.coin_id] ?? 0;
      return {
        ...h,
        current_price:    cur,
        unrealized_pnl:   calcUnrealizedPnl(h, cur),
        unrealized_pct:   calcUnrealizedPct(h, cur),
      };
    });

    const totalValue      = holdings.filter(h => h.position_type === 'long')
                              .reduce((s, h) => s + h.current_price * parseFloat(h.quantity), 0);
    const totalUnrealized = holdings.reduce((s, h) => s + h.unrealized_pnl, 0);
    const totalRealized   = parseFloat(closedRes.rows[0].total);

    res.json({
      portfolio:         portRes.rows[0],
      holdings,
      total_value:       totalValue,
      total_unrealized:  totalUnrealized,
      total_realized:    totalRealized,
    });
  } catch (err) {
    console.error('[portfolio] GET error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET /api/portfolio/:portfolioId/trades ───────────────────────────────────
router.get('/:portfolioId/trades', async (req, res) => {
  const { portfolioId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(   parseInt(req.query.limit || '50', 10), 200);
  const offset = (page - 1) * limit;
  const coin   = req.query.coin || null;

  try {
    const params = [portfolioId, limit, offset];
    const coinFilter = coin ? ` AND coin_id = $4` : '';
    if (coin) params.push(coin);

    const { rows } = await pool.query(
      `SELECT * FROM trades
        WHERE portfolio_id = $1${coinFilter}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      params
    );
    res.json({ trades: rows, page, limit });
  } catch (err) {
    console.error('[portfolio] /trades error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET /api/portfolio/:portfolioId/closed ───────────────────────────────────
router.get('/:portfolioId/closed', async (req, res) => {
  const { portfolioId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM closed_positions WHERE portfolio_id = $1 ORDER BY closed_at DESC',
      [portfolioId]
    );
    res.json({ closed_positions: rows });
  } catch (err) {
    console.error('[portfolio] /closed error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── POST /api/portfolio/:portfolioId/trade ───────────────────────────────────
router.post('/:portfolioId/trade', async (req, res) => {
  const { portfolioId } = req.params;
  const err = validateBody(req.body, ['coinId', 'symbol', 'type', 'quantity', 'price']);
  if (err) return res.status(400).json({ error: err });

  const { coinId, symbol, type, notes } = req.body;
  const quantity = parseFloat(req.body.quantity);
  const price    = parseFloat(req.body.price);
  const fee      = parseFloat(req.body.fee || 0);

  if (!['buy', 'sell', 'short', 'cover'].includes(type))
    return res.status(400).json({ error: 'type must be one of: buy, sell, short, cover' });
  if (isNaN(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be > 0' });
  if (isNaN(price)    || price    <= 0) return res.status(400).json({ error: 'price must be > 0'    });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let holdingId = null;

    // ── BUY ──────────────────────────────────────────────────────────────────
    if (type === 'buy') {
      const { rows } = await client.query(
        "SELECT * FROM holdings WHERE portfolio_id=$1 AND coin_id=$2 AND position_type='long'",
        [portfolioId, coinId]
      );
      if (rows.length) {
        const h = rows[0];
        const newQty = parseFloat(h.quantity) + quantity;
        const newAvg = (parseFloat(h.quantity) * parseFloat(h.avg_buy_price) + quantity * price) / newQty;
        await client.query(
          'UPDATE holdings SET quantity=$1, avg_buy_price=$2, updated_at=NOW() WHERE id=$3',
          [newQty, newAvg, h.id]
        );
        holdingId = h.id;
      } else {
        const ins = await client.query(
          "INSERT INTO holdings (portfolio_id,coin_id,coin_symbol,quantity,avg_buy_price,position_type) VALUES($1,$2,$3,$4,$5,'long') RETURNING id",
          [portfolioId, coinId, symbol, quantity, price]
        );
        holdingId = ins.rows[0].id;
      }
    }

    // ── SELL ─────────────────────────────────────────────────────────────────
    else if (type === 'sell') {
      const { rows } = await client.query(
        "SELECT * FROM holdings WHERE portfolio_id=$1 AND coin_id=$2 AND position_type='long'",
        [portfolioId, coinId]
      );
      if (!rows.length) throw Object.assign(new Error('No long position found for this coin'), { status: 400 });
      const h = rows[0];
      if (parseFloat(h.quantity) < quantity)
        throw Object.assign(new Error(`Insufficient quantity. Have: ${h.quantity}`), { status: 400 });

      holdingId = h.id;
      if (parseFloat(h.quantity) === quantity) {
        // Full close
        const realizedPnl = (price - parseFloat(h.avg_buy_price)) * quantity;
        await client.query('DELETE FROM holdings WHERE id=$1', [h.id]);
        await client.query(
          `INSERT INTO closed_positions
             (portfolio_id,coin_id,coin_symbol,position_type,quantity,entry_price,exit_price,realized_pnl,opened_at)
           VALUES ($1,$2,$3,'long',$4,$5,$6,$7,$8)`,
          [portfolioId, coinId, symbol, quantity, h.avg_buy_price, price, realizedPnl, h.opened_at]
        );
        holdingId = null;
      } else {
        await client.query(
          'UPDATE holdings SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2',
          [quantity, h.id]
        );
      }
    }

    // ── SHORT ─────────────────────────────────────────────────────────────────
    else if (type === 'short') {
      const { rows } = await client.query(
        "SELECT * FROM holdings WHERE portfolio_id=$1 AND coin_id=$2 AND position_type='short'",
        [portfolioId, coinId]
      );
      if (rows.length) {
        const h = rows[0];
        const newQty = parseFloat(h.quantity) + quantity;
        const newAvg = (parseFloat(h.quantity) * parseFloat(h.avg_buy_price) + quantity * price) / newQty;
        await client.query(
          'UPDATE holdings SET quantity=$1, avg_buy_price=$2, updated_at=NOW() WHERE id=$3',
          [newQty, newAvg, h.id]
        );
        holdingId = h.id;
      } else {
        const ins = await client.query(
          "INSERT INTO holdings (portfolio_id,coin_id,coin_symbol,quantity,avg_buy_price,position_type) VALUES($1,$2,$3,$4,$5,'short') RETURNING id",
          [portfolioId, coinId, symbol, quantity, price]
        );
        holdingId = ins.rows[0].id;
      }
    }

    // ── COVER ─────────────────────────────────────────────────────────────────
    else if (type === 'cover') {
      const { rows } = await client.query(
        "SELECT * FROM holdings WHERE portfolio_id=$1 AND coin_id=$2 AND position_type='short'",
        [portfolioId, coinId]
      );
      if (!rows.length) throw Object.assign(new Error('No short position found for this coin'), { status: 400 });
      const h = rows[0];
      if (parseFloat(h.quantity) < quantity)
        throw Object.assign(new Error(`Insufficient quantity. Have: ${h.quantity}`), { status: 400 });

      holdingId = h.id;
      if (parseFloat(h.quantity) === quantity) {
        // Full close
        const realizedPnl = (parseFloat(h.avg_buy_price) - price) * quantity;
        await client.query('DELETE FROM holdings WHERE id=$1', [h.id]);
        await client.query(
          `INSERT INTO closed_positions
             (portfolio_id,coin_id,coin_symbol,position_type,quantity,entry_price,exit_price,realized_pnl,opened_at)
           VALUES ($1,$2,$3,'short',$4,$5,$6,$7,$8)`,
          [portfolioId, coinId, symbol, quantity, h.avg_buy_price, price, realizedPnl, h.opened_at]
        );
        holdingId = null;
      } else {
        await client.query(
          'UPDATE holdings SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2',
          [quantity, h.id]
        );
      }
    }

    // Record the trade
    const tradeRes = await client.query(
      `INSERT INTO trades
         (portfolio_id,holding_id,coin_id,coin_symbol,trade_type,quantity,price,total_value,fee,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [portfolioId, holdingId, coinId, symbol, type, quantity, price, quantity * price, fee, notes ?? null]
    );

    await client.query('COMMIT');
    res.status(201).json({ trade: tradeRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    console.error('[portfolio] /trade error:', err.message);
    res.status(status).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/portfolio/:portfolioId/squareoff ───────────────────────────────
router.post('/:portfolioId/squareoff', async (req, res) => {
  const { portfolioId } = req.params;
  const priceMap = getPriceMap();

  const { rows: holdings } = await pool.query(
    'SELECT * FROM holdings WHERE portfolio_id = $1',
    [portfolioId]
  );
  if (!holdings.length) return res.status(400).json({ error: 'No open positions to square off' });

  const client = await pool.connect();
  const results = [];
  try {
    await client.query('BEGIN');

    for (const h of holdings) {
      const exitPrice = priceMap[h.coin_id];
      if (!exitPrice) throw new Error(`Price unavailable for ${h.coin_id} — aborting square off`);

      const qty          = parseFloat(h.quantity);
      const avg          = parseFloat(h.avg_buy_price);
      const pnl          = h.position_type === 'long'
        ? (exitPrice - avg) * qty
        : (avg - exitPrice) * qty;
      const tradeType    = h.position_type === 'long' ? 'sell' : 'cover';

      await client.query('DELETE FROM holdings WHERE id=$1', [h.id]);
      await client.query(
        `INSERT INTO closed_positions
           (portfolio_id,coin_id,coin_symbol,position_type,quantity,entry_price,exit_price,realized_pnl,opened_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [portfolioId, h.coin_id, h.coin_symbol, h.position_type, qty, avg, exitPrice, pnl, h.opened_at]
      );
      await client.query(
        `INSERT INTO trades
           (portfolio_id,coin_id,coin_symbol,trade_type,quantity,price,total_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [portfolioId, h.coin_id, h.coin_symbol, tradeType, qty, exitPrice, qty * exitPrice]
      );

      results.push({ coinId: h.coin_id, symbol: h.coin_symbol, pnl, quantity: qty, exitPrice });
    }

    await client.query('COMMIT');
    res.json({ closed: results, total_pnl: results.reduce((s, r) => s + r.pnl, 0) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[portfolio] /squareoff error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
