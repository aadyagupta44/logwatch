# LogWatch

[![CI/CD](https://github.com/aadyagupta44/logwatch/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/aadyagupta44/logwatch/actions/workflows/ci-cd.yml)
[![npm version](https://img.shields.io/npm/v/@logwatch/node)](https://www.npmjs.com/package/@logwatch/node)
[![Docker Image Size](https://img.shields.io/docker/image-size/aadyagupta44/logwatch-rust-engine/latest)](https://ghcr.io/aadyagupta44/logwatch-rust-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

AI-powered log anomaly detection SaaS. Ship logs from any service, get real-time anomaly alerts scored by a machine learning model running in a high-throughput Rust engine — no manual threshold tuning required.

---

## Architecture

```
  Your Services
      │
      │  POST /api/ingest  (X-Api-Key)
      ▼
┌─────────────────┐        ┌────────────────────┐
│  Spring Boot    │──raw──▶│  Kafka (Upstash)   │
│  REST API       │  logs  │  topic: raw-logs   │
│  :8080          │        └────────────────────┘
│                 │                  │
│  JWT + API Key  │                  │ consume
│  auth           │                  ▼
│  Hibernate JPA  │        ┌────────────────────┐
│  /actuator/     │        │  Rust Engine       │
│  prometheus     │        │  :9090 /metrics    │
└────────┬────────┘        │                    │
         │                 │  nom log parser    │
         │                 │  SlidingWindow     │
         │ write           │  ONNX inference    │
         │ anomalies       │  (Isolation Forest)│
         ▼                 └─────────┬──────────┘
┌─────────────────┐                 │
│  PostgreSQL     │◀────────────────┘
│  (Neon)         │  write anomaly
│                 │
│  organisations  │        ┌────────────────────┐
│  users          │        │  Kafka (Upstash)   │
│  api_keys       │        │  topic:            │
│  anomalies      │        │  anomaly-alerts    │
└─────────────────┘        └────────────────────┘

┌─────────────────┐        ┌────────────────────┐
│  React Frontend │        │  Prometheus +      │
│  (Vercel)       │        │  Grafana           │
│  Vite + Recharts│        │  6-panel dashboard │
└─────────────────┘        └────────────────────┘
```

---

## Quick Start

Requires Docker and Docker Compose.

```bash
git clone https://github.com/aadyagupta44/logwatch.git
cd logwatch/infra
docker compose up -d
```

Services start on:

| Service | URL |
|---|---|
| Spring Boot API | http://localhost:8080 |
| React Frontend | http://localhost:5173 |
| Grafana | http://localhost:3000 (admin / admin) |
| Prometheus | http://localhost:9091 |
| Rust Engine metrics | http://localhost:9090/metrics |

Register and send your first logs:

```bash
# Register
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Test1234!","organisationName":"Acme"}'
# → {"token":"eyJ...","apiKey":"lw_..."}

# Ingest logs
curl -X POST http://localhost:8080/api/ingest \
  -H "X-Api-Key: lw_..." \
  -H "Content-Type: application/json" \
  -d '{"lines":["2024-06-01T12:00:00Z ERROR payment-service HTTP GET /api/charge 500 5234ms"]}'
```

Or use the Node.js SDK:

```bash
npm install @logwatch/node
```

```typescript
import LogWatch from '@logwatch/node';

const lw = new LogWatch({ apiKey: 'lw_...', baseUrl: 'http://localhost:8080' });
lw.attach();
lw.log('2024-06-01T12:00:00Z ERROR payment-service HTTP GET /charge 500 4200ms');
```

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Ingest API | Spring Boot 3.2, Java 21 | REST API, JWT + API key auth, Kafka producer |
| Stream processor | Rust (Tokio), rdkafka 0.36 | High-throughput Kafka consumer |
| ML inference | ONNX Runtime (ort), Isolation Forest | Anomaly scoring, no DB lookup at inference time |
| Log parser | nom (Rust) | Zero-copy nom parser for structured log lines |
| Message broker | Apache Kafka (Upstash) | Decoupled ingest → processing pipeline |
| Database | PostgreSQL 16 (Neon) | Anomaly persistence, API key store |
| ORM (Java) | Spring Data JPA / Hibernate | Entity mapping, DDL auto-update |
| SQL (Rust) | sqlx 0.7 | Async Postgres queries (runtime, no compile-time DB) |
| Frontend | React 19, Vite, Tailwind CSS 4 | Dashboard, anomaly list, settings |
| Charts | Recharts | Time-series anomaly visualisation |
| API client | TanStack Query, Axios | Data fetching with caching |
| Metrics (Rust) | metrics + metrics-exporter-prometheus | Prometheus scrape endpoint :9090/metrics |
| Metrics (Java) | Micrometer, Spring Actuator | /actuator/prometheus scrape endpoint |
| Observability | Prometheus + Grafana | 6-panel real-time dashboard |
| Node SDK | TypeScript, zero runtime deps | Log streaming, batch ingest |
| ML training | Python, scikit-learn, onnxmltools | Isolation Forest → ONNX export |
| CI/CD | GitHub Actions | Test → build → push to ghcr.io → Railway deploy |
| Container registry | GitHub Container Registry (ghcr.io) | Docker image storage |
| Hosting (API) | Railway | Spring Boot + Rust Engine |
| Hosting (DB) | Neon | Serverless Postgres |
| Hosting (frontend) | Vercel | React SPA + docs site |

---

## Folder Structure

```
logwatch/
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # 5-job CI/CD pipeline
├── docs/                       # Docusaurus v3 docs site
│   ├── docs/
│   │   ├── quickstart.md
│   │   ├── sdk-reference.md
│   │   ├── api-reference.md
│   │   └── architecture.md
│   └── docusaurus.config.ts
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── pages/              # Login, Register, Dashboard, Anomaly, Settings
│   │   ├── context/            # AuthContext (JWT)
│   │   └── api.ts              # Central axios instance
│   └── vercel.json
├── infra/
│   ├── docker-compose.yml      # Full local stack
│   ├── neon-schema.sql         # PostgreSQL schema
│   ├── prometheus.yml          # Scrape config
│   └── grafana/
│       └── provisioning/
│           └── dashboards/
│               └── logwatch.json   # 6-panel Grafana dashboard
├── rust-engine/                # Rust anomaly detection engine
│   ├── src/
│   │   ├── main.rs             # Prometheus metrics setup, startup
│   │   ├── kafka/mod.rs        # Consumer, producer, lag gauge
│   │   ├── parser/mod.rs       # nom log line parser
│   │   ├── features/mod.rs     # SlidingWindow feature extraction
│   │   ├── inference/mod.rs    # ONNX Runtime scoring
│   │   └── storage/mod.rs      # sqlx Postgres writes
│   ├── Dockerfile
│   └── railway.toml
├── sdk/                        # @logwatch/node TypeScript SDK
│   ├── src/index.ts
│   ├── package.json
│   └── tsconfig.json
├── spring-api/                 # Spring Boot REST API
│   ├── src/main/java/com/logwatch/
│   │   ├── controller/         # AuthController, IngestController, AnomalyController
│   │   ├── security/           # JWT filter, API key filter, SecurityConfig
│   │   ├── metrics/            # LogwatchMetrics, MetricsInterceptor
│   │   └── config/             # Kafka, JPA, metrics web config
│   ├── Dockerfile
│   └── railway.toml
├── training/                   # Python ML training pipeline
│   ├── train.py                # Isolation Forest training → ONNX export
│   ├── simulate_logs.py        # Log simulator with anomaly injection
│   ├── models/
│   │   └── isolation_forest.onnx
│   └── requirements.txt
├── DEPLOYMENT.md               # Step-by-step free-tier deployment guide
└── README.md
```

---

## Live Demo

- **Frontend:** https://logwatch-frontend-xxx.vercel.app *(update after Vercel deploy)*
- **API docs (Swagger):** https://spring-api-production-xxxx.up.railway.app/swagger-ui.html
- **Docs site:** https://logwatch-docs-xxx.vercel.app *(update after Vercel deploy)*

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete 45-minute free-tier setup guide.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make changes; ensure all tests pass locally:
   ```bash
   # Rust
   cd rust-engine && cargo test
   # Spring Boot
   cd spring-api && mvn test
   # SDK
   cd sdk && npm ci && npm run build
   ```
3. Push and open a pull request against `main`.
4. CI runs automatically — all 5 jobs must be green before merge.

---

## License

MIT © 2024 LogWatch contributors
