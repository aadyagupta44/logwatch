---
sidebar_position: 2
title: SDK Reference
description: Full API reference for the @logwatch/node npm package.
---

# SDK Reference — `@logwatch/node`

Current version: **1.1.0**

## Installation

```bash
npm install @logwatch/node
```

---

## `LogWatch.init()` — recommended

```typescript
LogWatch.init(config: LogWatchConfig): LogWatch
```

Creates a global singleton instance and starts the flush timer. Call once at app startup.

```js
const { LogWatch } = require('@logwatch/node');

const lw = LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
});
```

---

## Constructor

If you need multiple instances (e.g. one per service in a monorepo), use `new` directly:

```typescript
const lw = new LogWatch(config: LogWatchConfig);
lw.attach(); // must call attach() manually when using new
```

---

## Configuration

```typescript
interface LogWatchConfig {
  apiKey: string;
  service?: string;
  baseUrl?: string;
  flushInterval?: number;
  batchSize?: number;
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **required** | Your LogWatch API key. Generate one at **Settings → API Keys**. |
| `service` | `string` | `"service"` | Service name embedded in every log line — appears on the dashboard. |
| `baseUrl` | `string` | `http://localhost:8080` | LogWatch ingest API URL. Point this at your deployed instance. |
| `flushInterval` | `number` (ms) | `5000` | How often the buffer is flushed. Lower values reduce latency at the cost of more requests. |
| `batchSize` | `number` | `100` | Flush immediately when the buffer reaches this many lines. |

---

## Methods

### `expressMiddleware()`

```typescript
lw.expressMiddleware(): (req, res, next) => void
```

Returns an Express/Connect middleware function. Mount it with `app.use()` and every HTTP request is automatically captured in the format the LogWatch engine expects.

```js
app.use(lw.expressMiddleware());
```

Each request produces a log line like:

```
2024-01-15T10:23:45Z ERROR payment-service HTTP POST /payments 500 1243ms
```

The level is derived from the response status code: `ERROR` for 5xx, `WARN` for 4xx, `INFO` for everything else.

---

### `attach()`

```typescript
lw.attach(): this
```

Starts the background flush timer. Called automatically by `LogWatch.init()`. If you use `new LogWatch()` directly, call `attach()` manually.

```js
const lw = new LogWatch({ apiKey: '...', service: 'my-api' });
lw.attach();
```

---

### `detach()`

```typescript
lw.detach(): this
```

Stops the flush timer and drains any remaining buffered lines. Use during graceful shutdown:

```js
process.on('SIGTERM', async () => {
  lw.detach();
  server.close();
});
```

---

### `log(line)`

```typescript
lw.log(line: string): this
```

Buffer a raw log line manually. Use this for background jobs, queue consumers, or anything outside HTTP requests.

The line must follow this format for the ML engine to parse it:

```
{ISO timestamp} {LEVEL} {service-name} HTTP {METHOD} {path} {status} {latency}ms
```

Example:

```js
const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
lw.log(`${ts} ERROR payment-service HTTP POST /payments/retry 500 3200ms`);
```

---

### `flush()`

```typescript
lw.flush(): Promise<FlushResult | null>
```

Manually flush all buffered lines immediately. Returns `null` if the buffer is empty.

```typescript
interface FlushResult {
  accepted: number;
  dropped: number;
}
```

---

## Events

`LogWatch` extends `EventEmitter`. Subscribe with `.on(event, handler)`.

### `flushed`

Fired after each successful batch is delivered.

```js
lw.on('flushed', ({ accepted, dropped }) => {
  console.log(`Flushed ${accepted} lines`);
});
```

### `error`

Fired when a flush fails (network error or 4xx/5xx from the API). Your app continues running — that batch is dropped.

```js
lw.on('error', (err) => {
  console.error('LogWatch flush failed:', err.message);
});
```

---

## Full Express example

```js
const express = require('express');
const { LogWatch } = require('@logwatch/node');

const app = express();
app.use(express.json());

const lw = LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
  flushInterval: 5000,
});

lw.on('flushed', ({ accepted }) => {
  if (accepted > 0) console.log(`[logwatch] flushed ${accepted} lines`);
});

// Auto-log every request
app.use(lw.expressMiddleware());

app.post('/payments', (req, res) => {
  res.json({ id: `pay_${Date.now()}`, status: 'success' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(3000, () => {
  console.log('Server running on :3000');
});

process.on('SIGTERM', () => {
  lw.detach();
  server.close();
});
```
