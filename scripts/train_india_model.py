#!/usr/bin/env python3
"""
TrustLoop — India Return-Risk ML Model Training & Artifact Exporter
Trains XGBoost, Logistic Regression, and Decision Tree on the Indian E-Commerce dataset.
Exports:
- models/xgb_model_india.pkl
- config/india_feature_schema.json
- src/lib/ml/artifacts/india/features.json, xgb.json, lr.json, dt.json
- src/lib/ml/artifacts/ (active runtime model)
"""

import json
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, average_precision_score
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "src" / "lib" / "trustloop" / "data" / "orders_sample.json"
CUST_PATH = BASE_DIR / "src" / "lib" / "trustloop" / "data" / "customers_sample.json"
CAT_PATH = BASE_DIR / "src" / "lib" / "trustloop" / "data" / "categories.json"

MODEL_DIR = BASE_DIR / "models"
CONFIG_DIR = BASE_DIR / "config"
ARTIFACTS_DIR = BASE_DIR / "src" / "lib" / "ml" / "artifacts"
INDIA_ARTIFACTS_DIR = ARTIFACTS_DIR / "india"
LEGACY_ARTIFACTS_DIR = ARTIFACTS_DIR / "legacy_olist"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
INDIA_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
LEGACY_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLUMNS = [
    # Order features
    "order_amount",
    "original_price",
    "discount_percent",
    "delivery_days",
    "customer_rating",
    "is_prime_member",
    "is_festival_sale",
    "category_code",
    "customer_city_code",
    "customer_state_code",
    "order_month",
    "order_day_of_week",
    # Customer historical features
    "total_orders",
    "total_spent",
    "avg_order_value",
    "total_returns",
    "return_rate",
    "average_discount",
    "avg_delivery_days",
    "avg_customer_rating",
    "low_rating_count",
    "days_since_last_order",
    "customer_lifetime_days",
    "is_one_time_buyer",
    "orders_last_7_days",
    "orders_last_30_days",
    "returns_last_7_days",
    "returns_last_30_days",
    "return_value_last_30_days",
    "previous_return_count",
    "previous_return_rate",
    "value_to_avg_spend_ratio",
    # Category benchmarks
    "category_complaint_rate",
    "category_dissatisfaction_rate",
    "category_avg_rating",
    "category_low_rating_pct",
    # Interaction features
    "discount_return_cross",
    "rating_delivery_cross",
]

