"""
train_model.py

Loads training/data/features.csv, trains a scikit-learn IsolationForest
(unsupervised — labels are NOT passed to fit()), evaluates predictions
against ground-truth labels on the held-out test set, and exports the
trained model to training/models/isolation_forest.onnx via skl2onnx.

Prints:
    - Precision, Recall, F1 score
    - Confusion matrix
    - Anomalies detected vs total anomalies in test set
    - ONNX export confirmation

Usage:
    python training/train_model.py
"""

import os
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FEATURE_FILE = os.path.join(BASE_DIR, "data",   "features.csv")
MODEL_DIR    = os.path.join(BASE_DIR, "models")
ONNX_PATH    = os.path.join(MODEL_DIR, "isolation_forest.onnx")

# ── Feature / label columns ────────────────────────────────────────────────────
FEATURE_COLS = [
    "total_count",
    "error_count",
    "warn_count",
    "info_count",
    "error_ratio",
    "warn_ratio",
    "unique_components",
]
LABEL_COL = "label"

# ── Model hyper-parameters ─────────────────────────────────────────────────────
CONTAMINATION = 0.05
N_ESTIMATORS  = 100
RANDOM_STATE  = 42
TEST_SIZE     = 0.20


# ── Helpers ────────────────────────────────────────────────────────────────────
def load_data(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Return (X float32 array, y int array) from features.csv."""
    if not os.path.exists(path):
        print(f"[train_model] ERROR: Feature file not found: {path}")
        print("  Run extract_features.py first.")
        sys.exit(1)

    df = pd.read_csv(path)
    missing = [c for c in FEATURE_COLS + [LABEL_COL] if c not in df.columns]
    if missing:
        print(f"[train_model] ERROR: Missing columns: {missing}")
        sys.exit(1)

    X = df[FEATURE_COLS].values.astype(np.float32)
    y = df[LABEL_COL].values.astype(int)
    return X, y


def build_pipeline() -> Pipeline:
    """StandardScaler → IsolationForest."""
    return Pipeline([
        ("scaler",  StandardScaler()),
        ("iforest", IsolationForest(
            contamination=CONTAMINATION,
            n_estimators=N_ESTIMATORS,
            random_state=RANDOM_STATE,
        )),
    ])


def iso_to_binary(predictions: np.ndarray) -> np.ndarray:
    """
    IsolationForest.predict() returns +1 (normal) and -1 (anomaly).
    Convert to 0 (normal) and 1 (anomaly) to match ground-truth labels.
    """
    return np.where(predictions == -1, 1, 0)


def export_onnx(pipeline: Pipeline, n_features: int, output_path: str) -> None:
    """Convert the sklearn Pipeline to ONNX and write to disk."""
    initial_types = [("float_input", FloatTensorType([None, n_features]))]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_types,
        target_opset={"": 17, "ai.onnx.ml": 3},
    )
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f"[train_model] Loading features from {FEATURE_FILE} …")
    X, y = load_data(FEATURE_FILE)
    print(f"  Total samples        : {len(X):,}")
    print(f"  Feature dimensions   : {X.shape[1]}  →  {FEATURE_COLS}")
    print(f"  Label distribution   : Normal={int((y==0).sum()):,}  "
          f"Anomaly={int((y==1).sum()):,}")

    # ── Train / test split ────────────────────────────────────────────────────
    # Labels are split for EVALUATION ONLY — never passed to fit()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    print(f"\n  Train size : {len(X_train):,}  ({100*(1-TEST_SIZE):.0f}%)")
    print(f"  Test  size : {len(X_test):,}   ({100*TEST_SIZE:.0f}%)")

    # ── Train (unsupervised — no labels) ──────────────────────────────────────
    print(f"\n[train_model] Training IsolationForest (unsupervised) …")
    print(f"  contamination={CONTAMINATION}, "
          f"n_estimators={N_ESTIMATORS}, "
          f"random_state={RANDOM_STATE}")

    pipeline = build_pipeline()
    pipeline.fit(X_train)          # ← labels intentionally excluded

    # ── Evaluate on test set ──────────────────────────────────────────────────
    raw_preds   = pipeline.predict(X_test)          # +1 / -1
    y_pred      = iso_to_binary(raw_preds)          # 0  / 1

    precision   = precision_score(y_test, y_pred, zero_division=0)
    recall      = recall_score(y_test, y_pred, zero_division=0)
    f1          = f1_score(y_test, y_pred, zero_division=0)
    cm          = confusion_matrix(y_test, y_pred)

    n_detected  = int(y_pred.sum())
    n_actual    = int(y_test.sum())

    print(f"\n── Evaluation Results (test set) ───────────────────────")
    print(f"  Precision            : {precision:.4f}")
    print(f"  Recall               : {recall:.4f}")
    print(f"  F1 Score             : {f1:.4f}")
    print(f"\n  Anomalies detected   : {n_detected:,}  /  {n_actual:,}  actual anomalies in test set")
    print(f"\n  Confusion Matrix (rows=actual, cols=predicted):")
    print(f"              Pred Normal  Pred Anomaly")
    print(f"  Act Normal    {cm[0,0]:>8,}     {cm[0,1]:>8,}")
    print(f"  Act Anomaly   {cm[1,0]:>8,}     {cm[1,1]:>8,}")

    print(f"\n  Full Classification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=["Normal", "Anomaly"],
        digits=4,
    ))

    # ── Export to ONNX ────────────────────────────────────────────────────────
    print(f"[train_model] Exporting model to ONNX …")
    export_onnx(pipeline, n_features=len(FEATURE_COLS), output_path=ONNX_PATH)

    onnx_size_kb = os.path.getsize(ONNX_PATH) / 1024
    print(f"  ✓ ONNX model saved   → {ONNX_PATH}")
    print(f"  ✓ File size          : {onnx_size_kb:.1f} KB")
    print(f"  ✓ skl2onnx version   : {skl2onnx.__version__}")
    print(f"\n[train_model] Done.")


if __name__ == "__main__":
    main()
