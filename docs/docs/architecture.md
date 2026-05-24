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
│   console.log("Payment processed")  ──►  @logwatch/node SDK           │
│                                          (batches, gzip, HTTP POST)   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  POST /api/ingest  (API Key auth)
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        Spring Boot API  :8080                         │
│                                                                        │
│   • Validates API key  →  resolves orgId                              │
│   • Parses & enriches log lines                                       │
│   • Publishes batches to Kafka topic  raw-logs                        │
│   • Exposes REST endpoints for dashboard (JWT auth)                   │
│   • Exposes  /actuator/prometheus  for metrics scraping               │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  Kafka producer  (topic: raw-logs)
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Apache Kafka  :9092                                 │
│                                                                        │
│   Topics:                                                              │
│     raw-logs       ──►  consumed by Rust Engine                       │
│     anomaly-alerts ◄──  produced by Rust Engine                       │
└──────────────┬────────────────────────────────────────────────────────┘
               │  Kafka consumer  (group: rust-engine-group)
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       Rust Engine  :9090                               │
│                                                                        │
│  ┌────────────┐    ┌──────────────────┐    ┌────────────────────────┐ │
│  │ nom parser │ →  │ Sliding Window   │ →  │ Feature Extraction     │ │
│  │            │    │ (60 s per svc)   │    │ 7-dim vector:          │ │
│  └────────────┘    └──────────────────┘    │  total_count           │ │
│                                            │  error_count           │ │
│                                            │  warn_count            │ │
│                                            │  info_count            │ │
│                                            │  error_ratio           │ │
│                                            │  warn_ratio            │ │
│                                            │  unique_components     │ │
│                                            └──────────┬─────────────┘ │
│                                                       │               │
│                                         ┌─────────────▼─────────────┐ │
│                                         │ ONNX Inference             │ │
│                                         │ IsolationForest model      │ │
│                                         │ score < 0.0 → anomaly     │ │
│                                         │ score < -0.1 → HIGH sev.  │ │
│                                         └─────────────┬─────────────┘ │
│                                                       │               │
│                              ┌────────────────────────▼──────────────┐│
│                              │  Metrics (Prometheus /metrics)        ││
│                              │  logwatch_logs_processed_total        ││
│                              │  logwatch_anomalies_detected_total    ││
│                              │  logwatch_inference_duration_ms       ││
│                              │  logwatch_kafka_consumer_lag          ││
│                              └───────────────────────────────────────┘│
└──────────────┬────────────────────────────────────────────────────────┘
               │  INSERT anomaly row
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL  :5432                                │
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
               │  REST + WebSocket (JWT auth)
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      React Dashboard  :5173                            │
│                                                                        │
│   • Anomaly feed with real-time updates                               │
│   • Per-service severity timeline                                     │
│   • Acknowledge / delete actions                                      │
│   • API key management                                                │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                     Observability Layer                                │
│                                                                        │
│   Prometheus :9091  ──scrapes──►  rust-engine:9090/metrics            │
│                     ──scrapes──►  spring-api:8080/actuator/prometheus │
│                                                                        │
│   Grafana    :3000  ──queries──►  Prometheus                          │
│   6 panels: logs/sec, anomalies/sec, inference p99,                   │
│             Kafka lag, API request rate, anomaly pie chart            │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Component breakdown

### `@logwatch/node` SDK

A lightweight Node.js agent that intercepts `console.*` calls, buffers lines in memory, and flushes batches to the Spring Boot ingest endpoint over HTTPS. Configured with `apiKey`, `service`, `flushInterval`, and `maxBatchSize`. Emits `onFlush` and `onError` events.

### Spring Boot API

The user-facing gateway. Handles registration, login, API key management, and anomaly queries. On ingest it validates the API key, resolves the organisation, and publishes raw log lines to Kafka without any ML processing — keeping the HTTP response fast. Also reads anomalies back from Postgres and serves them to the React dashboard.

### Apache Kafka

The durable message bus between ingestion and processing. Two topics:
- **`raw-logs`** — ingested by Spring, consumed by Rust Engine.
- **`anomaly-alerts`** — published by Rust Engine for downstream consumers (webhooks, Slack, PagerDuty).

Kafka decouples the ingest rate from the ML inference throughput and provides a replayable audit log.

### Rust Engine

The performance-critical stream processor. Written in async Rust with Tokio. Runs a `StreamConsumer` loop that:
1. Parses each log line with a `nom`-based parser.
2. Aggregates lines into per-service 60-second sliding windows.
3. When a window closes, extracts a 7-dimensional feature vector.
4. Runs the feature vector through an ONNX IsolationForest model.
5. If the anomaly score is below 0.0, persists an anomaly row to Postgres and publishes to `anomaly-alerts`.

The Rust Engine also exposes a Prometheus `/metrics` endpoint on port 9090.

### ONNX IsolationForest model

Trained offline on synthetic HTTP log data (52,632 samples matching the feature distributions of real HTTP service logs). The model is an unsupervised IsolationForest (100 estimators, 5% contamination) exported to ONNX with `skl2onnx` via `training/retrain_http.py`. At inference time `ort` loads it as a native ONNX Runtime session. No Python interpreter at runtime.

### PostgreSQL

Single relational store for users, organisations, API keys, and anomalies. Spring Boot accesses it via Spring Data JPA (Hibernate). The Rust Engine writes anomalies directly with `sqlx`.

### React Dashboard

A Vite-based SPA served on port 5173. Authenticates via JWT, polls the Spring Boot API for anomaly feeds, and lets users acknowledge or delete anomaly records and manage API keys.

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

The entire path from a log line being emitted in your app to it appearing as an anomaly in the dashboard takes under **90 seconds** in normal conditions (60 s sliding window + ~5 s Kafka latency + ~1 s DB write + polling interval).

---

## ML model details

| Property | Value |
|---|---|
| Algorithm | IsolationForest |
| Training data | Synthetic HTTP log data (52,632 samples, `training/retrain_http.py`) |
| Features | 7-dimensional (see feature vector above) |
| Contamination | 5% |
| Estimators | 100 |
| Anomaly threshold | score < 0.0 |
| HIGH severity | score < −0.1 |
| Export format | ONNX (skl2onnx), 787.8 KB |
| Runtime | ONNX Runtime via `ort` crate, no Python |
