---
sidebar_position: 1
title: Get started in 5 minutes
description: Ship your first anomaly detection integration in under 5 minutes.
---

# Get started in 5 minutes

LogWatch watches your logs, detects anomalies with an ML model, and surfaces them in a real-time dashboard — zero infrastructure required on your end.

---

## Step 1 — Sign up and get your API key

1. Go to [app.logwatch.dev](https://app.logwatch.dev) and create a free account.
2. Navigate to **Settings → API Keys** and click **Generate new key**.
3. Copy the key — you will only see it once.

Your key looks like:

```
lw_live_sk_a1b2c3d4e5f6g7h8i9j0...
```

---

## Step 2 — Install the SDK

```bash
npm install @logwatch/node
```

Or with Yarn:

```bash
yarn add @logwatch/node
```

Requires **Node.js 18+**.

---

## Step 3 — Attach to your app (3 lines)

```typescript
import { LogWatch } from '@logwatch/node';

const lw = new LogWatch({ apiKey: 'lw_live_sk_...', service: 'my-api' });
lw.attach();
```

That's it. `attach()` monkey-patches `console.log`, `console.warn`, and `console.error` so every log line is batched and forwarded to LogWatch in the background.

### Express example

```typescript
import express from 'express';
import { LogWatch } from '@logwatch/node';

const lw = new LogWatch({
  apiKey: process.env.LOGWATCH_API_KEY!,
  service: 'payment-api',
  flushInterval: 5000, // flush every 5 s
});

lw.attach();

const app = express();
app.listen(3000, () => console.log('Server running on :3000'));
```

The `console.log` call inside the callback is automatically captured and streamed.

---

## Step 4 — Open the dashboard and see your first anomaly

1. Visit **https://app.logwatch.dev/dashboard**.
2. Within 30 seconds your service appears in the sidebar.
3. LogWatch's ML model flags anomalous windows (unusual error rates, latency spikes) and surfaces them under **Anomalies**.

:::tip First anomaly
You can force a test anomaly by calling `lw.simulateAnomaly()` from the SDK. This emits a burst of synthetic error logs and triggers detection within one sliding window (60 seconds).
:::

---

## Next steps

- Explore all [SDK configuration options](./sdk-reference) to tune batching and routing.
- Browse the [REST API reference](./api-reference) if you prefer direct HTTP calls.
- Read the [Architecture overview](./architecture) to understand how the pipeline works end-to-end.
