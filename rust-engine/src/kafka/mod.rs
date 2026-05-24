use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::topic_partition_list::Offset;
use rdkafka::{ClientConfig, Message, TopicPartitionList};
use futures::StreamExt;
use sqlx::PgPool;
use tracing::{info, warn, error};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use metrics::{counter, gauge, histogram};

use crate::features::SlidingWindow;
use crate::inference::OnnxInference;
use crate::parser::parse_log_line;
use crate::storage::{Anomaly, save_anomaly};

fn build_client_config(brokers: &str, group_id: Option<&str>) -> ClientConfig {
    let security_protocol = std::env::var("KAFKA_SECURITY_PROTOCOL")
        .unwrap_or_else(|_| "PLAINTEXT".to_string());
    let sasl_username = std::env::var("KAFKA_USERNAME").unwrap_or_default();
    let sasl_password = std::env::var("KAFKA_PASSWORD").unwrap_or_default();

    let mut cfg = ClientConfig::new();
    cfg.set("bootstrap.servers", brokers);

    if let Some(gid) = group_id {
        cfg.set("group.id", gid);
        cfg.set("enable.partition.eof", "false");
        cfg.set("session.timeout.ms", "6000");
        cfg.set("enable.auto.commit", "true");
    }

    if security_protocol == "SASL_SSL" {
        cfg.set("security.protocol", "SASL_SSL")
            .set("sasl.mechanism", "SCRAM-SHA-256")
            .set("sasl.username", &sasl_username)
            .set("sasl.password", &sasl_password);
    }

    cfg
}

pub async fn start_consumer(
    brokers: &str,
    topic: &str,
    group_id: &str,
    db_pool: PgPool,
    mut inference: OnnxInference,
) {
    let consumer: Arc<StreamConsumer> = Arc::new(
        build_client_config(brokers, Some(group_id))
            .create()
            .expect("Consumer creation failed"),
    );

    consumer.subscribe(&[topic]).expect("Can't subscribe to specified topic");

    // Background task: update Kafka consumer lag gauge every 15 seconds
    let consumer_lag = Arc::clone(&consumer);
    let topic_lag = topic.to_string();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let c = Arc::clone(&consumer_lag);
            let t = topic_lag.clone();
            let _ = tokio::task::spawn_blocking(move || {
                let Ok(assignment) = c.assignment() else { return };
                if assignment.count() == 0 { return }
                let Ok(committed) = c.committed_offsets(assignment.clone(), Duration::from_millis(500)) else { return };
                let mut total_lag: i64 = 0;
                for elem in committed.elements() {
                    let committed_offset = match elem.offset() {
                        Offset::Offset(o) => o,
                        _ => 0,
                    };
                    if let Ok((_, high)) = c.fetch_watermarks(elem.topic(), elem.partition(), Duration::from_millis(200)) {
                        total_lag += (high - committed_offset).max(0);
                    }
                }
                gauge!("logwatch_kafka_consumer_lag").set(total_lag as f64);
                let _ = t; // keep topic string alive
            })
            .await;
        }
    });

    let producer: FutureProducer = build_client_config(brokers, None)
        .set("message.timeout.ms", "5000")
        .create()
        .expect("Producer creation error");

    let mut windows: HashMap<String, SlidingWindow> = HashMap::new();

    info!("Kafka consumer started for topic {}", topic);

    let mut message_stream = consumer.stream();

    while let Some(message) = message_stream.next().await {
        match message {
            Err(e) => warn!("Kafka error: {}", e),
            Ok(m) => {
                let payload = match m.payload_view::<str>() {
                    None => continue,
                    Some(Ok(s)) => s,
                    Some(Err(e)) => {
                        warn!("Error while deserializing message payload: {:?}", e);
                        continue;
                    }
                };

                if let Ok((_, log_line)) = parse_log_line(payload) {
                    counter!("logwatch_logs_processed_total").increment(1);

                    let service_name = log_line.service.clone();
                    let window = windows.entry(service_name.clone())
                        .or_insert_with(|| SlidingWindow::new(service_name.clone()));

                    window.add(log_line);

                    if window.should_flush() {
                        let features = window.extract_features();

                        let infer_start = Instant::now();
                        match inference.score(features) {
                            Ok(score) => {
                                histogram!("logwatch_inference_duration_ms")
                                    .record(infer_start.elapsed().as_secs_f64() * 1000.0);

                                if inference.is_anomaly(score) {
                                    let severity = if score < -0.3 { "HIGH" } else { "MEDIUM" };
                                    counter!("logwatch_anomalies_detected_total", "severity" => severity).increment(1);

                                    let org_id = sqlx::query_scalar::<_, Uuid>(
                                        "SELECT id FROM organisations ORDER BY created_at LIMIT 1"
                                    )
                                    .fetch_optional(&db_pool)
                                    .await
                                    .unwrap_or(None)
                                    .unwrap_or_else(Uuid::new_v4);

                                    let anomaly = Anomaly {
                                        id: Uuid::new_v4(),
                                        service_name: service_name.clone(),
                                        detected_at: Utc::now(),
                                        anomaly_score: score,
                                        feature_vector: json!(features),
                                        severity: severity.to_string(),
                                        org_id,
                                        acknowledged: false,
                                    };

                                    // Save to Postgres
                                    if let Err(e) = save_anomaly(&db_pool, &anomaly).await {
                                        error!("Failed to save anomaly to DB: {}", e);
                                    }

                                    // Publish to Kafka `anomaly-alerts`
                                    let payload = serde_json::to_string(&anomaly).unwrap();
                                    let record = FutureRecord::to("anomaly-alerts")
                                        .payload(&payload)
                                        .key(&anomaly.service_name);

                                    if let Err(e) = producer.send(record, std::time::Duration::from_secs(0)).await {
                                        error!("Failed to publish anomaly to Kafka: {:?}", e);
                                    }

                                    info!("Detected anomaly for service {}: score {}", service_name, score);
                                }
                            }
                            Err(e) => {
                                histogram!("logwatch_inference_duration_ms")
                                    .record(infer_start.elapsed().as_secs_f64() * 1000.0);
                                error!("Inference failed: {}", e);
                            }
                        }

                        window.reset();
                    }
                }
            }
        };
    }
}
