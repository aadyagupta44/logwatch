---
sidebar_position: 4
title: Architecture
description: End-to-end system design of the LogWatch anomaly detection pipeline.
---

# Architecture

LogWatch is a streaming ML pipeline. Logs flow from your application through a chain of services — ingestion, buffering, feature extraction, inference, storage, and finally the dashboard — with each stage decoupled from the next via Kafka.

---

## System diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Your Application                              │
│                                                                        │
│   LogWatch.init({ apiKey, service }).attach()                         │
│   (patches http.Server.prototype.emit — any Node.js framework)        │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  POST /api/ingest  (API Key auth)
                                │  { "logs": ["...log lines..."] }
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        Spring Boot API  :8080                         │
│                                                                        │
│   • Validates API key  →  resolves orgId                              │
│   • Publishes raw log lines to Kafka (orgId as message key)           │
│   • Exposes REST endpoints for dashboard (JWT auth)                   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  Kafka producer  (topic: raw-logs)
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Apache Kafka  (Redpanda Cloud)                      │
│                                                                        │
│   Topics:                                                              │
│     raw-logs       ──►  consumed by Rust Engine                       │
│     anomaly-alerts ◄──  produced by Rust Engine                       │
└──────────────┬────────────────────────────────────────────────────────┘
               │  Kafka consumer  (group: rust-engine-group)
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       Rust Engine                                      │
│                                                                        │
│  ┌────────────┐    ┌──────────────────┐    ┌────────────────────────┐ │
│  │ nom parser │ →  │ Sliding Window   │ →  │ Feature Extraction     │ │
│  │            │    │ (20 s per svc)   │    │ 7-dim vector:          │ │
│  └────────────┘    └──────────────────┘    │  total_count           │ │
│                                            │  error_count           │ │
│                                            │  warn_count            │ │
│                                            │  info_count            │ │
│                                            │  error_ratio           │ │
│                                            │  warn_ratio            │ │
│                                            │  unique_endpoints      │ │
│                                            └──────────┬─────────────┘ │
│                                                       │               │
│                                         ┌─────────────▼─────────────┐ │
│                                         │ ONNX Inference             │ │
│                                         │ IsolationForest model      │ │
│                                         │ score < 0.0 → anomaly     │ │
│                                         │ score < -0.1 → HIGH sev.  │ │
│                                         └─────────────┬─────────────┘ │
└──────────────┬────────────────────────────────────────┘               │
               │  INSERT anomaly row
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL  (Neon)                               │
│                                                                        │
│   Table: anomalies                                                     │
│   ─────────────────────────────────────────────────────               │
│   id UUID PK                                                           │
│   service_name TEXT                                                    │
│   detected_at  TIMESTAMPTZ                                             │
│   anomaly_score REAL                                                   │
│   severity TEXT  (HIGH | MEDIUM)                                       │
│   feature_vector JSONB                                                 │
│   org_id UUID                                                          │
│   acknowledged BOOLEAN                                                 │
└──────────────┬────────────────────────────────────────────────────────┘
               │  JPA queries (Spring Data)
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     Spring Boot API  :8080  (same instance)           │
│                                                                        │
│   GET  /anomalies              →  paginated anomaly list              │
│   GET  /anomalies/summary      →  org-level stats                     │
│   PATCH /anomalies/{id}/ack    →  mark acknowledged                   │
└──────────────┬────────────────────────────────────────────────────────┘
               │  REST + polling  (JWT auth)
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      React Dashboard  (Vercel)                         │
│                                                                        │
│   • Anomaly feed with real-time polling                               │
│   • Per-service severity timeline                                     │
│   • Anomaly detail                                                    │
│     – plain-English description generated from feature vector         │
│     – 7-feature breakdown with percentage bars                        │
│     – Ask LLM panel (Groq llama-3.3-70b-versatile) for debugging     │
│   • Acknowledge / delete actions                                      │
│   • API key management                                                │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Component breakdown

### `@logwatch/node` SDK

