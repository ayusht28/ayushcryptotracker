// services/price-service/src/cache.js
// Simple in-memory store for the latest prices and exchange rates.
// No Redis, no DB — just a plain JS object updated by the poller.

const cache = {
  coins: [],           // Array of coin price objects
  rates: {},           // Fiat exchange rates keyed by currency code
  lastCoinPoll: null,  // ISO timestamp of last successful CoinGecko fetch
  lastRatePoll: null,  // ISO timestamp of last successful Frankfurter fetch
  staleCoin: false,    // true when last CoinGecko call failed
  staleRate: false,    // true when last Frankfurter call failed
};

function setCoins(data) {
  cache.coins = data;
  cache.lastCoinPoll = new Date().toISOString();
  cache.staleCoin = false;
}

function setRates(data) {
  cache.rates = data;
  cache.lastRatePoll = new Date().toISOString();
  cache.staleRate = false;
}

function markCoinStale()  { cache.staleCoin = true; }
function markRateStale()  { cache.staleRate = true; }

function getCoins()       { return cache.coins; }
function getRates()       { return cache.rates; }
function getLastCoinPoll(){ return cache.lastCoinPoll; }
function getLastRatePoll(){ return cache.lastRatePoll; }
function isStale()        { return { coin: cache.staleCoin, rate: cache.staleRate }; }

module.exports = { setCoins, setRates, markCoinStale, markRateStale, getCoins, getRates, getLastCoinPoll, getLastRatePoll, isStale };
