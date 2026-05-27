-- ============================================================
--  CryptoTracker Pro — Database Initialisation
--  Run once against your Neon PostgreSQL instance
--  psql $DATABASE_URL -f database/init.sql
-- ============================================================

-- 1. portfolios ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolios (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  currency    VARCHAR(10)   NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed a default portfolio so the app works out of the box
INSERT INTO portfolios (name, currency)
SELECT 'My Portfolio', 'USD'
WHERE NOT EXISTS (SELECT 1 FROM portfolios LIMIT 1);

-- 2. holdings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  id             SERIAL          PRIMARY KEY,
  portfolio_id   INTEGER         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  coin_id        VARCHAR(50)     NOT NULL,
  coin_symbol    VARCHAR(20)     NOT NULL,
  quantity       DECIMAL(18,8)   NOT NULL,
  avg_buy_price  DECIMAL(18,8)   NOT NULL,
  position_type  VARCHAR(10)     NOT NULL CHECK (position_type IN ('long','short')),
  opened_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS holdings_unique_position
  ON holdings (portfolio_id, coin_id, position_type);

-- 3. trades ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id            SERIAL          PRIMARY KEY,
  portfolio_id  INTEGER         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  holding_id    INTEGER         REFERENCES holdings(id) ON DELETE SET NULL,
  coin_id       VARCHAR(50)     NOT NULL,
  coin_symbol   VARCHAR(20)     NOT NULL,
  trade_type    VARCHAR(20)     NOT NULL CHECK (trade_type IN ('buy','sell','short','cover')),
  quantity      DECIMAL(18,8)   NOT NULL,
  price         DECIMAL(18,8)   NOT NULL,
  total_value   DECIMAL(18,8)   NOT NULL,
  fee           DECIMAL(18,8)   NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 4. closed_positions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS closed_positions (
  id             SERIAL          PRIMARY KEY,
  portfolio_id   INTEGER         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  coin_id        VARCHAR(50)     NOT NULL,
  coin_symbol    VARCHAR(20)     NOT NULL,
  position_type  VARCHAR(10)     NOT NULL CHECK (position_type IN ('long','short')),
  quantity       DECIMAL(18,8)   NOT NULL,
  entry_price    DECIMAL(18,8)   NOT NULL,
  exit_price     DECIMAL(18,8)   NOT NULL,
  realized_pnl   DECIMAL(18,8)   NOT NULL,
  opened_at      TIMESTAMPTZ     NOT NULL,
  closed_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 5. alerts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id            SERIAL          PRIMARY KEY,
  portfolio_id  INTEGER         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  coin_id       VARCHAR(50)     NOT NULL,
  coin_symbol   VARCHAR(20)     NOT NULL,
  condition     VARCHAR(10)     NOT NULL CHECK (condition IN ('above','below')),
  target_price  DECIMAL(18,8)   NOT NULL,
  status        VARCHAR(20)     NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered')),
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 6. price_history ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id           SERIAL          PRIMARY KEY,
  coin_id      VARCHAR(50)     NOT NULL,
  coin_symbol  VARCHAR(20)     NOT NULL,
  price_usd    DECIMAL(18,8)   NOT NULL,
  market_cap   DECIMAL(24,2),
  volume_24h   DECIMAL(24,2),
  change_24h   DECIMAL(10,4),
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_history_coin_time
  ON price_history (coin_id, created_at DESC);

-- Cleanup job hint: run periodically to prevent storage bloat
-- DELETE FROM price_history WHERE created_at < NOW() - INTERVAL '30 days';
