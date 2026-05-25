---
sidebar_position: 2
title: SDK Reference
description: Full API reference for the @logwatch/node npm package.
---

# SDK Reference — `@logwatch/node`

Current version: **1.2.0**

## Installation

```bash
npm install @logwatch/node
```

---

## `LogWatch.init(config)`

```typescript
LogWatch.init(config: LogWatchConfig): LogWatch
```

Creates a global singleton instance. Chain `.attach()` to start capturing immediately.

```js
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();
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
| `apiKey` | `string` | **required** | Your LogWatch API key. |
| `service` | `string` | `"service"` | Service name shown on the dashboard. |
| `baseUrl` | `string` | `http://localhost:8080` | LogWatch ingest API URL. |
| `flushInterval` | `number` (ms) | `5000` | How often buffered logs are shipped. |
| `batchSize` | `number` | `100` | Flush immediately when buffer reaches this size. |

---

## Methods

### `attach()`

```typescript
lw.attach(): this
```

Starts log capture and the flush timer. Hooks into Node.js core `http.Server` — works with **any framework** (Express, Fastify, Koa, NestJS, vanilla `http`) without any additional setup.

```js
LogWatch.init({ apiKey: '...', service: 'my-api', baseUrl: '...' }).attach();
```

Every HTTP request your server handles is automatically captured:

```
2024-01-15T10:23:45Z INFO  my-api HTTP GET  /users   200  18ms
2024-01-15T10:23:46Z ERROR my-api HTTP POST /orders  500 2100ms
```

---

### `detach()`

```typescript
lw.detach(): this
```

Stops capturing, restores Node.js `http` to its original state, and flushes any remaining buffered logs.

```js
process.on('SIGTERM', () => {
  lw.detach();
  server.close();
});
```

---

### `log(line)`

```typescript
lw.log(line: string): this
```

Manually buffer a raw log line. Use this for background jobs, queue consumers, cron tasks — anything that isn't an HTTP request.

The line must follow this format:

```
{ISO timestamp} {LEVEL} {service} HTTP {METHOD} {path} {status} {latency}ms
```

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

`LogWatch` extends `EventEmitter`.

### `flushed`

Fired after each successful batch is delivered.

```js
lw.on('flushed', ({ accepted }) => {
  console.log(`[logwatch] flushed ${accepted} lines`);
});
```

### `error`

Fired when a flush fails. Your service keeps running — that batch is dropped.

```js
lw.on('error', (err) => {
  console.error('[logwatch] flush error:', err.message);
});
```

---

## Framework examples

The same two lines work regardless of framework — `attach()` operates below the framework level.

### Express

```js
const express = require('express');
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'orders-api',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();

const app = express();
app.get('/orders', (req, res) => res.json([]));
app.listen(3000);
```

### Fastify

```js
const Fastify = require('fastify');
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'orders-api',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();

const app = Fastify();
app.get('/orders', async () => []);
app.listen({ port: 3000 });
```

### NestJS

In `main.ts`, before `app.listen()`:

```ts
import { LogWatch } from '@logwatch/node';

async function bootstrap() {
  LogWatch.init({
    apiKey: process.env.LOGWATCH_API_KEY,
    service: 'orders-api',
    baseUrl: 'https://logwatch-production.up.railway.app',
  }).attach();

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### Koa

```js
const Koa = require('koa');
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'orders-api',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();

const app = new Koa();
app.use(ctx => { ctx.body = 'ok'; });
app.listen(3000);
```
