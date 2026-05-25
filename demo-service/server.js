const express = require('express');
const { LogWatch } = require('@logwatch/node');

// ── LogWatch — two lines, works with any framework ────────────────────────────
const lw = LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY || 'paste-your-api-key-here',
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();

lw.on('flushed', ({ accepted }) => {
  if (accepted > 0) console.log(`[logwatch] flushed ${accepted} log lines`);
});

// ── App ────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

let chaosMode = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post('/payments', async (req, res) => {
  const latency = chaosMode ? 1500 + Math.random() * 2500 : 30 + Math.random() * 90;
  await delay(latency);
  if (chaosMode && Math.random() < 0.85) {
    return res.status(500).json({ error: 'Payment gateway timeout' });
  }
  res.json({ id: `pay_${Date.now()}`, status: 'success' });
});

app.get('/payments/:id', async (req, res) => {
  const latency = chaosMode ? 800 + Math.random() * 1200 : 20 + Math.random() * 60;
  await delay(latency);
  if (chaosMode && Math.random() < 0.6) {
    return res.status(502).json({ error: 'Upstream error' });
  }
  res.json({ id: req.params.id, amount: 99.99, status: 'completed' });
});

app.post('/orders', async (req, res) => {
  await delay(40 + Math.random() * 110);
  res.status(201).json({ id: `ord_${Date.now()}`, status: 'created' });
});

app.get('/orders', async (req, res) => {
  await delay(20 + Math.random() * 40);
  res.json({ orders: [], total: 0 });
});

app.post('/auth/login', async (req, res) => {
  await delay(50 + Math.random() * 130);
  res.json({ token: 'eyJhbGciOiJIUzI1NiJ9...' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', chaos: chaosMode });
});

app.post('/chaos/enable', (req, res) => {
  chaosMode = true;
  console.log('\n🔴 CHAOS MODE ON — payment-service is now failing\n');
  res.json({ chaos: true });
});

app.post('/chaos/disable', (req, res) => {
  chaosMode = false;
  console.log('\n🟢 Chaos mode off\n');
  res.json({ chaos: false });
});

// ── Auto traffic ───────────────────────────────────────────────────────────────
function simulateTraffic() {
  const calls = [
    () => fetch('http://localhost:3000/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 49.99 }) }).catch(() => {}),
    () => fetch('http://localhost:3000/payments/pay_123').catch(() => {}),
    () => fetch('http://localhost:3000/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}),
    () => fetch('http://localhost:3000/orders').catch(() => {}),
    () => fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}),
  ];
  setInterval(() => {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) calls[Math.floor(Math.random() * calls.length)]();
  }, 2000);
}

app.listen(3000, () => {
  console.log('\n  Demo service running — http://localhost:3000');
  console.log('  LogWatch attached · shipping logs every 5s\n');
  console.log('  POST /chaos/enable  → trigger failures');
  console.log('  POST /chaos/disable → restore normal\n');
  simulateTraffic();
});