def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        orders = json.load(f)
    with open(CUST_PATH, "r", encoding="utf-8") as f:
        customers = {c["id"]: c for c in json.load(f)}
    with open(CAT_PATH, "r", encoding="utf-8") as f:
        categories = {c["code"]: c for c in json.load(f)}

    rows = []
    y = []

    for o in orders:
        c = customers.get(o["customer_id"]) or {}
        cat = categories.get(o["category_code"]) or {}

        order_amt = float(o.get("total_price", 0))
        orig_price = float(o.get("original_price", order_amt))
        disc_pct = float(o.get("discount_percent", 0))
        deliv_days = float(o.get("delivery_days", o.get("actual_delivery_days", 5)))
        rating = float(o.get("customer_rating", 4.0))
        prime = float(o.get("is_prime_member", 0))
        fest = float(o.get("is_festival_sale", 0))
        cat_code = float(o.get("category_code", 0))
        city_code = float(c.get("city_code", 100))
        state_code = float(c.get("state_code", 5))
        month = float(o.get("order_month", o.get("purchase_month", 6)))
        dow = float(o.get("purchase_day_of_week", 2))

        tot_orders = float(c.get("total_orders", 1))
        tot_spent = float(c.get("total_spent", order_amt))
        avg_spend = float(c.get("avg_order_value", order_amt))
        tot_returns = float(c.get("total_returns", 0))
        ret_rate = float(c.get("return_rate", 0))
        avg_disc = float(c.get("average_discount", disc_pct))
        avg_deliv = float(c.get("avg_delivery_days", deliv_days))
        avg_rat = float(c.get("avg_customer_rating", rating))
        low_rat = float(c.get("low_rating_count", 0))
        recency = float(c.get("days_since_last_order", 30))
        lifetime = float(c.get("customer_lifetime_days", 0))
        one_time = float(c.get("is_one_time_buyer", 1))
        ord_7 = float(c.get("orders_last_7_days", 0))
        ord_30 = float(c.get("orders_last_30_days", 0))
        ret_7 = float(c.get("returns_last_7_days", 0))
        ret_30 = float(c.get("returns_last_30_days", 0))
        ret_val_30 = float(c.get("return_value_last_30_days", 0))
        prev_ret = float(c.get("previous_return_count", 0))
        prev_ret_rate = float(c.get("previous_return_rate", 0))

        val_ratio = order_amt / max(1.0, avg_spend)
        comp_rate = float(cat.get("complaint_rate", 0.15))
        dissat_rate = float(cat.get("dissatisfaction_rate", 0.17))
        cat_avg_rat = float(cat.get("avg_rating", 4.2))
        cat_low_pct = float(cat.get("low_rating_pct", 12.0))

        disc_ret_cross = disc_pct * prev_ret_rate
        rat_deliv_cross = rating * deliv_days

        feat = [
            order_amt, orig_price, disc_pct, deliv_days, rating, prime, fest,
            cat_code, city_code, state_code, month, dow,
            tot_orders, tot_spent, avg_spend, tot_returns, ret_rate, avg_disc,
            avg_deliv, avg_rat, low_rat, recency, lifetime, one_time,
            ord_7, ord_30, ret_7, ret_30, ret_val_30, prev_ret, prev_ret_rate,
            val_ratio, comp_rate, dissat_rate, cat_avg_rat, cat_low_pct,
            disc_ret_cross, rat_deliv_cross
        ]
        rows.append(feat)

        # Multi-signal return abuse and risk ground truth
        is_ret = 1 if o.get("return_status") == "Returned" else 0
        risk = 0.05
        # 1. Historical return rate and volume
        risk += min(0.35, ret_rate * 0.8)
        if tot_returns >= 5:
            risk += 0.15
        elif tot_returns >= 3:
            risk += 0.08
        elif tot_returns <= 1:
            risk -= 0.06

        # 2. Customer historical ratings and complaints
        if avg_rat < 3.3:
            risk += 0.15
        elif avg_rat < 3.8:
            risk += 0.08
        elif avg_rat >= 4.4:
            risk -= 0.12

        # 3. Frequency of low ratings
        if low_rat >= 3:
            risk += 0.10
        elif low_rat >= 1:
            risk += 0.04

        # 4. Unusual basket value compared to typical spend
        if val_ratio >= 2.0:
            risk += 0.15
        elif val_ratio >= 1.4:
            risk += 0.07

        # 5. Discount wardrobing & promo exploitation
        if disc_pct >= 35 and prev_ret >= 2:
            risk += 0.12
        elif disc_pct >= 25 and prev_ret >= 1:
            risk += 0.06

        # 6. Velocity / Recent return cluster
        if ret_30 >= 2:
            risk += 0.10

        # 7. Order return status & rating context
        if is_ret:
            risk += 0.10
        if rating <= 2:
            risk += 0.08
        elif rating >= 4:
            risk -= 0.08

        # 8. High-loyalty VIP trust credit
        if prime and tot_orders >= 10 and ret_rate < 0.15:
            risk -= 0.12

        risk = max(0.02, min(0.98, risk))
        y.append(1 if risk >= 0.35 else 0)

    df_X = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    y = np.array(y)
    return df_X, y

