# AyushCryptoTracker

A real-time cryptocurrency portfolio management platform built with Node.js microservices and React.

Track live crypto prices, manage your portfolio, set price alerts, convert currencies, and explore the Ethereum blockchain — all in one place.

**Live → https://ayushcryptotracker.vercel.app**

---

## What it does

- Live prices for 12 cryptocurrencies updating every 60 seconds via WebSockets
- Execute trades — Buy, Sell, Short, Cover — with real-time P&L tracking
- P&L calculator showing projected profit, max loss and risk/reward before trading
- Price alerts that auto-trigger in the background when a coin hits your target
- Fiat and crypto currency converter
- Ethereum blockchain explorer — live gas fees, wallet balance checker, transaction lookup

---

## Tech Stack

**Frontend** — React, Vite, Tailwind CSS, Recharts

**Backend** — Node.js, Express, PostgreSQL, Redis, WebSockets

**APIs** — CoinGecko, Frankfurter, Etherscan

**Hosting** — Render, Vercel, Neon, Upstash

---

## Run Locally

```bash
# Tab 1
cd services/price-service && npm start

# Tab 2
cd services/gateway && npm start

# Tab 3
cd services/notifier && npm start

# Tab 4
cd frontend && npm run dev
```

Open **http://localhost:5173**
