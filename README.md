# CryptoTracker Pro

Real-time cryptocurrency portfolio management platform built with Node.js microservices and a React frontend.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  CoinGecko API ──┐                                             │
│  Frankfurter  ──►│  Price Service :3002  (polling, cache)     │
│                  └──────────────────┬──────────────────────── │
│                                     │ HTTP GET /prices every 60s
│  Frontend :5173 ◄──── WebSocket ────┤                         │
│      │                              ▼                         │
│      └──── REST ──────► Gateway :3001 ──► PostgreSQL (Neon)   │
│                             │                                  │
│                             └──► Redis pub/sub (Upstash)      │
│                                         │                     │
│                              Notifier :3003 (subscriber)      │
│                                         │                     │
│                                         └──► PostgreSQL       │
└────────────────────────────────────────────────────────────────┘
```

| Service       | Port | Role                                      | Deploy     |
|---------------|------|-------------------------------------------|------------|
| Price Service | 3002 | Polls CoinGecko + Frankfurter, caches data | Render     |
| Gateway       | 3001 | REST API + WebSocket + DB writes           | Render     |
| Notifier      | 3003 | Alert evaluation via Redis pub/sub         | Render     |
| Frontend      | 5173 | React SPA — 4 tabs                        | Vercel     |

---

## Local Development

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 20+

### 1. Clone and set up environment files

```bash
git clone https://github.com/your-org/cryptotracker-nodejs.git
cd cryptotracker-nodejs

# Copy env examples
cp services/price-service/.env.example services/price-service/.env
cp services/gateway/.env.example        services/gateway/.env
cp services/notifier/.env.example       services/notifier/.env
cp frontend/.env.example                frontend/.env.local
```

### 2. Start backend services + databases

```bash
# Starts postgres, redis, price-service, gateway, notifier
docker-compose up -d

# Watch logs
docker-compose logs -f gateway
```

### 3. Run database migrations

```bash
docker-compose exec gateway node /app/../../../database/migrate.js
# Or locally:
DATABASE_URL=postgresql://cryptouser:cryptopass@localhost:5432/cryptotracker node database/migrate.js
```

### 4. Start the frontend (hot reload)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Production Deployment

### Infrastructure Setup (order matters)

**Step 1 — Neon PostgreSQL**
1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project → copy the connection string
3. Run migrations: `psql $DATABASE_URL -f database/init.sql`
4. Enable PgBouncer connection pooling in the Neon dashboard

**Step 2 — Upstash Redis**
1. Create a free account at [upstash.com](https://upstash.com)
2. Create a Redis database → copy the `rediss://` URL (TLS required)

**Step 3 — Deploy Price Service to Render**
1. Create a new Web Service from the `services/price-service` directory
2. Build command: `npm ci`
3. Start command: `node src/index.js`
4. No env vars required except `PORT=3002` (set automatically by Render)
5. Note the service URL (e.g. `https://cryptotracker-price.onrender.com`)

**Step 4 — Deploy Gateway to Render**
1. Create a new Web Service from `services/gateway`
2. Set environment variables:
   - `DATABASE_URL` → Neon connection string
   - `REDIS_URL` → Upstash `rediss://` URL
   - `PRICE_SERVICE_URL` → Price Service URL from Step 3
   - `CORS_ORIGIN` → Vercel frontend URL (set after Step 6, update later)
3. Enable **WebSocket support** in Render service settings

**Step 5 — Deploy Notifier to Render**
1. Create a new Web Service from `services/notifier`
2. Set `DATABASE_URL` and `REDIS_URL`

**Step 6 — Deploy Frontend to Vercel**
1. Import the `frontend` directory from GitHub
2. Set environment variables:
   - `VITE_API_URL` → Gateway URL from Step 4
   - `VITE_WS_URL` → Gateway URL with `wss://` scheme
3. Vercel auto-deploys on every push to `main`

**Step 7 — Update CORS**
Update `CORS_ORIGIN` in Gateway env vars to the Vercel URL.

### Preventing Cold Starts (Render free tier)
Render free services sleep after 15 min of inactivity. Set up a free cron at [cron-job.org](https://cron-job.org) to ping `/health` on Gateway and Price Service every 14 minutes.

---

## CI/CD

Push to `main` → GitHub Actions runs lint/build for all services → triggers Render deploy hooks.

**Required GitHub Secrets:**
- `RENDER_PRICE_HOOK` — Render deploy hook URL for Price Service
- `RENDER_GATEWAY_HOOK` — Render deploy hook URL for Gateway
- `RENDER_NOTIFIER_HOOK` — Render deploy hook URL for Notifier

---

## API Reference

### Market
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/prices` | All live coin prices |
| GET | `/api/market/history/:coinId?limit=100` | Price history for charting |
| GET | `/api/market/rates` | Fiat exchange rates (base USD) |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio/init` | Create default portfolio if needed |
| GET | `/api/portfolio/:id` | Full portfolio with unrealized P&L |
| GET | `/api/portfolio/:id/trades` | Paginated trade history |
| GET | `/api/portfolio/:id/closed` | Closed positions + realized P&L |
| POST | `/api/portfolio/:id/trade` | Execute buy/sell/short/cover |
| POST | `/api/portfolio/:id/squareoff` | Close all positions at market price |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts/:portfolioId?status=active` | List alerts |
| POST | `/api/alerts/:portfolioId` | Create alert |
| DELETE | `/api/alerts/:alertId` | Delete alert |

### WebSocket (`ws://gateway/ws`)
```json
// Server → client
{ "type": "prices", "data": [...coins], "timestamp": "2024-01-01T00:00:00Z" }

// Client → server (keep-alive)
{ "type": "ping" }
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js 20, Express 4, ws, pg, ioredis |
| Database | PostgreSQL 16 on Neon (free tier) |
| Cache/Pub-Sub | Redis 7 on Upstash (free tier) |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts |
| External APIs | CoinGecko (prices), Frankfurter (fiat rates) |
| Hosting | Render (backend), Vercel (frontend) |

---

## Known Limitations (v1)
- No authentication — single-user, single-portfolio
- Render free tier cold starts (30–60s after 15 min idle)
- Alerts only update in the DB; no push notifications yet
- `price_history` table grows indefinitely — run the cleanup query in `init.sql` periodically
