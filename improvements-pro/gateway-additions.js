// Add these functions to frontend/src/api/gateway.js

export const listPortfolios = () =>
  api.get('/api/portfolios/list').then(r => r.data);

export const createPortfolio = (name, currency) =>
  api.post('/api/portfolios/create', { name, currency }).then(r => r.data);

export const renamePortfolio = (portfolioId, name) =>
  api.put(`/api/portfolios/${portfolioId}/rename`, { name }).then(r => r.data);

export const deletePortfolio = (portfolioId) =>
  api.delete(`/api/portfolios/${portfolioId}`).then(r => r.data);
