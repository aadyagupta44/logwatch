use tracing::info;
use tracing_subscriber::EnvFilter;
use sqlx::PgPool;
use std::env;
use std::net::SocketAddr;
use metrics_exporter_prometheus::PrometheusBuilder;

mod features;
mod inference;
mod kafka;
mod parser;
mod storage;

use crate::inference::OnnxInference;

#[tokio::main]
async fn main() {
    // Initialise structured logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    info!("rust-engine starting up");

    // Install Prometheus metrics recorder and start HTTP listener on :9090
    let metrics_addr: SocketAddr = "0.0.0.0:9090".parse().expect("Invalid metrics address");
    PrometheusBuilder::new()
        .with_http_listener(metrics_addr)
        .install()
        .expect("Failed to install Prometheus metrics recorder");
    info!("Metrics endpoint: http://0.0.0.0:9090/metrics");

    // Read config from environment
    let brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let topic = env::var("KAFKA_TOPIC").unwrap_or_else(|_| "raw-logs".to_string());
    let group_id = env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "rust-engine-group".to_string());
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set (e.g. postgres://user:pass@localhost:5432/logwatch)");
    let model_path = env::var("ONNX_MODEL_PATH").unwrap_or_else(|_| "../training/models/isolation_forest.onnx".to_string());

    // Initialize Database
    info!("Connecting to PostgreSQL at {}", database_url);
    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    storage::init_db(&pool)
        .await
        .expect("Failed to initialize database tables");

    // Initialize Inference
    info!("Loading ONNX model from {}", model_path);
    let inference = OnnxInference::new(&model_path)
        .expect("Failed to load ONNX model");

    // Start Kafka Consumer Loop
    info!("Connecting to Kafka brokers at {} (topic: {})", brokers, topic);
    kafka::start_consumer(&brokers, &topic, &group_id, pool, inference).await;
}
