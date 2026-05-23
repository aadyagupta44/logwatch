---
sidebar_position: 2
title: SDK Reference
description: Full API reference for the @logwatch/node npm package.
---

# SDK Reference — `@logwatch/node`

## Installation

```bash
npm install @logwatch/node
```

## Constructor

```typescript
const lw = new LogWatch(config: LogWatchConfig);
```

### Configuration options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **required** | Your LogWatch API key. Generate one at **Settings → API Keys**. |
| `baseUrl` | `string` | `https://api.logwatch.dev` | Override to point at a self-hosted or staging LogWatch instance. |
| `service` | `string` | `"default"` | The service name attached to every log line. Appears in the dashboard sidebar. |
| `flushInterval` | `number` (ms) | `10000` | How often the buffer is flushed to the LogWatch ingest endpoint. Lower values reduce latency at the cost of more HTTP requests. |
| `maxBatchSize` | `number` | `500` | Maximum number of log lines in a single batch. If the buffer exceeds this, an early flush is triggered. |
| `debug` | `boolean` | `false` | Print SDK internals (flush timings, batch sizes) to `stderr`. |

```typescript
interface LogWatchConfig {
  apiKey: string;
  baseUrl?: string;
  service?: string;
  flushInterval?: number;
  maxBatchSize?: number;
  debug?: boolean;
}
```

---

## Methods

### `attach()`

```typescript
lw.attach(): void
```

Starts the SDK. Patches `console.log`, `console.warn`, and `console.error` to capture output and starts the background flush timer.

Call this **once** at application startup, before any other code logs output. Calling it more than once is a no-op.

```typescript
import { LogWatch } from '@logwatch/node';

const lw = new LogWatch({ apiKey: process.env.LOGWATCH_API_KEY!, service: 'orders-api' });
lw.attach(); // <— call once, early in your entrypoint
```

---

### `detach()`

```typescript
await lw.detach(): Promise<void>
```

Stops capturing logs, flushes any remaining buffered lines synchronously, and cancels the interval timer. Returns a `Promise` that resolves once the final flush completes.

Use this during graceful shutdown:

```typescript
process.on('SIGTERM', async () => {
  await lw.detach();
  process.exit(0);
});
```

---

### `simulateAnomaly()`

```typescript
lw.simulateAnomaly(options?: SimulateOptions): void
```

Emits a synthetic burst of error logs designed to trigger the anomaly detection model within one 60-second window. Useful for integration testing.

```typescript
lw.simulateAnomaly({ count: 30, latencyMs: 5000 });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `25` | Number of error log lines to emit. |
| `latencyMs` | `number` | `4000` | Synthetic latency value embedded in each log line. |

---

## Events

The `LogWatch` instance is an `EventEmitter`. Subscribe with `.on(event, handler)`.

### `onFlush`

Fired after each successful batch is delivered to the ingest endpoint.

```typescript
lw.on('onFlush', (stats: FlushStats) => {
  console.debug(`Flushed ${stats.count} lines in ${stats.durationMs}ms`);
});
```

```typescript
interface FlushStats {
  count: number;       // number of log lines in this batch
  durationMs: number;  // round-trip time for the HTTP request
  timestamp: Date;
}
```

### `onError`

Fired when a flush fails (network error, 4xx/5xx from the API).

```typescript
lw.on('onError', (err: FlushError) => {
  console.error('LogWatch flush failed:', err.message);
  // Your app keeps running — logs are dropped for this batch.
});
```

```typescript
interface FlushError {
  message: string;
  statusCode?: number; // present for HTTP errors
  retryable: boolean;
}
```

---

## Framework examples

### Express

```typescript
import express from 'express';
import { LogWatch } from '@logwatch/node';

const lw = new LogWatch({
  apiKey: process.env.LOGWATCH_API_KEY!,
  service: 'express-api',
  flushInterval: 5000,
  maxBatchSize: 200,
});

lw.attach();

const app = express();

app.get('/health', (req, res) => {
  console.log('Health check OK');
  res.json({ status: 'up' });
});

const server = app.listen(3000);

process.on('SIGTERM', async () => {
  server.close();
  await lw.detach();
});
```

---

### Next.js (App Router)

Add to `instrumentation.ts` (Next.js 14+):

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { LogWatch } = await import('@logwatch/node');

    const lw = new LogWatch({
      apiKey: process.env.LOGWATCH_API_KEY!,
      service: 'nextjs-app',
    });

    lw.attach();
  }
}
```

Enable instrumentation in `next.config.ts`:

```typescript
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

---

### Fastify

```typescript
import Fastify from 'fastify';
import { LogWatch } from '@logwatch/node';

const lw = new LogWatch({
  apiKey: process.env.LOGWATCH_API_KEY!,
  service: 'fastify-api',
});

lw.attach();

const app = Fastify({ logger: true });

app.get('/', async () => ({ hello: 'world' }));

const start = async () => {
  await app.listen({ port: 3000 });
};

start();

process.on('SIGINT', async () => {
  await app.close();
  await lw.detach();
});
```

:::note Fastify logger
Fastify uses `pino` for logging, which does **not** go through `console.log`. To capture Fastify's own log output, pass `logger: false` and use `console.log` manually, or stream pino output through a custom transport.
:::
