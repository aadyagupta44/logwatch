-- LogWatch database schema
-- Run this against your Neon database after provisioning.
-- Neon console: https://console.neon.tech → SQL Editor → paste and run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- organisations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    org_id        UUID        REFERENCES organisations(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- api_keys
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash   TEXT        NOT NULL,
    org_id     UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id   ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash  ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- anomalies
-- Written by both the Spring Boot API (via JPA) and the Rust engine (via sqlx).
-- feature_vector is stored as TEXT (JSON string) to satisfy Spring's
-- columnDefinition = "TEXT" annotation while still being parseable as JSON.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomalies (
    id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name   TEXT             NOT NULL,
    detected_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    anomaly_score  DOUBLE PRECISION,
    feature_vector TEXT,
    severity       TEXT             NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
    org_id         UUID             NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    acknowledged   BOOLEAN          NOT NULL DEFAULT FALSE
);

-- Indexes requested by the user
CREATE INDEX IF NOT EXISTS idx_anomalies_org_id       ON anomalies(org_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_service_name ON anomalies(service_name);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at  ON anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity     ON anomalies(severity);

-- Composite index for the most common dashboard query:
-- "get recent unacknowledged anomalies for org X"
CREATE INDEX IF NOT EXISTS idx_anomalies_org_ack_time
    ON anomalies(org_id, acknowledged, detected_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query — run after applying schema:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
-- Expected output: anomalies, api_keys, organisations, users
-- ─────────────────────────────────────────────────────────────────────────────
