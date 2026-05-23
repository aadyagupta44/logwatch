"""
generate_sample_logs.py

Generates 50,000 realistic log lines for a microservice application.
- 95% normal: latency 20-200ms, error rate < 2%
- 5%  anomalous windows: latency 2000-8000ms, error rate 30-80%

Output: logs/raw_logs.log
"""

import random
import os
from datetime import datetime, timedelta

# ── Configuration ─────────────────────────────────────────────────────────────
TOTAL_LINES      = 50_000
ANOMALY_FRACTION = 0.05          # 5 % of lines fall in anomalous windows
OUTPUT_DIR       = os.path.join(os.path.dirname(__file__), "logs")
OUTPUT_FILE      = os.path.join(OUTPUT_DIR, "raw_logs.log")
RANDOM_SEED      = 42

random.seed(RANDOM_SEED)

# ── Data tables ───────────────────────────────────────────────────────────────
SERVICES = ["payment-service", "auth-service", "db-service"]

ENDPOINTS = {
    "payment-service": [
        ("POST", "/api/v1/payments"),
        ("GET",  "/api/v1/payments/{id}"),
        ("POST", "/api/v1/refunds"),
        ("GET",  "/api/v1/balance"),
    ],
    "auth-service": [
        ("POST", "/api/v1/login"),
        ("POST", "/api/v1/logout"),
        ("POST", "/api/v1/token/refresh"),
        ("GET",  "/api/v1/users/{id}"),
    ],
    "db-service": [
        ("GET",  "/api/v1/query"),
        ("POST", "/api/v1/insert"),
        ("PUT",  "/api/v1/update"),
        ("DELETE", "/api/v1/records/{id}"),
    ],
}

NORMAL_STATUS_WEIGHTS = [
    (200, 70), (201, 10), (204, 5), (400, 5),
    (401, 3),  (403, 2),  (404, 3), (500, 2),
]

ANOMALY_STATUS_WEIGHTS = [
    (200, 30), (201, 5), (500, 30), (503, 20),
    (504, 10), (400, 3), (429, 2),
]

ERROR_MESSAGES = {
    "payment-service": [
        "Payment gateway timeout",
        "Insufficient funds",
        "Card declined by issuer",
        "Duplicate transaction detected",
        "Currency mismatch error",
    ],
    "auth-service": [
        "Invalid JWT signature",
        "Token expired",
        "Account locked after 5 failed attempts",
        "LDAP connection refused",
        "Session store unavailable",
    ],
    "db-service": [
        "Connection pool exhausted",
        "Query execution timeout",
        "Deadlock detected, rolling back",
        "Disk I/O error on replica",
        "Replication lag exceeded threshold",
    ],
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _weighted_choice(pairs):
    population, weights = zip(*pairs)
    return random.choices(population, weights=weights, k=1)[0]


def _status_to_level(status_code, error_ratio, is_anomaly):
    """Return an appropriate log level given the HTTP status."""
    if status_code >= 500:
        return "ERROR"
    if status_code >= 400:
        # In anomaly windows, 4xx are more likely to be flagged as WARN/ERROR
        return "WARN" if (is_anomaly and random.random() < 0.4) else "WARN"
    # Occasionally emit WARN for slow-but-successful responses
    if is_anomaly and random.random() < 0.2:
        return "WARN"
    return "INFO"


def _make_log_line(ts: datetime, is_anomaly: bool) -> str:
    service = random.choice(SERVICES)
    method, path = random.choice(ENDPOINTS[service])

    if is_anomaly:
        status  = _weighted_choice(ANOMALY_STATUS_WEIGHTS)
        latency = random.randint(2_000, 8_000)
        # 30-80% error ratio → decide if this specific line is an error
        is_error = random.random() < random.uniform(0.30, 0.80)
        if is_error:
            status = random.choice([500, 503, 504])
    else:
        status  = _weighted_choice(NORMAL_STATUS_WEIGHTS)
        latency = random.randint(20, 200)
        is_error = status >= 500

    level   = _status_to_level(status, is_anomaly, is_anomaly)

    # Build message
    if status >= 500 or (is_anomaly and is_error):
        msg = random.choice(ERROR_MESSAGES[service])
        level = "ERROR"
    elif status >= 400:
        msg = f"Client error on {method} {path}"
    elif is_anomaly and latency > 3_000:
        msg = f"High latency detected on {method} {path}"
        level = "WARN"
    else:
        msg = f"{method} {path} completed successfully"

    timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"
    return f"{timestamp} [{level}] {service} {method} {path} {status} {latency}ms - {msg}"


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Build an index of which lines are anomalous.
    # Anomalies come in contiguous windows (clusters of ~30-100 lines).
    n_anomaly_lines = int(TOTAL_LINES * ANOMALY_FRACTION)
    anomaly_set: set[int] = set()

    while len(anomaly_set) < n_anomaly_lines:
        start  = random.randint(0, TOTAL_LINES - 1)
        window = random.randint(30, 100)
        for i in range(start, min(start + window, TOTAL_LINES)):
            anomaly_set.add(i)
            if len(anomaly_set) >= n_anomaly_lines:
                break

    # Generate lines with monotonically increasing timestamps
    start_ts = datetime(2024, 1, 1, 0, 0, 0)
    lines = []
    for i in range(TOTAL_LINES):
        # ~1-3 seconds between consecutive log entries on average
        start_ts += timedelta(milliseconds=random.randint(50, 300))
        line = _make_log_line(start_ts, is_anomaly=(i in anomaly_set))
        lines.append(line)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"[generate_sample_logs] Written {TOTAL_LINES:,} lines → {OUTPUT_FILE}")
    print(f"  Normal lines   : {TOTAL_LINES - len(anomaly_set):,}")
    print(f"  Anomalous lines: {len(anomaly_set):,}  ({len(anomaly_set)/TOTAL_LINES*100:.1f}%)")


if __name__ == "__main__":
    main()
