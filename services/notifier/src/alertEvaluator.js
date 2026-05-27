// services/notifier/src/alertEvaluator.js
// Called on every Redis 'price-updates' message.
// Queries ALL active alerts once, evaluates in memory, then bulk-updates
// triggered ones — far more efficient than N individual queries.

const pool = require('./db');

async function evaluateAlerts(priceMessage) {
  let payload;
  try {
    payload = JSON.parse(priceMessage);
  } catch {
    console.error('[alertEvaluator] Failed to parse message');
    return;
  }

  const { prices = [] } = payload;
  if (!prices.length) return;

  // Build a quick lookup map: coinId → price_usd
  const priceMap = prices.reduce((m, p) => {
    m[p.id] = parseFloat(p.price_usd);
    return m;
  }, {});

  let alerts;
  try {
    const { rows } = await pool.query("SELECT * FROM alerts WHERE status = 'active'");
    alerts = rows;
  } catch (err) {
    console.error('[alertEvaluator] DB fetch error:', err.message);
    return; // Do not crash — retry on next message
  }

  if (!alerts.length) return;

  // Evaluate each alert in memory — no per-alert DB calls
  const triggeredIds = [];
  for (const alert of alerts) {
    const current = priceMap[alert.coin_id];
    if (current === undefined) continue; // Coin not in this price batch

    const hit =
      (alert.condition === 'above' && current >= parseFloat(alert.target_price)) ||
      (alert.condition === 'below' && current <= parseFloat(alert.target_price));

    if (hit) triggeredIds.push(alert.id);
  }

  if (!triggeredIds.length) return;

  // Bulk UPDATE — idempotent: WHERE status='active' ensures we only trigger once
  try {
    await pool.query(
      `UPDATE alerts
          SET status = 'triggered', triggered_at = NOW()
        WHERE id = ANY($1::int[]) AND status = 'active'`,
      [triggeredIds]
    );
    console.log(`[alertEvaluator] ✓ Triggered ${triggeredIds.length} alert(s): IDs ${triggeredIds.join(', ')}`);

    // Future hook: send email/webhook here
    // triggeredIds.forEach(id => notifyUser(id));
  } catch (err) {
    console.error('[alertEvaluator] DB update error:', err.message);
    // Non-fatal — alerts will be re-evaluated on next price update
    // (UPDATE WHERE status='active' keeps idempotency intact)
  }
}

module.exports = { evaluateAlerts };
