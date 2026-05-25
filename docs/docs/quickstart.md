---
sidebar_position: 1
title: Get started in 5 minutes
description: Ship your first anomaly detection integration in under 5 minutes.
---

# Get started in 5 minutes

LogWatch watches your microservice logs, scores them with an IsolationForest ML model, and surfaces anomalies on a live dashboard — zero infrastructure on your end.

---

## Step 1 — Create an account and get your API key

1. Go to [LogWatch](https://logwatch-production.up.railway.app) and create a free account.
2. Your API key is shown **once** right after registration — copy it.
3. You can regenerate it anytime from **Settings → API Keys**.

---

## Step 2 — Install the SDK

```bash
npm install @logwatch/node
```

Requires **Node.js 18+**.

---

## Step 3 — One line at the top of your app

```js
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();
```

That's it. `attach()` hooks into Node.js at the runtime level — every HTTP request your service handles is automatically captured and shipped to LogWatch. It works with **any framework**: Express, Fastify, Koa, NestJS, vanilla `http`, or anything else.

```
2024-01-15T10:23:45Z INFO  payment-service HTTP GET  /health    200  12ms
2024-01-15T10:23:46Z INFO  payment-service HTTP POST /payments  201  43ms
2024-01-15T10:23:47Z ERROR payment-service HTTP POST /payments  500 1243ms
```

---

## Step 4 — Open your dashboard

1. Visit your [LogWatch dashboard](https://logwatch-production.up.railway.app/dashboard).
2. Within seconds your service name appears as logs start flowing in.
3. LogWatch scores each 60-second window of traffic per service using an IsolationForest model. When the error rate, warn rate, or request volume look anomalous, the event is flagged and appears under **Anomalies** with a severity label (HIGH / MEDIUM / LOW).

:::tip Trigger your first anomaly
Let your service run normally for ~30 seconds, then force some 500 errors. The engine evaluates the window after 60 seconds — you'll see the anomaly on your dashboard shortly after.
:::

---

## Next steps

- See all [SDK options and methods](./sdk-reference).
- Browse the [REST API reference](./api-reference) to send logs over plain HTTP.
- Read the [Architecture overview](./architecture) to understand the full pipeline.
