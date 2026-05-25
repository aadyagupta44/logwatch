---
sidebar_position: 1
title: Get started in 5 minutes
description: Ship your first anomaly detection integration in under 5 minutes.
---

# Get started in 5 minutes

LogWatch watches your microservice logs, scores them with an IsolationForest ML model in real-time, and surfaces anomalies on a live dashboard — zero infrastructure required on your end.

---

## Step 1 — Create an account and get your API key

1. Go to [LogWatch](https://logwatch-production.up.railway.app) and create a free account.
2. Your API key is shown **once** right after registration — copy it immediately.
3. You can regenerate it anytime from **Settings → API Keys**.

---

## Step 2 — Install the SDK

```bash
npm install @logwatch/node
```

Requires **Node.js 18+**.

---

## Step 3 — Two lines in your Express app

```js
const express = require('express');
const { LogWatch } = require('@logwatch/node');

const app = express();

// 1. Initialise once at startup
const lw = LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
});

// 2. Mount the middleware — every HTTP request is captured automatically
app.use(lw.expressMiddleware());

// Your routes as normal
app.post('/payments', (req, res) => {
  res.json({ id: 'pay_123', status: 'success' });
});

app.listen(3000, () => console.log('Server running on :3000'));
```

That's it. The middleware captures every request and ships log lines like:

```
2024-01-15T10:23:45Z INFO payment-service HTTP POST /payments 200 43ms
2024-01-15T10:23:46Z ERROR payment-service HTTP POST /payments 500 1243ms
```

---

## Step 4 — Open the dashboard

1. Visit your [LogWatch dashboard](https://logwatch-production.up.railway.app/dashboard).
2. Within a few seconds your service name appears as logs start flowing.
3. LogWatch scores each 60-second window of traffic per service. When the error ratio, warn ratio, or request volume look anomalous the model flags it and it appears under **Anomalies** with a severity label.

:::tip Trigger your first anomaly
Start your service normally for 30 seconds, then force some 500 errors. The ML engine will flag the spike within the next 60-second window.
:::

---

## Next steps

- See all [SDK options and methods](./sdk-reference).
- Browse the [REST API reference](./api-reference) if you prefer direct HTTP calls.
- Read the [Architecture overview](./architecture) to understand the full pipeline.
