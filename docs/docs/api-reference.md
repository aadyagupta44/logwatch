---
sidebar_position: 3
title: REST API Reference
description: Full reference for the LogWatch HTTP API.
---

# REST API Reference

Base URL: `https://api.logwatch.dev`

All JSON responses use `Content-Type: application/json`. Timestamps are ISO 8601 UTC strings.

## Authentication

LogWatch uses two auth schemes:

| Scheme | Header | Used for |
|---|---|---|
| **JWT** | `Authorization: Bearer <token>` | Dashboard user sessions. Obtain via `POST /auth/login`. |
| **API Key** | `X-Api-Key: <key>` | SDK and server-to-server calls. Generate in **Settings → API Keys**. |

---

## Endpoints

### Auth

---

#### `POST /auth/register`

Register a new user account.

| | |
|---|---|
| **Auth** | None |
| **Body** | `{ "email": string, "password": string, "orgName": string }` |

```bash
curl -X POST https://api.logwatch.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"s3cur3","orgName":"Acme"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "userId": "3f1b2c4d-...",
  "orgId": "8e9f0a1b-..."
}
```

---

#### `POST /auth/login`

Authenticate and receive a JWT.

| | |
|---|---|
| **Auth** | None |
| **Body** | `{ "email": string, "password": string }` |

```bash
curl -X POST https://api.logwatch.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"s3cur3"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

---

### Log Ingestion

---

#### `POST /api/ingest`

Ingest a batch of raw log lines. The SDK calls this automatically.

| | |
|---|---|
| **Auth** | API Key |
| **Body** | `{ "lines": string[], "service"?: string }` |
| **Limit** | Max 1 000 lines per request |

```bash
curl -X POST https://api.logwatch.dev/api/ingest \
  -H "X-Api-Key: lw_live_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      "2024-06-01T12:00:00Z INFO payment-service HTTP GET /api/charge 200 45ms",
      "2024-06-01T12:00:01Z ERROR payment-service HTTP POST /api/charge 500 4321ms"
    ],
    "service": "payment-service"
  }'
```

```json
{
  "accepted": 2,
  "dropped": 0
}
```

---

### Anomalies

---

#### `GET /anomalies`

List anomalies for the authenticated organisation, with optional filters.

| | |
|---|---|
| **Auth** | JWT |
| **Query params** | `service`, `severity` (`HIGH`\|`MEDIUM`), `from` (ISO 8601), `to` (ISO 8601), `page`, `size` |

```bash
curl "https://api.logwatch.dev/anomalies?severity=HIGH&from=2024-06-01T00:00:00Z" \
  -H "Authorization: Bearer eyJ..."
```

```json
{
  "content": [
    {
      "id": "a1b2c3d4-e5f6-...",
      "serviceName": "payment-service",
      "detectedAt": "2024-06-01T12:05:00Z",
      "anomalyScore": -0.42,
      "severity": "HIGH",
      "acknowledged": false,
      "featureVector": {
        "totalCount": 87,
        "errorCount": 43,
        "avgLatencyMs": 3812.5
      }
    }
  ],
  "totalElements": 14,
  "totalPages": 1,
  "number": 0,
  "size": 20
}
```

---

#### `GET /anomalies/{id}`

Get a single anomaly by ID.

| | |
|---|---|
| **Auth** | JWT |

```bash
curl "https://api.logwatch.dev/anomalies/a1b2c3d4-e5f6-..." \
  -H "Authorization: Bearer eyJ..."
```

```json
{
  "id": "a1b2c3d4-e5f6-...",
  "serviceName": "payment-service",
  "detectedAt": "2024-06-01T12:05:00Z",
  "anomalyScore": -0.42,
  "severity": "HIGH",
  "acknowledged": false,
  "featureVector": {
    "totalCount": 87,
    "errorCount": 43,
    "warnCount": 12,
    "avgLatencyMs": 3812.5,
    "p99LatencyMs": 7844.0,
    "uniqueErrorCount": 3,
    "errorRatio": 0.494
  }
}
```

---

#### `GET /anomalies/service/{name}`

Get all anomalies for a specific service name.

| | |
|---|---|
| **Auth** | JWT |

```bash
curl "https://api.logwatch.dev/anomalies/service/payment-service" \
  -H "Authorization: Bearer eyJ..."
```

```json
[
  {
    "id": "a1b2c3d4-...",
    "serviceName": "payment-service",
    "detectedAt": "2024-06-01T12:05:00Z",
    "severity": "HIGH",
    "acknowledged": false
  }
]
```

---

#### `GET /anomalies/summary`

Aggregate stats for the authenticated org (total count, breakdown by severity).

| | |
|---|---|
| **Auth** | JWT |

```bash
curl "https://api.logwatch.dev/anomalies/summary" \
  -H "Authorization: Bearer eyJ..."
```

```json
{
  "total": 42,
  "high": 8,
  "medium": 34,
  "acknowledged": 15,
  "unacknowledged": 27
}
```

---

#### `PATCH /anomalies/{id}/acknowledge`

Mark an anomaly as acknowledged (mutes further alerts for it).

| | |
|---|---|
| **Auth** | JWT |

```bash
curl -X PATCH "https://api.logwatch.dev/anomalies/a1b2c3d4-.../acknowledge" \
  -H "Authorization: Bearer eyJ..."
```

Response: `204 No Content`

---

#### `DELETE /anomalies/{id}`

Permanently delete an anomaly record.

| | |
|---|---|
| **Auth** | JWT |

```bash
curl -X DELETE "https://api.logwatch.dev/anomalies/a1b2c3d4-..." \
  -H "Authorization: Bearer eyJ..."
```

Response: `204 No Content`

---

### API Keys

---

#### `POST /api-keys`

Generate a new API key for the authenticated org.

| | |
|---|---|
| **Auth** | JWT |
| **Body** | `{ "name": string }` |

```bash
curl -X POST https://api.logwatch.dev/api-keys \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"name":"production-server"}'
```

```json
{
  "id": "k1l2m3n4-...",
  "name": "production-server",
  "key": "lw_live_sk_a1b2c3...",
  "createdAt": "2024-06-01T09:00:00Z"
}
```

:::caution
The `key` field is only returned **once** at creation time. Store it immediately.
:::

---

#### `GET /api-keys`

List all API keys for the authenticated org (keys are masked).

| | |
|---|---|
| **Auth** | JWT |

```bash
curl "https://api.logwatch.dev/api-keys" \
  -H "Authorization: Bearer eyJ..."
```

```json
[
  {
    "id": "k1l2m3n4-...",
    "name": "production-server",
    "keyPreview": "lw_live_sk_a1b2...****",
    "createdAt": "2024-06-01T09:00:00Z"
  }
]
```

---

#### `DELETE /api-keys/{id}`

Revoke an API key immediately.

| | |
|---|---|
| **Auth** | JWT |

```bash
curl -X DELETE "https://api.logwatch.dev/api-keys/k1l2m3n4-..." \
  -H "Authorization: Bearer eyJ..."
```

Response: `204 No Content`

---

## Error responses

All error responses follow this shape:

```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "JWT token is expired or invalid"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request — malformed JSON or missing required field |
| `401` | Unauthenticated — missing or invalid credentials |
| `403` | Forbidden — the resource belongs to another org |
| `404` | Not found |
| `422` | Validation error — payload exceeds limits |
| `500` | Internal server error |
