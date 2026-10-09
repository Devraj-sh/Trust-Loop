#!/usr/bin/env python3
"""
TrustLoop — Indian Dataset Downloader & Setup Assistant
Official Source: https://github.com/kavind950/amazon_sales_analytics

This script verifies if local Indian dataset files are present in:
  - data/raw/india/amazon_india_*.csv
  - data/processed/india/amazon_india_cleaned.csv

If present, it processes them and loads them into TrustLoop.
If not present, it provides official source details, checks for user-provided files,
and executes the benchmark ingestion pipeline.
"""

import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_INDIA_DIR = BASE_DIR / "data" / "raw" / "india"
PROCESSED_INDIA_DIR = BASE_DIR / "data" / "processed" / "india"
DB_PATH = BASE_DIR / "data" / "trustloop_india.db"

def check_existing_data():
    RAW_INDIA_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_INDIA_DIR.mkdir(parents=True, exist_ok=True)

    raw_files = list(RAW_INDIA_DIR.glob("amazon_india_*.csv"))
    proc_files = list(PROCESSED_INDIA_DIR.glob("*.csv"))

    print("=" * 65)
    print("TRUSTLOOP — INDIAN E-COMMERCE DATASET STATUS")
    print("=" * 65)
    print(f"Official Source Repository: https://github.com/kavind950/amazon_sales_analytics")
    print(f"Expected Raw Directory:     {RAW_INDIA_DIR}")
    print(f"Expected Processed Dir:     {PROCESSED_INDIA_DIR}")
    print(f"Target Database:            {DB_PATH}")
    print("-" * 65)

    if raw_files or proc_files:
        print(f"[FOUND] Detected {len(raw_files)} raw files and {len(proc_files)} processed files locally.")
    else:
        print("[INFO] No external large CSV files detected in data/raw/india/.")
        print("Note: The 242 MB dataset from kavind950/amazon_sales_analytics is git-ignored")
        print("to avoid repository bloat. You can place transaction CSVs directly into data/raw/india/.")

    print("\nRunning TrustLoop Indian database & benchmark generator...")
    from scripts.setup_india_data import main as setup_main
    setup_main()

if __name__ == "__main__":
    check_existing_data()
