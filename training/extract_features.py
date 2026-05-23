"""
extract_features.py

Reads training/data/HDFS.log line-by-line (~11 million lines, 1.5 GB),
groups log lines by HDFS block ID, computes a 7-dimensional feature
vector per block, joins the ground-truth label from anomaly_label.csv,
and writes the result to training/data/features.csv.

Feature vector (per block):
    1. total_count          – total log lines for this block
    2. error_count          – lines where level == ERROR
    3. warn_count           – lines where level == WARN
    4. info_count           – lines where level == INFO
    5. error_ratio          – error_count / total_count
    6. warn_ratio           – warn_count / total_count
    7. unique_components    – distinct component strings seen for this block

Usage:
    python training/extract_features.py
"""

import os
import re
import sys
from collections import defaultdict

import pandas as pd
from tqdm import tqdm

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BASE_DIR, "data")
LOG_FILE     = os.path.join(DATA_DIR, "HDFS.log")
LABEL_FILE   = os.path.join(DATA_DIR, "anomaly_label.csv")
OUTPUT_FILE  = os.path.join(DATA_DIR, "features.csv")

# ── Regex ──────────────────────────────────────────────────────────────────────
# Log line format:
#   081109 203518 143 INFO dfs.DataNode$PacketResponder: PacketResponder 1 for block blk_38865049064139660 terminating
#
# Fields: date  time  pid  level  component  message
LINE_RE  = re.compile(
    r"^\d{6}\s+\d{6}\s+\d+\s+(?P<level>\w+)\s+(?P<component>\S+):\s+(?P<message>.+)$"
)
BLOCK_RE = re.compile(r"blk_-?\d+")


def get_file_size(path: str) -> int:
    return os.path.getsize(path)


def parse_and_aggregate(log_file: str) -> dict:
    """
    Stream HDFS.log line-by-line, extract block IDs via regex, and
    accumulate per-block counters.

    Returns a dict keyed by block_id:
        { block_id: {"total": int, "error": int, "warn": int, "info": int,
                     "components": set} }
    """
    # Use defaultdict for zero-cost initialisation
    blocks: dict[str, dict] = defaultdict(lambda: {
        "total": 0,
        "error": 0,
        "warn": 0,
        "info": 0,
        "components": set(),
    })

    file_size = get_file_size(log_file)
    skipped   = 0

    with open(log_file, "r", encoding="utf-8", errors="replace") as fh:
        with tqdm(
            total=file_size,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc="Parsing HDFS.log",
            dynamic_ncols=True,
        ) as pbar:
            for raw_line in fh:
                pbar.update(len(raw_line.encode("utf-8", errors="replace")))

                line = raw_line.rstrip()
                if not line:
                    continue

                # Extract all block IDs mentioned in this line
                block_ids = BLOCK_RE.findall(line)
                if not block_ids:
                    skipped += 1
                    continue

                # Parse structured fields
                m = LINE_RE.match(line)
                if m:
                    level     = m.group("level").upper()
                    component = m.group("component")
                else:
                    level     = "UNKNOWN"
                    component = "UNKNOWN"
                    skipped  += 1

                # Update every block mentioned on this line
                for blk in block_ids:
                    rec = blocks[blk]
                    rec["total"] += 1
                    if level == "ERROR":
                        rec["error"] += 1
                    elif level == "WARN":
                        rec["warn"] += 1
                    elif level == "INFO":
                        rec["info"] += 1
                    rec["components"].add(component)

    print(f"\n  Lines without a block ID (skipped for features): {skipped:,}")
    return blocks


def build_feature_df(blocks: dict) -> pd.DataFrame:
    """Convert the raw block counters into a tidy DataFrame."""
    rows = []
    for blk_id, rec in blocks.items():
        total = rec["total"]
        error = rec["error"]
        warn  = rec["warn"]
        info  = rec["info"]
        rows.append({
            "BlockId":            blk_id,
            "total_count":        total,
            "error_count":        error,
            "warn_count":         warn,
            "info_count":         info,
            "error_ratio":        round(error / total, 6) if total else 0.0,
            "warn_ratio":         round(warn  / total, 6) if total else 0.0,
            "unique_components":  len(rec["components"]),
        })
    return pd.DataFrame(rows)


def attach_labels(features_df: pd.DataFrame, label_file: str) -> pd.DataFrame:
    """
    Read anomaly_label.csv and join on BlockId.
    The CSV has columns: BlockId, Label  (values: Normal / Anomaly)
    We map → 0 / 1 and name the column 'label'.
    """
    labels_df = pd.read_csv(label_file)

    # Normalise column names (strip whitespace)
    labels_df.columns = [c.strip() for c in labels_df.columns]

    # Map string labels to integers
    label_map = {"Normal": 0, "Anomaly": 1}
    labels_df["label"] = labels_df["Label"].map(label_map)

    merged = features_df.merge(labels_df[["BlockId", "label"]], on="BlockId", how="left")

    # Blocks that have no label entry → treat as Normal (0)
    unlabelled = merged["label"].isna().sum()
    if unlabelled:
        print(f"  [warn] {unlabelled:,} blocks had no matching label → assigned 0 (Normal)")
    merged["label"] = merged["label"].fillna(0).astype(int)

    return merged


def main():
    # ── Validate inputs ────────────────────────────────────────────────────────
    for path in (LOG_FILE, LABEL_FILE):
        if not os.path.exists(path):
            print(f"[extract_features] ERROR: File not found: {path}")
            sys.exit(1)

    print(f"[extract_features] Log file  : {LOG_FILE}")
    print(f"[extract_features] Label file: {LABEL_FILE}")
    print(f"[extract_features] Output    : {OUTPUT_FILE}")
    print()

    # ── Parse ──────────────────────────────────────────────────────────────────
    blocks = parse_and_aggregate(LOG_FILE)
    print(f"  Unique block IDs found: {len(blocks):,}")

    # ── Build feature DataFrame ────────────────────────────────────────────────
    print("\n[extract_features] Building feature matrix …")
    features_df = build_feature_df(blocks)

    # ── Attach ground-truth labels ─────────────────────────────────────────────
    print("[extract_features] Joining labels …")
    features_df = attach_labels(features_df, LABEL_FILE)

    # ── Summary ───────────────────────────────────────────────────────────────
    n_normal  = int((features_df["label"] == 0).sum())
    n_anomaly = int((features_df["label"] == 1).sum())
    print(f"\n  ── Label distribution ──────────────────────────────")
    print(f"  Normal blocks  : {n_normal:,}")
    print(f"  Anomaly blocks : {n_anomaly:,}")
    print(f"  Total blocks   : {len(features_df):,}")
    print(f"  Anomaly rate   : {n_anomaly / len(features_df) * 100:.2f}%")

    # ── Save ───────────────────────────────────────────────────────────────────
    col_order = [
        "BlockId", "total_count", "error_count", "warn_count", "info_count",
        "error_ratio", "warn_ratio", "unique_components", "label",
    ]
    features_df[col_order].to_csv(OUTPUT_FILE, index=False)
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 ** 2)
    print(f"\n[extract_features] Saved → {OUTPUT_FILE}  ({size_mb:.2f} MB)")

    print("\nSample rows:")
    print(features_df[col_order].head(5).to_string(index=False))


if __name__ == "__main__":
    main()
