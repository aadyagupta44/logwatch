"""
retrain_http.py

Generates synthetic feature data matching the HTTP log simulator's output,
trains a new IsolationForest, and exports to ONNX.

Normal window (per service, 60s window):
  - total_count ~ Normal(660, 60)
  - error_ratio ~ 2%  (10ms-50ms between logs, 90/8/2 INFO/WARN/ERROR mix)
  - warn_ratio  ~ 8%
  - unique_components = 3 (3 endpoints in simulator)

Anomalous window (burst of 30 ERRORs injected):
  - error_count += 30  -> error_ratio jumps to ~6-25%
  - unique_components = 3
"""

import os
import sys
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(BASE_DIR, "models", "isolation_forest.onnx")

FEATURE_COLS = [
    "total_count", "error_count", "warn_count", "info_count",
    "error_ratio",  "warn_ratio",  "unique_components",
]

RANDOM_STATE = 42
rng = np.random.default_rng(RANDOM_STATE)

N_NORMAL  = 50_000
N_ANOMALY =  2_632   # ~5% of total


def gen_normal(n):
    total = rng.normal(660, 60, n).clip(100, 1500).astype(int)
    error = (rng.normal(0.02, 0.005, n) * total).clip(0).astype(int)
    warn  = (rng.normal(0.08, 0.01,  n) * total).clip(0).astype(int)
    info  = (total - error - warn).clip(0)
    err_r = error / total.clip(1)
    wrn_r = warn  / total.clip(1)
    uc    = rng.integers(2, 5, n)   # 2-4 unique paths (slight variation)
    rows  = np.stack([total, error, warn, info, err_r, wrn_r, uc], axis=1)
    return rows.astype(np.float32)


def gen_anomaly(n):
    total = rng.normal(690, 60, n).clip(100, 1500).astype(int)
    # Anomaly burst adds 25-50 extra errors (matches simulator's 30-error burst)
    base_err = (rng.normal(0.02, 0.005, n) * total).clip(0).astype(int)
    burst    = rng.integers(25, 51, n)
    error    = (base_err + burst).clip(0, total)
    warn     = (rng.normal(0.08, 0.015, n) * total).clip(0).astype(int)
    info     = (total - error - warn).clip(0)
    err_r    = error / total.clip(1)
    wrn_r    = warn  / total.clip(1)
    uc       = rng.integers(1, 4, n)   # slightly fewer unique paths during bursts
    rows     = np.stack([total, error, warn, info, err_r, wrn_r, uc], axis=1)
    return rows.astype(np.float32)


def main():
    print("Generating synthetic HTTP log feature data …")
    X_normal  = gen_normal(N_NORMAL)
    X_anomaly = gen_anomaly(N_ANOMALY)
    X = np.vstack([X_normal, X_anomaly])
    print(f"  {N_NORMAL:,} normal + {N_ANOMALY:,} anomaly = {len(X):,} total samples")

    print("Training StandardScaler + IsolationForest …")
    pipeline = Pipeline([
        ("scaler",  StandardScaler()),
        ("iforest", IsolationForest(
            contamination=N_ANOMALY / len(X),
            n_estimators=100,
            random_state=RANDOM_STATE,
        )),
    ])
    pipeline.fit(X)

    # Quick sanity check
    preds_n = pipeline.predict(X_normal[:500])
    preds_a = pipeline.predict(X_anomaly[:500])
    recall = (preds_a == -1).mean()
    fpr    = (preds_n == -1).mean()
    print(f"  Anomaly recall on held-out anomaly rows : {recall*100:.1f}%")
    print(f"  False-positive rate on normal rows      : {fpr*100:.1f}%")

    print("Exporting to ONNX …")
    initial_types = [("float_input", FloatTensorType([None, 7]))]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_types,
        target_opset={"": 17, "ai.onnx.ml": 3},
    )
    os.makedirs(os.path.dirname(ONNX_PATH), exist_ok=True)
    with open(ONNX_PATH, "wb") as f:
        f.write(onnx_model.SerializeToString())

    size_kb = os.path.getsize(ONNX_PATH) / 1024
    print(f"  Saved to {ONNX_PATH}  ({size_kb:.1f} KB)")
    print(f"  skl2onnx version: {skl2onnx.__version__}")
    print("Done.")


if __name__ == "__main__":
    main()
