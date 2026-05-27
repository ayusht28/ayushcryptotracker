// frontend/src/api/gateway.js
// Central module for all HTTP calls to the Gateway REST API.
// Import individual functions wherever needed — no global state here.

import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// ─── Market ───────────────────────────────────────────────────────────────────

export const fetchPrices = () =>
  api.get('/api/market/prices').then(r => r.data);

export const fetchHistory = (coinId, limit = 100) =>
  api.get(`/api/market/history/${coinId}`, { params: { limit } }).then(r => r.data);

export const fetchRates = () =>
  api.get('/api/market/rates').then(r => r.data);

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const initPortfolio = () =>
  api.get('/api/portfolio/init').then(r => r.data);

export const fetchPortfolio = (portfolioId) =>
  api.get(`/api/portfolio/${portfolioId}`).then(r => r.data);

export const fetchTrades = (portfolioId, params = {}) =>
  api.get(`/api/portfolio/${portfolioId}/trades`, { params }).then(r => r.data);

export const fetchClosedPositions = (portfolioId) =>
  api.get(`/api/portfolio/${portfolioId}/closed`).then(r => r.data);

export const executeTrade = (portfolioId, body) =>
  api.post(`/api/portfolio/${portfolioId}/trade`, body).then(r => r.data);

export const squareOffAll = (portfolioId) =>
  api.post(`/api/portfolio/${portfolioId}/squareoff`).then(r => r.data);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const fetchAlerts = (portfolioId, status) =>
  api.get(`/api/alerts/${portfolioId}`, { params: status ? { status } : {} }).then(r => r.data);

export const createAlert = (portfolioId, body) =>
  api.post(`/api/alerts/${portfolioId}`, body).then(r => r.data);

export const deleteAlert = (alertId) =>
  api.delete(`/api/alerts/${alertId}`).then(r => r.data);

// ─── Error helper ─────────────────────────────────────────────────────────────

export function getErrorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Unknown error';
}
