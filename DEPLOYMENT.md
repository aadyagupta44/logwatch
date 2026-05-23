# LogWatch — Free-Tier Deployment Guide

Deploy the full LogWatch stack to production at zero cost using:

| Service | Provider | Free tier |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | 0.5 GB storage, 1 compute unit |
| Kafka | [Upstash](https://upstash.com) | 10 000 messages/day |
| Spring Boot API | [Railway](https://railway.app) | $5 credit/month (~500 hours) |
| Rust Engine | [Railway](https://railway.app) | same credit pool |
| React frontend | [Vercel](https://vercel.com) | unlimited |
| Docs site | [Vercel](https://vercel.com) | unlimited |

**Estimated time:** 45 minutes.

---

## Prerequisites

- GitHub account with this repo pushed (Railway and Vercel deploy from GitHub)
- Node.js 18+ installed locally
- Git CLI

Push the repo if you haven't already:

```bash
cd c:\logwatch
git add -A
git commit -m "add deployment configs"
git push origin main
```

---

## Step 1 — Create the Neon PostgreSQL database

1. Go to **https://console.neon.tech** → sign up → **New Project**.
2. Name it `logwatch`, choose region closest to you, click **Create Project**.
3. Neon shows the connection string — copy the **postgres:// URI**:
   ```
   postgresql://neondb_owner:<password>@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Open the **SQL Editor** tab → paste and run `infra/neon-schema.sql`.
5. Verify with:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
   You should see: `anomalies`, `api_keys`, `organisations`, `users`.

**Values to save from this step:**

| Variable | Where to find it | Example |
|---|---|---|
| `DATABASE_URL` | Neon dashboard → Connection Details (postgres:// URI) | `postgres://neondb_owner:abc@ep-xxx.neon.tech/neondb?sslmode=require` |
| `DB_URL` | Same URI — replace `postgresql://` with `jdbc:postgresql://` and remove `?sslmode=require` from the path, append `?sslmode=require` | `jdbc:postgresql://ep-xxx.neon.tech/neondb?sslmode=require` |
| `DB_USERNAME` | User in the connection string | `neondb_owner` |
| `DB_PASSWORD` | Password in the connection string | (shown once) |

---

## Step 2 — Create the Upstash Kafka cluster

1. Go to **https://console.upstash.com** → sign up → **Kafka** → **Create Cluster**.
2. Name it `logwatch`, pick a region → **Create**.
3. Click **Create Topic** → name it `raw-logs`, partitions = 1 → **Create**.
4. Repeat for topic `anomaly-alerts`.
5. Under **Details → Connect** click **SASL** and copy:
   - **Bootstrap Server** (e.g. `loved-condor-12345-us1-kafka.upstash.io:9092`)
   - **SASL Username**
   - **SASL Password**
6. Copy the **SASL/SCRAM JAAS config string** shown on the page — it looks like:
   ```
   org.apache.kafka.common.security.scram.ScramLoginModule required username="xxx" password="yyy";
   ```

**Values to save from this step:**

| Variable | Where to find it |
|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Bootstrap server (host:port) |
| `KAFKA_USERNAME` | SASL Username |
| `KAFKA_PASSWORD` | SASL Password |
| `KAFKA_SASL_JAAS_CONFIG` | Full JAAS config string (for Spring Boot) |
| `KAFKA_SECURITY_PROTOCOL` | Always `SASL_SSL` for Upstash |
| `KAFKA_SASL_MECHANISM` | Always `SCRAM-SHA-256` |

---

## Step 3 — Deploy Spring Boot API to Railway

1. Go to **https://railway.app** → sign up → **New Project** → **Deploy from GitHub repo**.
2. Select your `logwatch` repository.
3. Railway detects multiple services — click **Add Service** → select the `spring-api/` directory. Or choose **Empty Service**, set **Source → GitHub Repo**, and set **Root Directory** to `spring-api`.
4. Railway auto-detects Maven via `railway.toml` and builds with `mvn package -DskipTests`.
5. Under **Variables**, add every variable below. Click **+ Add Variable** for each:

   ```
   DB_URL          = jdbc:postgresql://ep-xxx.neon.tech/neondb?sslmode=require
   DB_USERNAME     = neondb_owner
   DB_PASSWORD     = <your neon password>
   JWT_SECRET      = <run: openssl rand -hex 32>
   KAFKA_BOOTSTRAP_SERVERS  = loved-condor-12345-us1-kafka.upstash.io:9092
   KAFKA_SECURITY_PROTOCOL  = SASL_SSL
   KAFKA_SASL_MECHANISM     = SCRAM-SHA-256
   KAFKA_SASL_JAAS_CONFIG   = org.apache.kafka.common.security.scram.ScramLoginModule required username="..." password="...";
   CORS_ALLOWED_ORIGINS     = https://your-frontend.vercel.app   ← fill in after Step 5
   ```

6. Click **Deploy**. Wait for the build to complete (~3 minutes).
7. Under **Settings → Networking → Public Networking**, click **Generate Domain**.
   Copy the URL — e.g. `https://spring-api-production-xxxx.up.railway.app`.

> **Verify:** `curl https://spring-api-production-xxxx.up.railway.app/actuator/health`
> Should return `{"status":"UP"}`.

---

## Step 4 — Deploy Rust Engine to Railway

1. In the same Railway project → **New Service** → **GitHub Repo** → same repo.
2. Under **Settings → Source**:
   - Set **Root Directory** to `/` (project root — the Dockerfile needs to copy `training/models/` and `rust-engine/src`).
   - Set **Dockerfile Path** to `rust-engine/Dockerfile`.
3. Under **Variables**, add:

   ```
   DATABASE_URL             = postgres://neondb_owner:<password>@ep-xxx.neon.tech/neondb?sslmode=require
   KAFKA_BROKERS            = loved-condor-12345-us1-kafka.upstash.io:9092
   KAFKA_SECURITY_PROTOCOL  = SASL_SSL
   KAFKA_USERNAME           = <upstash sasl username>
   KAFKA_PASSWORD           = <upstash sasl password>
   RUST_LOG                 = info
   ```

4. Click **Deploy**. The Rust build takes 10–15 minutes on first run.
5. The Rust engine has no public HTTP endpoints to test, but Railway's build logs will show:
   ```
   INFO rust-engine starting up
   INFO Metrics endpoint: http://0.0.0.0:9090/metrics
   INFO Kafka consumer started for topic raw-logs
   ```

> **Note:** The ONNX model file (`training/models/isolation_forest.onnx`) must be committed to git. It is 462 KB and within GitHub's file size limits. Verify with:
> ```bash
> git ls-files training/models/isolation_forest.onnx
> ```
> If it's missing from git, add it: `git add -f training/models/isolation_forest.onnx`

---

## Step 5 — Deploy React Frontend to Vercel

1. Go to **https://vercel.com** → sign up → **Add New Project** → import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Vercel auto-detects Vite. Framework: **Vite**. Build command: `npm run build`. Output: `dist`.
4. Under **Environment Variables**, add:
   ```
   VITE_API_BASE_URL = https://spring-api-production-xxxx.up.railway.app
   ```
5. Click **Deploy**. Build takes ~1 minute.
6. Vercel gives you a URL like `https://logwatch-frontend-xxx.vercel.app`.

**Go back to Railway → Spring Boot service → Variables** and update:
```
CORS_ALLOWED_ORIGINS = https://logwatch-frontend-xxx.vercel.app
```
Then redeploy the Spring Boot service (click **Redeploy**).

> **Verify:** Open `https://logwatch-frontend-xxx.vercel.app` → the login page loads.

---

## Step 6 — Deploy Docs Site to Vercel

1. In Vercel → **Add New Project** → same repo.
2. Set **Root Directory** to `docs`.
3. Framework: **Other**. Build command: `npm run build`. Output: `build`.
4. No environment variables needed.
5. Click **Deploy**. URL: `https://logwatch-docs-xxx.vercel.app`.

> **Verify:** Open the docs URL → Quickstart, SDK, API, Architecture pages all render.

---

## Step 7 — Run the schema (if not done in Step 1)

If you skipped the SQL Editor in Step 1, run the schema now:

```bash
# Install psql if needed: https://www.postgresql.org/download/
psql "postgres://neondb_owner:<password>@ep-xxx.neon.tech/neondb?sslmode=require" \
  -f infra/neon-schema.sql
```

---

## Step 8 — Verify end-to-end

### Register and log in

```bash
API=https://spring-api-production-xxxx.up.railway.app

# Register
curl -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Test1234!","organisationName":"Acme"}'
# → {"token":"eyJ...","apiKey":"lw_..."}

# Save the JWT
TOKEN=eyJ...
API_KEY=lw_...
```

### Ingest a test log batch

```bash
curl -X POST $API/api/ingest \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      "2024-06-01T12:00:00Z ERROR payment-service HTTP GET /api/charge 500 5234ms",
      "2024-06-01T12:00:01Z ERROR payment-service HTTP GET /api/charge 500 4921ms",
      "2024-06-01T12:00:02Z ERROR payment-service HTTP GET /api/charge 500 6100ms"
    ]
  }'
# → {"accepted":3,"dropped":0}
```

### Wait ~60 seconds for the Rust engine to process the window, then query anomalies

```bash
curl $API/anomalies \
  -H "Authorization: Bearer $TOKEN"
# → {"content":[...],"totalElements":1,...}
```

### Open the dashboard

Navigate to `https://logwatch-frontend-xxx.vercel.app` → Log in → Dashboard shows your first anomaly.

---

## Environment variable reference

### Spring Boot API (Railway)

| Variable | Required | Where to get it |
|---|---|---|
| `DB_URL` | Yes | Neon connection string, `postgresql://` → `jdbc:postgresql://` |
| `DB_USERNAME` | Yes | Neon connection string |
| `DB_PASSWORD` | Yes | Neon connection string |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` |
| `KAFKA_BOOTSTRAP_SERVERS` | Yes | Upstash → Cluster → Details |
| `KAFKA_SECURITY_PROTOCOL` | Yes | Always `SASL_SSL` for Upstash |
| `KAFKA_SASL_MECHANISM` | Yes | Always `SCRAM-SHA-256` |
| `KAFKA_SASL_JAAS_CONFIG` | Yes | Upstash → Connect → SASL JAAS config |
| `CORS_ALLOWED_ORIGINS` | Yes | Your Vercel frontend URL |

### Rust Engine (Railway)

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string (postgres:// form) |
| `KAFKA_BROKERS` | Yes | Upstash bootstrap server |
| `KAFKA_SECURITY_PROTOCOL` | Yes | `SASL_SSL` |
| `KAFKA_USERNAME` | Yes | Upstash SASL username |
| `KAFKA_PASSWORD` | Yes | Upstash SASL password |
| `RUST_LOG` | No | `info` (recommended) |

### React Frontend (Vercel)

| Variable | Required | Where to get it |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Railway Spring Boot public URL |

---

## Troubleshooting

**Spring Boot crashes on start → `HikariPool connection timeout`**
- Check `DB_URL` starts with `jdbc:postgresql://`, not `postgres://`.
- Ensure Neon project is not suspended (free tier sleeps after inactivity — wake it via the Neon console).

**Rust engine exits → `Failed to connect to Postgres`**
- `DATABASE_URL` must start with `postgres://` or `postgresql://`, not `jdbc:`.
- Verify `?sslmode=require` is appended.

**Kafka connection refused / SASL errors**
- `KAFKA_SASL_JAAS_CONFIG` must be the exact string from Upstash including the trailing semicolon.
- `KAFKA_SECURITY_PROTOCOL=SASL_SSL` and `KAFKA_SASL_MECHANISM=SCRAM-SHA-256` must both be set.

**Frontend shows blank page / API errors**
- Open browser DevTools → Network tab → look for CORS errors.
- Ensure `CORS_ALLOWED_ORIGINS` in Railway exactly matches your Vercel URL (no trailing slash).
- After updating the variable, redeploy the Spring Boot service.

**Rust Docker build fails on Railway → "cannot copy training/models"**
- The ONNX model must be committed to git. Run:
  ```bash
  git add -f training/models/isolation_forest.onnx && git commit -m "add onnx model" && git push
  ```
- Confirm Railway root directory is `/` (not `rust-engine/`).
