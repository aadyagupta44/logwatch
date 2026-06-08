# LogWatch

[![npm version](https://img.shields.io/npm/v/@logwatch/node)](https://www.npmjs.com/package/@logwatch/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**AI-powered log anomaly detection SaaS.** Two lines of code to instrument any Node.js service. Real-time anomaly scoring by an IsolationForest model running in a high-throughput Rust engine — no manual thresholds, no dashboards to configure, no alert rules to write.

---

## How it works

```js
const { LogWatch } = require('@logwatch/node');
LogWatch.init({ apiKey: 'lw_...', service: 'payment-api' }).attach();
```

That's it. LogWatch patches `http.Server.prototype.emit` below your framework layer — every HTTP request is automatically captured, batched, and shipped to the ingest API. No middleware to register. No console intercepting. Works with **Express, Fastify, Koa, NestJS, or vanilla Node `http`**.

From there, a five-stage streaming pipeline runs automatically:

1. **Ingest** - The SDK batches log lines every 5 seconds and POSTs them to the Spring Boot API authenticated by your API key.
2. **Buffer** - Spring Boot validates the key, resolves your organisation ID, and publishes raw log lines to a Kafka topic (`raw-logs`) with the orgId as the message key.
3. **Parse** - The Rust engine consumes the topic and parses each line with a `nom`-based zero-copy parser, extracting method, path, status, and latency.
4. **Score** - Lines are aggregated into 20-second per-service sliding windows. When each window closes, a 7-dimensional feature vector is fed to an ONNX IsolationForest model. Scores below 0.0 are anomalies; below −0.1 are HIGH severity.
5. **Surface** - Anomalies are persisted to PostgreSQL and appear in the React dashboard. Click any anomaly to see a plain-English description of what the model observed and an interactive "Ask LLM" panel backed by Groq for debugging.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Your Node.js Service                                │
│                                                      │
│  LogWatch.init({ apiKey, service }).attach()         │
│  (patches http.Server.prototype.emit — any framework)│
└─────────────────────────┬────────────────────────────┘
                          │  POST /api/ingest  (X-Api-Key)
                          │  { "logs": ["...ISO timestamp..."] }
                          ▼
┌─────────────────────────────────┐   ┌───────────────────────────────┐
│  Spring Boot API  (Railway)     │──▶│  Kafka — Redpanda Cloud       │
│                                 │   │  topic: raw-logs              │
│  • API key → orgId lookup       │   │  message key: orgId           │
│  • JWT auth for dashboard       │   └───────────────┬───────────────┘
│  • GET /anomalies REST API      │                   │ consume
│  • PATCH /{id}/acknowledge      │                   ▼
└─────────────────────────────────┘   ┌───────────────────────────────┐
            ▲                         │  Rust Engine  (Railway)       │
            │                         │                               │
            │  Spring Data JPA        │  nom log parser               │
            │                         │  20-second sliding window     │
            │                         │  7-feature vector extraction  │
            │  INSERT anomaly         │  ONNX IsolationForest         │
            └─────────────────────────┤  inference (no Python)        │
                                      └───────────────────────────────┘
                                                      │
                                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL — Neon                                                    │
│  organisations · users · api_keys · anomalies                        │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │  REST (JWT)
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  React Dashboard — Vercel                                             │
│                                                                       │
│  • Anomaly feed with real-time polling                                │
│  • Per-service severity timeline                                      │
│  • Anomaly detail — plain-English description + 7-feature breakdown   │
│  • Ask LLM panel — Groq llama-3.3-70b-versatile debugging assistant  │
│  • API key management                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Demo Video
https://github.com/user-attachments/assets/2a70a3d4-fba5-4490-a120-e3592ec58164

> The demo uses `demo-service/server.js` — a self-contained Express app that simulates a payment microservice with realistic auto-traffic, then lets you trigger cascading failures with a single curl command.

### Step 1 - Open the docs

Navigate to **[https://logwatchdocssite.vercel.app](https://logwatchdocssite.vercel.app)** → Quickstart. The page shows the exact two lines you need to instrument any Node.js service.

### Step 2 - Register and copy your API key

Open the dashboard → Register → **Settings → API Keys → Generate key**. Copy `lw_...`.

### Step 3 - Instrument the demo service

`demo-service/server.js` is a realistic Express service simulating payments, orders, and auth. The entire LogWatch integration lives at the top of the file:

```js
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,
  service: 'payment-service',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();
```

The same two lines work for **any** Node.js framework — LogWatch attaches below Express, not inside it.

### Step 4 - Run the service

```bash
cd demo-service
npm install
# PowerShell:
$env:LOGWATCH_API_KEY='lw_your-key-here'; node server.js
```

The service starts on port 3000 and immediately begins simulating traffic — 3 to 5 requests every 2 seconds. Every 5 seconds LogWatch flushes the buffer:

```
  Demo service running — http://localhost:3000
  LogWatch attached · shipping logs every 5s

  POST /chaos/enable  → trigger failures
  POST /chaos/disable → restore normal

[logwatch] flushed 13 log lines
[logwatch] flushed 18 log lines
[logwatch] flushed 15 log lines
```

### Step 5 - Enable chaos mode

```bash
curl -X POST http://localhost:3000/chaos/enable
```

The payment service now fails on 85% of requests (`500 Payment gateway timeout`) with latency spiking to 1.5–4 seconds per request. The remaining services (orders, auth) stay healthy — the anomaly detector isolates the fault to `payment-service`.

### Step 6 - Watch the dashboard

After ~20 seconds, the IsolationForest model flags the window. Open the dashboard — the anomaly appears with severity HIGH. Click it to see:

- **Plain-English description** - "payment-service is experiencing critical failure conditions. In this 20-second window, 85% of requests failed with 5xx status codes. Error ratio is 3.2× above the learned normal baseline."
- **Feature breakdown** - all 7 model inputs displayed with percentage bars so you can see exactly which signals drove the score.
- **Ask LLM** - backed by Groq's `llama-3.3-70b-versatile`. Type "What could cause this spike in 500s?" and get debugging guidance in under two seconds.

### Step 7 - Restore normal

```bash
curl -X POST http://localhost:3000/chaos/disable
```

Traffic returns to baseline. No anomalies are flagged in the next window.

---

## Quick Start

### 1. Install

```bash
npm install @logwatch/node
```

### 2. Instrument any Node.js service

```js
const { LogWatch } = require('@logwatch/node');

LogWatch.init({
  apiKey: process.env.LOGWATCH_API_KEY,  // from Settings → API Keys
  service: 'my-api',
  baseUrl: 'https://logwatch-production.up.railway.app',
}).attach();

// Works with Express, Fastify, Koa, NestJS, vanilla http — no changes needed
```

### 3. Ingest from any language via HTTP

```bash
curl -X POST https://logwatch-production.up.railway.app/api/ingest \
  -H "X-Api-Key: lw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      "2024-06-01T12:00:00Z ERROR payment-service HTTP POST /payments 500 3200ms",
      "2024-06-01T12:00:01Z ERROR payment-service HTTP POST /payments 500 4100ms"
    ]
  }'
# → {"accepted":2,"dropped":0}
```

Log line format: `{ISO 8601 timestamp} {LEVEL} {service} HTTP {METHOD} {path} {status} {latency}ms`

---

## Feature Vector

The IsolationForest model scores each 20-second window using 7 features:

| Feature | Description |
|---|---|
| Total Requests | Total HTTP requests in the window |
| Error Count | Requests with 5xx status |
| Warn Count | Requests with 4xx status |
| Info Count | Requests with 2xx/3xx status |
| Error Ratio | `errorCount / totalRequests` |
| Warn Ratio | `warnCount / totalRequests` |
| Unique Endpoints | Distinct URL paths observed |

A window is flagged as anomalous when its score falls below 0.0. Score < −0.1 → HIGH severity.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Node SDK | TypeScript, zero runtime deps | `http.Server.prototype.emit` patching; 5s batched ingest |
| Ingest API | Spring Boot 3.2, Java 21 | REST API, JWT + API key auth, Kafka producer |
| Message broker | Apache Kafka (Redpanda Cloud) | Decoupled ingest → ML; orgId as Kafka message key |
| Stream processor | Rust (Tokio), rdkafka 0.36 | Async high-throughput Kafka consumer |
| Log parser | nom (Rust) | Zero-copy structured log line parser |
| Feature extraction | Custom Rust sliding window | 7-dim vector per 20s per-service window |
| ML inference | ONNX Runtime (`ort` crate), IsolationForest | Anomaly scoring; no Python at runtime |
| Database | PostgreSQL 16 (Neon) | Anomaly persistence, API key store |
| ORM (Java) | Spring Data JPA / Hibernate | Entity mapping, DDL auto-update |
| SQL (Rust) | sqlx 0.7 | Async Postgres writes (no compile-time DB needed) |
| Frontend | React 19, Vite, Tailwind CSS 4 | Dashboard, anomaly detail, API key management |
| Charts | Recharts | Time-series anomaly visualisation |
| LLM assistant | Groq API (`llama-3.3-70b-versatile`) | Anomaly debugging panel on detail page |
| API client | TanStack Query, Axios | Data fetching with caching |
| ML training | Python, scikit-learn, skl2onnx | IsolationForest → ONNX export (52,632 samples) |
| CI/CD | GitHub Actions | Test → build → push ghcr.io → Railway deploy |
| Hosting (API + Engine) | Railway | Spring Boot + Rust Engine |
| Hosting (DB) | Neon | Serverless Postgres |
| Hosting (frontend + docs) | Vercel | React SPA + Docusaurus docs site |

---

## Folder Structure

```
logwatch/
├── .github/workflows/ci-cd.yml         # CI/CD pipeline
├── demo-service/
│   └── server.js                       # Demo Express service (payment + orders + auth)
├── docs/                               # Docusaurus v3 → logwatchdocssite.vercel.app
│   └── docs/
│       ├── intro.mdx
│       ├── quickstart.md
│       ├── sdk-reference.md
│       ├── api-reference.md
│       └── architecture.md
├── frontend/                           # React + Vite SPA → Vercel
│   └── src/
│       ├── pages/                      # Login, Register, Dashboard, AnomalyDetail, Settings
│       ├── context/                    # AuthContext (JWT + localStorage persistence)
│       └── api.ts
├── infra/
│   ├── docker-compose.yml              # Local dev stack
│   └── neon-schema.sql                 # PostgreSQL schema
├── rust-engine/                        # Rust engine → Railway
│   └── src/
│       ├── kafka/mod.rs                # Consumer; reads orgId from Kafka message key
│       ├── parser/mod.rs               # nom log parser
│       ├── features/mod.rs             # 20s sliding window, 7-feature extraction
│       ├── inference/mod.rs            # ONNX Runtime scoring
│       └── storage/mod.rs              # sqlx Postgres writes
├── sdk/                                # @logwatch/node (npm)
│   └── src/index.ts                    # http.Server.prototype.emit patching, flush loop
├── spring-api/                         # Spring Boot → Railway
│   └── src/main/java/com/logwatch/
│       ├── controller/                 # Auth, Ingest, Anomaly controllers
│       ├── security/                   # JWT filter, API key filter, SecurityConfig
│       └── service/                    # IngestService (raw log → Kafka)
└── training/                           # Python ML pipeline
    ├── train.py
    └── models/isolation_forest.onnx
```

---

## Live Demo

| | URL |
|---|---|
| **Dashboard** | https://logwatch-eight.vercel.app/ |
| **API** | https://logwatch-production.up.railway.app |
| **Docs** | https://logwatchdocssite.vercel.app |
| **npm** | https://www.npmjs.com/package/@logwatch/node |

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete free-tier deployment guide (Neon + Redpanda + Railway + Vercel).

---

## Contributing

```bash
# Rust engine
cd rust-engine && cargo test

# Spring Boot
cd spring-api && mvn test

# SDK
cd sdk && npm ci && npm run build
```

Fork → branch off `main` → open a pull request. CI must be green before merge.

---

## License

MIT © 2026 LogWatch