def main():
    print("Loading data for India Return-Risk model...")
    X, y = load_data()
    print(f"Total instances: {len(X)}, High Risk Returns: {sum(y)} ({sum(y)/len(y)*100:.1f}%)")

    medians = {col: float(X[col].median()) for col in FEATURE_COLUMNS}

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 1. Train XGBoost
    print("Training XGBoost Classifier on Indian e-commerce data...")
    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_COLUMNS)
    dtest = xgb.DMatrix(X_test, label=y_test, feature_names=FEATURE_COLUMNS)

    params = {
        "max_depth": 4,
        "learning_rate": 0.08,
        "objective": "binary:logistic",
        "eval_metric": ["auc", "logloss"],
        "base_score": 0.5,
        "colsample_bytree": 0.70,
        "subsample": 0.85,
        "reg_alpha": 0.5,
        "reg_lambda": 1.0,
        "min_child_weight": 2,
        "seed": 42
    }
    bst = xgb.train(params, dtrain, num_boost_round=80, evals=[(dtrain, "train"), (dtest, "test")], verbose_eval=False)

    y_pred_xgb = bst.predict(dtest)
    auc_xgb = roc_auc_score(y_test, y_pred_xgb)
    ap_xgb = average_precision_score(y_test, y_pred_xgb)
    print(f"XGBoost Test AUC: {auc_xgb:.4f}, AP: {ap_xgb:.4f}")
    top_feats = sorted(bst.get_score(importance_type="gain").items(), key=lambda x: x[1], reverse=True)[:8]
    print(f"Top XGBoost Features (gain): {top_feats}")

    # Save pickle model
    pkl_path = MODEL_DIR / "xgb_model_india.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump(bst, f)
    print(f"Saved {pkl_path}")

    # Dump XGBoost JSON trees with node cover statistics for SHAP/path contributions
    xgb_json_dumps = bst.get_dump(dump_format="json", with_stats=True)
    xgb_trees = [json.loads(t) for t in xgb_json_dumps]
    xgb_artifact = {
        "baseScore": 0.5,
        "trees": xgb_trees
    }

    # 2. Train Logistic Regression
    print("Training Logistic Regression on Indian data...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    lr = LogisticRegression(C=0.5, max_iter=500, random_state=42)
    lr.fit(X_train_scaled, y_train)
    y_pred_lr = lr.predict_proba(X_test_scaled)[:, 1]
    auc_lr = roc_auc_score(y_test, y_pred_lr)
    print(f"Logistic Regression Test AUC: {auc_lr:.4f}")

    lr_artifact = {
        "intercept": float(lr.intercept_[0]),
        "mean": [float(m) for m in scaler.mean_],
        "scale": [float(s) for s in scaler.scale_],
        "coef": [float(c) for c in lr.coef_[0]]
    }

    # 3. Train CART Decision Tree
    print("Training Decision Tree...")
    dt = DecisionTreeClassifier(max_depth=4, min_samples_leaf=4, random_state=42)
    dt.fit(X_train, y_train)

    t = dt.tree_
    value_prob = [float(v[0][1] / (v[0][0] + v[0][1])) for v in t.value]
    dt_artifact = {
        "tree": {
            "children_left": [int(x) for x in t.children_left],
            "children_right": [int(x) for x in t.children_right],
            "feature": [int(x) for x in t.feature],
            "threshold": [float(x) for x in t.threshold],
            "value": value_prob,
            "weighted_n": [float(x) for x in t.weighted_n_node_samples]
        }
    }

    # Feature schema artifact
    features_artifact = {
        "featureColumns": FEATURE_COLUMNS,
        "medians": medians,
        "dataset": "India Amazon Sales Analytics (2015-2025)",
        "version": "2.0-india"
    }

    # Save config/india_feature_schema.json
    schema_config = {
        "dataset": "Indian E-Commerce Analytics",
        "benchmark_source": "https://github.com/kavind950/amazon_sales_analytics",
        "feature_count": len(FEATURE_COLUMNS),
        "feature_columns": FEATURE_COLUMNS,
        "feature_medians": medians,
        "metrics": {
            "xgboost_auc": round(auc_xgb, 4),
            "xgboost_ap": round(ap_xgb, 4),
            "logistic_auc": round(auc_lr, 4)
        }
    }
    with open(CONFIG_DIR / "india_feature_schema.json", "w", encoding="utf-8") as f:
        json.dump(schema_config, f, indent=2)
    print(f"Saved {CONFIG_DIR / 'india_feature_schema.json'}")

    # Backup legacy olist artifacts if not yet backed up
    if (ARTIFACTS_DIR / "features.json").exists() and not (LEGACY_ARTIFACTS_DIR / "features.json").exists():
        import shutil
        for fn in ["features.json", "xgb.json", "lr.json", "dt.json"]:
            if (ARTIFACTS_DIR / fn).exists():
                shutil.copy2(ARTIFACTS_DIR / fn, LEGACY_ARTIFACTS_DIR / fn)
        print("Backed up legacy Olist artifacts to src/lib/ml/artifacts/legacy_olist/")

    # Save India artifacts to src/lib/ml/artifacts/india/
    for folder in [INDIA_ARTIFACTS_DIR, ARTIFACTS_DIR]:
        with open(folder / "features.json", "w", encoding="utf-8") as f:
            json.dump(features_artifact, f)
        with open(folder / "xgb.json", "w", encoding="utf-8") as f:
            json.dump(xgb_artifact, f)
        with open(folder / "lr.json", "w", encoding="utf-8") as f:
            json.dump(lr_artifact, f)
        with open(folder / "dt.json", "w", encoding="utf-8") as f:
            json.dump(dt_artifact, f)

    print("Successfully exported Indian ML artifacts to src/lib/ml/artifacts/")

if __name__ == "__main__":
    main()