A lightweight Node.js agent (zero runtime dependencies) that patches `http.Server.prototype.emit` at the Node.js core level. Because it operates below any framework, it automatically captures every HTTP request your server handles — no middleware, no console intercepting, no per-route instrumentation. Lines are buffered in memory and flushed every 5 seconds (or when the buffer reaches 100 lines) via `POST /api/ingest`. Configured with `apiKey`, `service`, `flushInterval`, and `batchSize`. Emits `flushed` and `error` events.

### Spring Boot API

The user-facing gateway. Handles registration, login, API key management, and anomaly queries. On ingest it validates the API key, resolves the organisation, and publishes raw log lines to Kafka with the `orgId` as the Kafka message key — keeping the HTTP response fast and pushing all ML work downstream. Also reads anomalies back from Postgres and serves them to the React dashboard.

### Apache Kafka (Redpanda Cloud)

The durable message bus between ingestion and processing. Two topics:
- **`raw-logs`** — ingested by Spring, consumed by Rust Engine. OrgId is carried as the Kafka message key so the Rust engine never needs a DB lookup to attribute anomalies.
- **`anomaly-alerts`** — published by Rust Engine for downstream consumers (webhooks, Slack, PagerDuty).

Kafka decouples the ingest rate from the ML inference throughput and provides a replayable audit log.

### Rust Engine

The performance-critical stream processor. Written in async Rust with Tokio. Runs a `StreamConsumer` loop that:
1. Reads the `orgId` from the Kafka message key.
2. Parses each log line with a `nom`-based zero-copy parser.
3. Aggregates lines into per-service **20-second sliding windows**.
4. When a window closes, extracts a 7-dimensional feature vector.
5. Runs the feature vector through an ONNX IsolationForest model.
6. If the anomaly score is below 0.0, persists an anomaly row to Postgres and publishes to `anomaly-alerts`.

### ONNX IsolationForest model

Trained offline on synthetic HTTP log data (52,632 samples matching the feature distributions of real HTTP service logs). The model is an unsupervised IsolationForest (100 estimators, 5% contamination) exported to ONNX with `skl2onnx` via `training/train.py`. At inference time `ort` loads it as a native ONNX Runtime session. No Python interpreter at runtime.

### PostgreSQL

Single relational store for users, organisations, API keys, and anomalies. Spring Boot accesses it via Spring Data JPA (Hibernate). The Rust Engine writes anomalies directly with `sqlx`.

### React Dashboard

A Vite-based SPA served on Vercel. Authenticates via JWT (persisted to localStorage across page refreshes), polls the Spring Boot API for anomaly feeds, and lets users acknowledge or delete anomaly records and manage API keys.

**Anomaly detail page** generates a plain-English description from the feature vector values, shows a breakdown of all 7 model inputs, and provides an "Ask LLM" panel: a Groq-backed chat interface pre-loaded with the full anomaly context. Users can ask diagnostic questions like "what could cause this error spike?" and get answers from `llama-3.3-70b-versatile` in under two seconds.

---

## Data flow summary

```
SDK  →  Spring Boot (ingest)  →  Kafka raw-logs  →  Rust Engine
                                                        ↓
                                               ONNX inference
                                                        ↓
                                                   Postgres
                                                        ↓
                                            Spring Boot (read API)
                                                        ↓
                                              React Dashboard
```

The entire path from a log line being emitted in your app to it appearing as an anomaly in the dashboard takes under **30 seconds** in normal conditions (20 s sliding window + ~5 s Kafka latency + ~1 s DB write + polling interval).

---

## ML model details

| Property | Value |
|---|---|
| Algorithm | IsolationForest |
| Training data | Synthetic HTTP log data (52,632 samples, `training/train.py`) |
| Features | 7-dimensional (total requests, error/warn/info counts, error/warn ratios, unique endpoints) |
| Contamination | 5% |
| Estimators | 100 |
| Anomaly threshold | score < 0.0 |
| HIGH severity | score < −0.1 |
| Export format | ONNX (skl2onnx), 787.8 KB |
| Runtime | ONNX Runtime via `ort` crate, no Python |
