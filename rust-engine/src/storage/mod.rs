use sqlx::{PgPool, Error};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct Anomaly {
    pub id: Uuid,
    pub service_name: String,
    pub detected_at: DateTime<Utc>,
    pub anomaly_score: f32,
    pub feature_vector: Value,
    pub severity: String,
    pub org_id: Uuid,
    pub acknowledged: bool,
}

pub async fn init_db(pool: &PgPool) -> Result<(), Error> {
    // Using runtime sqlx::query (no !) so we don't require a live DB at compile time
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS anomalies (
            id UUID PRIMARY KEY,
            service_name TEXT NOT NULL,
            detected_at TIMESTAMPTZ NOT NULL,
            anomaly_score REAL NOT NULL,
            feature_vector JSONB NOT NULL,
            severity TEXT NOT NULL,
            org_id UUID NOT NULL,
            acknowledged BOOLEAN NOT NULL DEFAULT FALSE
        )
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn save_anomaly(pool: &PgPool, anomaly: &Anomaly) -> Result<(), Error> {
    // Using runtime sqlx::query with .bind()
    sqlx::query(
        r#"
        INSERT INTO anomalies (id, service_name, detected_at, anomaly_score, feature_vector, severity, org_id, acknowledged)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#
    )
    .bind(anomaly.id)
    .bind(&anomaly.service_name)
    .bind(anomaly.detected_at)
    .bind(anomaly.anomaly_score)
    .bind(&anomaly.feature_vector)
    .bind(&anomaly.severity)
    .bind(anomaly.org_id)
    .bind(anomaly.acknowledged)
    .execute(pool)
    .await?;

    Ok(())
}
