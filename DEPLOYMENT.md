# LogWatch — Deployment Guide

Deploy the full LogWatch stack to production at zero cost using:

| Service | Provider | Free tier |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | 0.5 GB storage, 1 compute unit |
| Kafka | [Redpanda Cloud](https://cloud.redpanda.com) | Serverless free tier |
| Spring Boot API | [Railway](https://railway.app) | $5 credit/month (~500 hours) |
| Rust Engine | [Railway](https://railway.app) | same credit pool |
| React frontend | [Vercel](https://vercel.com) | unlimited |
| Docs site | [Vercel](https://vercel.com) | unlimited |
| Node.js SDK | [npm](https://npmjs.com/package/@logwatch/node) | free forever |

**Estimated time:** 60 minutes.

---

## Prerequisites

- GitHub account with this repo pushed (Railway and Vercel deploy from GitHub)
- npm account (for SDK publishing)

Push the repo if you haven't already:

```bash
git add -A
git commit -m "initial deployment"
git push origin main
```

---

## Step 1 — Create the Neon PostgreSQL database

1. Go to **https://console.neon.tech** → sign up → **New Project**.
2. Name it `logwatch`, choose **PostgreSQL 16**, region **AWS us-east-2 (Ohio)** → **Create Project**.
3. Skip Neon Auth — not needed, LogWatch uses its own JWT auth.
4. Copy the **postgres:// connection string** from the dashboard.
5. Open the **SQL Editor** tab → paste and run `infra/neon-schema.sql`.
6. Verify with:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
   You should see: `anomalies`, `api_keys`, `organisations`, `users`.

**Values to save from this step:**

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | The `postgresql://` URI as-is (for Rust engine) |
| `DB_URL` | Same URI — replace `postgresql://` with `jdbc:postgresql://`, remove `neondb_owner:PASSWORD@` from the middle | 
| `DB_USERNAME` | `neondb_owner` |
| `DB_PASSWORD` | The password between `:` and `@` in the connection string |

**DB_URL format:**
```
# Original from Neon:
postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# DB_URL for Spring Boot (jdbc prefix, credentials removed from URL):
jdbc:postgresql://ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## Step 2 — Create the Redpanda Kafka cluster

1. Go to **https://cloud.redpanda.com** → sign up → **Create Cluster**.
2. Choose **Serverless** (free), name it `logwatch`, region **AWS us-east-1**, connection type **Public** → **Create**.
3. Go to **Security** → **Users** tab → create a user with a username and password → save both.
4. Go to **Security** → **ACLs** → **Create ACLs**:
   - Principal: your username, Host: `*`, Resource type: `Topic`, Resource name: `*`, Operations: All, Permission: Allow
   - Create another: same principal, Resource type: `Group`, Resource name: `*`, Operations: Read, Permission: Allow
5. Go to **Topics** → create topic `raw-logs` (default settings) → create topic `anomaly-alerts`.
6. Go to **Overview** → **How to connect** → **Kafka API** tab → copy the bootstrap server URL.

**Values to save from this step:**

| Variable | Value |
|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Bootstrap server from Kafka API tab |
| `KAFKA_USERNAME` | Username you created |
| `KAFKA_PASSWORD` | Password you set |
| `KAFKA_SECURITY_PROTOCOL` | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | `SCRAM-SHA-256` |
| `KAFKA_SASL_JAAS_CONFIG` | Construct manually — see below |

**KAFKA_SASL_JAAS_CONFIG** — fill in your credentials:
```
org.apache.kafka.common.security.scram.ScramLoginModule required username="YOUR_USERNAME" password="YOUR_PASSWORD";
```

---

## Step 3 — Deploy Spring Boot API to Railway

1. Go to **https://railway.app** → sign up → **New Project** → **Deploy from GitHub repo** → configure GitHub app → select your `logwatch` repo.
2. Click on the created service → **Settings** → **Source** → set **Root Directory** to `spring-api` → save.
3. Railway uses the `spring-api/Dockerfile` to build. No manual build command needed.
4. Under **Variables**, add every variable below:

   ```
   DB_URL          = jdbc:postgresql://ep-xxx.neon.tech/neondb?sslmode=require
   DB_USERNAME     = neondb_owner
   DB_PASSWORD     = <your neon password>
   JWT_SECRET      = <run: openssl rand -hex 32>
   KAFKA_BOOTSTRAP_SERVERS  = <redpanda bootstrap server>
   KAFKA_SECURITY_PROTOCOL  = SASL_SSL
   KAFKA_SASL_MECHANISM     = SCRAM-SHA-256
   KAFKA_SASL_JAAS_CONFIG   = org.apache.kafka.common.security.scram.ScramLoginModule required username="..." password="...";
   CORS_ALLOWED_ORIGINS     = https://your-frontend.vercel.app   ← fill in after Step 5
   ```

   > **Generate JWT_SECRET on Windows (PowerShell):**
   > ```powershell
   > -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
   > ```

5. Click **Deploy**. Wait for the build (~3 minutes).
6. Under **Settings → Networking → Public Networking**, click **Generate Domain** → enter port `8080`.
   Copy the URL — e.g. `https://logwatch-production.up.railway.app`.

> **Verify:** Open `https://logwatch-production.up.railway.app/actuator/health` in your browser.
> Should return `{"status":"UP"}`.

---

## Step 4 — Deploy Rust Engine to Railway

1. In the same Railway project → **+ Add** → **GitHub Repo** → same repo.
2. Click the new service → **Settings → Source**:
   - **Root Directory**: leave empty (repo root `/`)
   - **Dockerfile Path**: `rust-engine/Dockerfile`
3. Under **Variables**, add:

   ```
   DATABASE_URL             = postgresql://neondb_owner:<password>@ep-xxx.neon.tech/neondb?sslmode=require
   KAFKA_BROKERS            = <redpanda bootstrap server>
   KAFKA_SECURITY_PROTOCOL  = SASL_SSL
   KAFKA_USERNAME           = <redpanda username>
   KAFKA_PASSWORD           = <redpanda password>
   RUST_LOG                 = info
   ```

   > Note: `DATABASE_URL` uses `postgresql://` (not `jdbc:`). This is for the Rust sqlx driver, not Spring Boot.

4. Click **Deploy**. The Rust build takes 10–15 minutes on first run (compiling rdkafka with vendored OpenSSL).
5. Confirm success in the logs:
   ```
   INFO rust_engine::kafka: Kafka consumer started for topic raw-logs
   ```

> **Note:** The ONNX model (`training/models/isolation_forest.onnx`) must be committed to git.
> Verify: `git ls-files training/models/isolation_forest.onnx`
> If missing: `git add -f training/models/isolation_forest.onnx && git push`

---

## Step 5 — Deploy React Frontend to Vercel

1. Go to **https://vercel.com** → sign up → **Add New Project** → import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework: **Vite**. Build command: `npm run build`. Output: `dist`.
4. Under **Environment Variables**, add:
   ```
   VITE_API_BASE_URL = https://logwatch-production.up.railway.app
   ```
5. Click **Deploy**. Build takes ~1 minute.
6. Copy your Vercel URL — e.g. `https://logwatch-frontend-xxx.vercel.app`.

**Go back to Railway → Spring Boot service → Variables** and update:
```
CORS_ALLOWED_ORIGINS = https://logwatch-frontend-xxx.vercel.app
```
Then click **Redeploy**.

> **Verify:** Open your Vercel URL → the login page loads.

---

## Step 6 — Deploy Docs Site to Vercel

1. In Vercel → **Add New Project** → same repo.
2. Set **Root Directory** to `docs`.
3. Framework: **Other**. Build command: `npm run build`. Output: `build`.
4. No environment variables needed.
5. Click **Deploy**.

> **Verify:** Open the docs URL → Quickstart, SDK, API, Architecture pages all render.

---

## Step 7 — Publish the npm SDK (optional)

The `@logwatch/node` SDK is already published at **https://npmjs.com/package/@logwatch/node**.

To republish after changes:

```powershell
cd sdk
npm run build
npm publish --access public
```

You need an npm account with the `@logwatch` org scope and a publish token configured:
```powershell
npm config set //registry.npmjs.org/:_authToken YOUR_NPM_TOKEN
```

---

## Step 8 — Verify end-to-end

### Register and log in

```bash
API=https://logwatch-production.up.railway.app

# Register
curl -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Test1234!","organisationName":"Acme"}'
# → {"token":"eyJ...","apiKey":"lw_..."}
```

### Ingest a test log batch

```bash
curl -X POST $API/api/ingest \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      "2024-06-01T12:00:00Z ERROR payment-service HTTP GET /api/charge 500 5234ms",
      "2024-06-01T12:00:01Z ERROR payment-service HTTP GET /api/charge 500 4921ms",
      "2024-06-01T12:00:02Z ERROR payment-service HTTP GET /api/charge 500 6100ms",
      "2024-06-01T12:00:03Z ERROR payment-service HTTP GET /api/charge 500 5100ms",
      "2024-06-01T12:00:04Z ERROR payment-service HTTP GET /api/charge 500 4800ms"
    ]
  }'
# → {"accepted":5,"dropped":0}
```

### Wait ~60 seconds, then check anomalies

```bash
curl $API/anomalies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# → {"content":[...],"totalElements":1,...}
```

### Open the dashboard

Navigate to your Vercel URL → Log in → Dashboard shows your first anomaly.

---

## Environment variable reference

### Spring Boot API (Railway)

| Variable | Required | Notes |
|---|---|---|
| `DB_URL` | Yes | `jdbc:postgresql://host/db?sslmode=require` |
| `DB_USERNAME` | Yes | `neondb_owner` |
| `DB_PASSWORD` | Yes | From Neon connection string |
| `JWT_SECRET` | Yes | Random 64-char hex string |
| `KAFKA_BOOTSTRAP_SERVERS` | Yes | Redpanda bootstrap server |
| `KAFKA_SECURITY_PROTOCOL` | Yes | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | Yes | `SCRAM-SHA-256` |
| `KAFKA_SASL_JAAS_CONFIG` | Yes | Full JAAS string with Redpanda credentials |
| `CORS_ALLOWED_ORIGINS` | Yes | Your Vercel frontend URL (no trailing slash) |

### Rust Engine (Railway)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://` form (not jdbc) |
| `KAFKA_BROKERS` | Yes | Redpanda bootstrap server |
| `KAFKA_SECURITY_PROTOCOL` | Yes | `SASL_SSL` |
| `KAFKA_USERNAME` | Yes | Redpanda username |
| `KAFKA_PASSWORD` | Yes | Redpanda password |
| `RUST_LOG` | No | `info` recommended |

### React Frontend (Vercel)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Railway Spring Boot public URL |

---

## Troubleshooting

**Spring Boot crashes → `HikariPool connection timeout`**
- Check `DB_URL` starts with `jdbc:postgresql://`, not `postgres://`.
- Ensure there is a `?` between the database name and `sslmode=require`.
- Wake the Neon project if it has suspended (free tier sleeps after inactivity).

**Rust engine exits → `Failed to connect to Postgres`**
- `DATABASE_URL` must start with `postgres://` or `postgresql://`, not `jdbc:`.
- Verify `?sslmode=require` is appended.

**Rust engine → `SASL authentication error: invalid username or password`**
- Check `KAFKA_USERNAME` and `KAFKA_PASSWORD` exactly match what you created in Redpanda Security → Users.
- Reset the Redpanda user password if unsure.

**Rust engine → `GroupAuthorizationFailed`**
- Add a Group ACL in Redpanda: Resource type `Group`, name `*`, operation `Read`, Allow.

**Kafka → `TopicAuthorizationFailed`**
- Add a Topic ACL in Redpanda: Resource type `Topic`, name `*`, operations All, Allow.

**Frontend shows blank page / CORS errors**
- Open browser DevTools → Network tab → look for CORS errors.
- Ensure `CORS_ALLOWED_ORIGINS` in Railway exactly matches your Vercel URL (no trailing slash).
- After updating the variable, redeploy the Spring Boot service.

**Rust Docker build fails → "cannot copy training/models"**
- The ONNX model must be committed to git:
  ```bash
  git add -f training/models/isolation_forest.onnx && git commit -m "add onnx model" && git push
  ```
- Confirm Railway Dockerfile path is `rust-engine/Dockerfile` and root directory is `/`.

**Railway free tier expires after 30 days**
- Add a payment card — the $5/month hobby plan is covered by the existing $5 credit for the first month.
- Alternative: migrate Spring Boot to Render (free, no expiry, but 30-60s cold starts after inactivity).
