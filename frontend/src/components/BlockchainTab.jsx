import { useState, useEffect } from 'react';
import { Panel } from './ui';

const ETHERSCAN_KEY = 'T2C62HQKEKQX4MKNYVQ4RPGA3WHWTV8IFG';
const BASE          = 'https://api.etherscan.io/v2/api';

async function etherscan(params) {
  const url = new URL(BASE);
  const allParams = { ...params, chainid: '1', apikey: ETHERSCAN_KEY };
  Object.entries(allParams).forEach(function([key, val]) {
    url.searchParams.set(key, val);
  });
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.status === '0' && data.message !== 'No transactions found') {
    throw new Error(data.result || 'Etherscan error');
  }
  return data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function weiToEth(wei) {
  if (!wei) return '0';
  return (parseInt(wei, 16) / 1e18).toFixed(6);
}

function hexToInt(hex) {
  if (!hex) return '0';
  return parseInt(hex, 16).toString();
}

function shortAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function fmtTimestamp(ts) {
  if (!ts) return '—';
  return new Date(parseInt(ts) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BlockchainTab({ D }) {
  const [gasData,    setGasData]    = useState(null);
  const [ethPrice,   setEthPrice]   = useState(null);
  const [gasLoading, setGasLoading] = useState(true);

  const [walletAddr,    setWalletAddr]    = useState('');
  const [walletResult,  setWalletResult]  = useState(null);
  const [walletTxs,     setWalletTxs]     = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError,   setWalletError]   = useState('');

  const [txHash,    setTxHash]    = useState('');
  const [txResult,  setTxResult]  = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError,   setTxError]   = useState('');

  useEffect(function loadGasAndPrice() {
    let cancelled = false;

    async function load() {
      try {
        const gasResponse = await etherscan({ module: 'gastracker', action: 'gasoracle' });
        if (!cancelled) setGasData(gasResponse.result);

        await sleep(1000);

        const priceResponse = await etherscan({ module: 'stats', action: 'ethprice' });
        if (!cancelled) setEthPrice(priceResponse.result);
      } catch (err) {
        console.error('Gas/price load failed:', err.message);
      } finally {
        if (!cancelled) setGasLoading(false);
      }
    }

    load();

    const interval = setInterval(async function() {
      try {
        const gasResponse = await etherscan({ module: 'gastracker', action: 'gasoracle' });
        if (!cancelled) setGasData(gasResponse.result);
      } catch (err) {
        console.error('Gas refresh failed:', err.message);
      }
    }, 30000);

    return function cleanup() {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function checkWallet() {
    if (!walletAddr.trim()) return setWalletError('Enter a wallet address');
    setWalletLoading(true);
    setWalletError('');
    setWalletResult(null);
    setWalletTxs([]);

    try {
      const balRes = await etherscan({ module: 'account', action: 'balance', address: walletAddr, tag: 'latest' });
      await sleep(1000);
      const txRes  = await etherscan({ module: 'account', action: 'txlist', address: walletAddr, page: 1, offset: 10, sort: 'desc' });

      const balEth = (parseInt(balRes.result) / 1e18).toFixed(6);
      const balUsd = ethPrice ? (parseFloat(balEth) * parseFloat(ethPrice.ethusd)).toFixed(2) : null;

      setWalletResult({ address: walletAddr, balEth, balUsd, txCount: Array.isArray(txRes.result) ? txRes.result.length : 0 });
      setWalletTxs(Array.isArray(txRes.result) ? txRes.result : []);
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletLoading(false);
    }
  }

  async function lookupTx() {
    if (!txHash.trim()) return setTxError('Enter a transaction hash');
    setTxLoading(true);
    setTxError('');
    setTxResult(null);

    try {
      const txRes      = await etherscan({ module: 'proxy', action: 'eth_getTransactionByHash',   txhash: txHash });
      await sleep(1000);
      const receiptRes = await etherscan({ module: 'proxy', action: 'eth_getTransactionReceipt', txhash: txHash });

      const tx      = txRes.result;
      const receipt = receiptRes.result;
      if (!tx) throw new Error('Transaction not found');

      setTxResult({
        hash:        tx.hash,
        from:        tx.from,
        to:          tx.to,
        value:       weiToEth(tx.value),
        gasPrice:    (parseInt(tx.gasPrice, 16) / 1e9).toFixed(2),
        gasUsed:     receipt ? hexToInt(receipt.gasUsed) : '—',
        blockNumber: hexToInt(tx.blockNumber),
        status:      receipt ? (receipt.status === '0x1' ? 'Success' : 'Failed') : 'Pending',
        nonce:       hexToInt(tx.nonce),
      });
    } catch (err) {
      setTxError(err.message);
    } finally {
      setTxLoading(false);
    }
  }

  function InfoRow({ label, value, valueStyle }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${D.border}` }}>
        <span style={{ fontSize: 12, color: D.textDim }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: D.textBright, ...valueStyle }}>{value}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: D.textBright, marginBottom: 4 }}>Blockchain Explorer</h2>
          <p style={{ fontSize: 13, color: D.textDim }}>Live Ethereum data via Etherscan API</p>
        </div>
        {ethPrice && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: D.textDim, marginBottom: 3 }}>ETH Price</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#627eea' }}>
              ${parseFloat(ethPrice.ethusd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* Gas tracker */}
      <Panel D={D}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>Gas Tracker</span>
          <span style={{ fontSize: 11, color: D.textDim }}>Updates every 30s</span>
        </div>
        <div style={{ padding: 16 }}>
          {gasLoading
            ? <div style={{ textAlign: 'center', padding: 20, color: D.textDim, fontSize: 13 }}>Loading gas prices…</div>
            : gasData
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Slow',    gwei: gasData.SafeGasPrice,    time: '~10 min', color: D.green },
                  { label: 'Average', gwei: gasData.ProposeGasPrice, time: '~3 min',  color: D.gold  },
                  { label: 'Fast',    gwei: gasData.FastGasPrice,    time: '~15 sec', color: D.red   },
                ].map(function(g) {
                  return (
                    <div key={g.label} style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '16px', textAlign: 'center', borderTop: `3px solid ${g.color}` }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: D.text, marginBottom: 10 }}>{g.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: g.color, marginBottom: 4 }}>{g.gwei}</div>
                      <div style={{ fontSize: 11, color: D.textDim }}>Gwei · {g.time}</div>
                    </div>
                  );
                })}
              </div>
            : <div style={{ textAlign: 'center', padding: 20, color: D.red, fontSize: 13 }}>Failed to load gas data</div>
          }
        </div>
      </Panel>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Wallet checker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel D={D}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>Wallet Checker</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: D.textDim, marginBottom: 5 }}>Ethereum Address</label>
                <input
                  value={walletAddr}
                  onChange={e => setWalletAddr(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkWallet()}
                  placeholder="0x..."
                  style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
              {walletError && <div style={{ fontSize: 12, color: D.red }}>{walletError}</div>}
              <button
                onClick={checkWallet}
                disabled={walletLoading}
                style={{ padding: '9px', fontSize: 13, fontWeight: 500, color: '#fff', background: D.blue, border: 'none', borderRadius: 6, cursor: 'pointer', opacity: walletLoading ? 0.6 : 1 }}
              >
                {walletLoading ? 'Checking…' : 'Check Wallet'}
              </button>
            </div>
          </Panel>

          {walletResult && (
            <Panel D={D}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>Wallet Details</div>
              <div style={{ padding: 16 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: D.textDim, wordBreak: 'break-all', marginBottom: 14, padding: '8px 10px', background: D.panel2, borderRadius: 5 }}>
                  {walletResult.address}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: D.textDim, marginBottom: 4 }}>ETH Balance</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#627eea' }}>{walletResult.balEth}</div>
                    {walletResult.balUsd && <div style={{ fontSize: 11, color: D.textDim }}>${walletResult.balUsd} USD</div>}
                  </div>
                  <div style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: D.textDim, marginBottom: 4 }}>Transactions</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: D.textBright }}>{walletResult.txCount}+</div>
                    <div style={{ fontSize: 11, color: D.textDim }}>Last 10 shown</div>
                  </div>
                </div>

                {walletTxs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                    {walletTxs.map(function(tx) {
                      const isIn   = tx.to?.toLowerCase() === walletAddr.toLowerCase();
                      const ethVal = (parseInt(tx.value) / 1e18).toFixed(4);
                      const ok     = tx.isError === '0';
                      return (
                        <div key={tx.hash} style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 2, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: isIn ? D.green : D.red }}>{isIn ? '↓ IN' : '↑ OUT'}</span>
                              <span style={{ fontSize: 10, color: ok ? D.green : D.red }}>{ok ? '✓' : '✗'}</span>
                            </div>
                            <div style={{ fontSize: 10, color: D.textDim, fontFamily: 'monospace' }}>{fmtTimestamp(tx.timeStamp)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isIn ? D.green : D.red }}>{ethVal} ETH</div>
                            <div style={{ fontSize: 10, color: D.textDim, fontFamily: 'monospace' }}>{shortAddr(isIn ? tx.from : tx.to)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* Transaction lookup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel D={D}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>Transaction Lookup</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: D.textDim, marginBottom: 5 }}>Transaction Hash</label>
                <input
                  value={txHash}
                  onChange={e => setTxHash(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupTx()}
                  placeholder="0x..."
                  style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
              {txError && <div style={{ fontSize: 12, color: D.red }}>{txError}</div>}
              <button
                onClick={lookupTx}
                disabled={txLoading}
                style={{ padding: '9px', fontSize: 13, fontWeight: 500, color: '#fff', background: D.gold, border: 'none', borderRadius: 6, cursor: 'pointer', opacity: txLoading ? 0.6 : 1 }}
              >
                {txLoading ? 'Looking up…' : 'Lookup Transaction'}
              </button>
            </div>
          </Panel>

          {txResult && (
            <Panel D={D}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>Transaction Details</span>
                <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 4, color: txResult.status === 'Success' ? D.green : D.red, background: (txResult.status === 'Success' ? D.green : D.red) + '15' }}>
                  {txResult.status}
                </span>
              </div>
              <div style={{ padding: '4px 16px 16px' }}>
                <InfoRow label="Hash"         value={shortAddr(txResult.hash) + '...'} />
                <InfoRow label="From"         value={shortAddr(txResult.from)} />
                <InfoRow label="To"           value={shortAddr(txResult.to)} />
                <InfoRow label="Value"        value={txResult.value + ' ETH'} valueStyle={{ color: '#627eea' }} />
                <InfoRow label="Gas Price"    value={txResult.gasPrice + ' Gwei'} />
                <InfoRow label="Gas Used"     value={parseInt(txResult.gasUsed).toLocaleString()} />
                <InfoRow label="Block"        value={parseInt(txResult.blockNumber).toLocaleString()} />
                <InfoRow label="Nonce"        value={txResult.nonce} />
                <a
                  href={`https://etherscan.io/tx/${txResult.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: '8px', borderRadius: 6, border: `1px solid ${D.border}`, color: D.blue, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}
                >
                  View on Etherscan ↗
                </a>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: D.textDim, paddingTop: 4 }}>
        Powered by Etherscan API · Real Ethereum blockchain data · Not financial advice
      </div>
    </div>
  );
}
