import os
import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

# Configuration
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
TOPIC = "raw-logs"

SERVICES = ["payment-service", "auth-service", "db-service"]
ENDPOINTS = ["/api/charge", "/api/v1/login", "/api/v1/query"]

def create_producer():
    print(f"Connecting to Kafka brokers: {KAFKA_BROKERS}")
    # Retries built-in so it waits if Kafka isn't fully up yet
    return KafkaProducer(
        bootstrap_servers=KAFKA_BROKERS,
        value_serializer=lambda v: v.encode('utf-8')
    )

def generate_log(is_anomaly=False, forced_service=None):
    service = forced_service or random.choice(SERVICES)
    endpoint = random.choice(ENDPOINTS)
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    if is_anomaly:
        level = "ERROR"
        status_code = random.choice([500, 502, 503, 504])
        latency = random.randint(3000, 8000)
    else:
        # 90% INFO, 8% WARN, 2% ERROR
        level = random.choices(["INFO", "WARN", "ERROR"], weights=[0.90, 0.08, 0.02])[0]
        status_code = random.choice([200, 201, 200, 200, 400, 401, 404])
        if level == "ERROR":
            status_code = random.choice([500, 503])
        latency = random.randint(10, 200)

    # Format exactly matches the rust nom parser:
    # 2024-01-15T10:23:45Z INFO payment-service HTTP GET /api/charge 200 45ms
    return f"{timestamp} {level} {service} HTTP GET {endpoint} {status_code} {latency}ms"

def main():
    # Wait for Kafka to be ready
    while True:
        try:
            producer = create_producer()
            break
        except Exception as e:
            print(f"Waiting for Kafka... {e}")
            time.sleep(3)

    print(f"Producer connected. Sending logs to '{TOPIC}'...")

    last_anomaly_time = time.time()
    ANOMALY_INTERVAL = 120  # 2 minutes
    ANOMALY_BURST_SIZE = 30

    try:
        while True:
            current_time = time.time()

            # Inject Anomaly Burst every 2 minutes
            if current_time - last_anomaly_time >= ANOMALY_INTERVAL:
                target_service = random.choice(SERVICES)
                print(f"\n🚨 INJECTING ANOMALY BURST: {ANOMALY_BURST_SIZE} high-latency ERRORs for {target_service}")
                
                for _ in range(ANOMALY_BURST_SIZE):
                    log = generate_log(is_anomaly=True, forced_service=target_service)
                    producer.send(TOPIC, log)
                
                producer.flush()
                last_anomaly_time = current_time
                print("✅ Anomaly burst complete. Resuming normal logs...\n")
                continue

            # Generate Normal Log
            log = generate_log(is_anomaly=False)
            producer.send(TOPIC, log)
            
            # Sleep 10-50ms
            time.sleep(random.uniform(0.01, 0.05))
            
    except KeyboardInterrupt:
        print("\nSimulation stopped.")
    finally:
        producer.close()

if __name__ == "__main__":
    main()
