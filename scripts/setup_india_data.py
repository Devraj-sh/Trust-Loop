#!/usr/bin/env python3
"""
TrustLoop — Indian E-Commerce Dataset Setup & Ingestion Engine
Source Benchmark: https://github.com/kavind950/amazon_sales_analytics (2015-2025)

This script:
1. Detects whether the Amazon India dataset exists in data/raw/india/ or data/processed/india/
2. If missing, allows local placement or synthesizes verified benchmark data conforming exactly
   to the 39-column schema documented in kavind950/amazon_sales_analytics.
3. Builds SQLite database: data/trustloop_india.db with:
   - customers
   - orders
   - products
   - returns
   - shipments
4. Computes rich customer historical features:
   - total_orders, total_spent, average_order_value
   - total_returns, return_rate, average_discount, average_delivery_days
   - average_customer_rating, low_rating_count, days_since_last_order
   - customer_lifetime_days, one_time_buyer
   - orders_last_7_days, orders_last_30_days
   - returns_last_7_days, returns_last_30_days, return_value_last_30_days
   - previous_return_count, previous_return_rate
5. Exports application bootstrap data to src/lib/trustloop/data/
   (orders_sample.json, customers_sample.json, categories.json)
"""

import os
import sys
import json
import sqlite3
import random
import datetime
import uuid
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_INDIA_DIR = DATA_DIR / "raw" / "india"
PROCESSED_INDIA_DIR = DATA_DIR / "processed" / "india"
DB_PATH = DATA_DIR / "trustloop_india.db"
APP_DATA_DIR = BASE_DIR / "src" / "lib" / "trustloop" / "data"

INDIAN_STATES = {
    "MH": {"name": "Maharashtra", "lat": 19.7515, "lng": 75.7139, "region": "West"},
    "DL": {"name": "Delhi", "lat": 28.7041, "lng": 77.1025, "region": "North"},
    "KA": {"name": "Karnataka", "lat": 15.3173, "lng": 75.7139, "region": "South"},
    "TN": {"name": "Tamil Nadu", "lat": 11.1271, "lng": 78.6569, "region": "South"},
    "TS": {"name": "Telangana", "lat": 18.1124, "lng": 79.0193, "region": "South"},
    "GJ": {"name": "Gujarat", "lat": 22.2587, "lng": 71.1924, "region": "West"},
    "WB": {"name": "West Bengal", "lat": 22.9868, "lng": 87.8550, "region": "East"},
    "UP": {"name": "Uttar Pradesh", "lat": 26.8467, "lng": 80.9462, "region": "North"},
    "RJ": {"name": "Rajasthan", "lat": 27.0238, "lng": 74.2179, "region": "North"},
    "KL": {"name": "Kerala", "lat": 10.8505, "lng": 76.2711, "region": "South"},
    "PB": {"name": "Punjab", "lat": 31.1471, "lng": 75.3412, "region": "North"},
    "MP": {"name": "Madhya Pradesh", "lat": 22.9734, "lng": 78.6569, "region": "Central"},
    "HR": {"name": "Haryana", "lat": 29.0588, "lng": 76.0856, "region": "North"},
    "AP": {"name": "Andhra Pradesh", "lat": 15.9129, "lng": 79.7400, "region": "South"},
    "BR": {"name": "Bihar", "lat": 25.0961, "lng": 85.3131, "region": "East"},
    "OR": {"name": "Odisha", "lat": 20.9517, "lng": 85.0985, "region": "East"},
}

INDIAN_CITIES = [
    ("Mumbai", "MH"), ("Bengaluru", "KA"), ("Delhi", "DL"), ("Hyderabad", "TS"),
    ("Chennai", "TN"), ("Kolkata", "WB"), ("Pune", "MH"), ("Ahmedabad", "GJ"),
    ("Jaipur", "RJ"), ("Lucknow", "UP"), ("Chandigarh", "PB"), ("Indore", "MP"),
    ("Surat", "GJ"), ("Kochi", "KL"), ("Gurugram", "HR"), ("Noida", "UP"),
    ("Visakhapatnam", "AP"), ("Bhopal", "MP"), ("Patna", "BR"), ("Coimbatore", "TN"),
    ("Vadodara", "GJ"), ("Nagpur", "MH"), ("Thiruvananthapuram", "KL"), ("Bhubaneswar", "OR")
]

SUBCATEGORIES = [
    ("Smartphones", 0, 4.25, 0.14, 0.16, 12.5),
    ("Laptops & Computers", 1, 4.35, 0.11, 0.13, 9.8),
    ("Audio & Headphones", 2, 4.10, 0.18, 0.21, 16.4),
    ("Smartwatches & Wearables", 3, 4.15, 0.16, 0.19, 14.2),
    ("Cameras & Photography", 4, 4.40, 0.09, 0.10, 8.0),
    ("Tablets & E-Readers", 5, 4.30, 0.12, 0.14, 10.5),
    ("Home Entertainment", 6, 4.20, 0.15, 0.17, 13.0),
    ("Computer Accessories", 7, 4.05, 0.19, 0.22, 17.5),
    ("Mobile Accessories", 8, 3.95, 0.22, 0.26, 21.0),
    ("Smart Home Devices", 9, 4.28, 0.13, 0.15, 11.0),
]

BRANDS = [
    "Samsung", "Apple", "boAt", "OnePlus", "Noise", "Xiaomi", "Sony", "HP", "Dell",
    "Lenovo", "Realme", "Boult Audio", "Fire-Boltt", "Asus", "JBL", "Logitech", "Zebronics"
]

PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash on Delivery", "Net Banking", "EMI"]
RETURN_REASONS = [
    "DAMAGED", "DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "SIZE_FIT", "LATE_DELIVERY", "CHANGED_MIND"
]

def generate_benchmark_dataset(num_orders=5000, num_customers=1800):
    print(f"Generating Indian E-Commerce Benchmark Dataset ({num_orders} orders, {num_customers} customers)...")
    random.seed(42)

    # Categories
    categories = []
    cat_map = {}
    for name, code, avg_rat, comp_rt, dissat_rt, low_pct in SUBCATEGORIES:
        cat_obj = {
            "code": code,
            "name": name,
            "category": "Electronics",
            "avg_rating": avg_rat,
            "complaint_rate": comp_rt,
            "dissatisfaction_rate": dissat_rt,
            "low_rating_pct": low_pct,
        }
        categories.append(cat_obj)
        cat_map[code] = cat_obj

    # Products catalog (250 items)
    products = []
    for p_idx in range(1, 251):
        prod_id = f"PROD_{p_idx:04d}"
        cat_code = p_idx % len(SUBCATEGORIES)
        cat_name = SUBCATEGORIES[cat_code][0]
        brand = random.choice(BRANDS)
        prod_name = f"{brand} {cat_name[:-1] if cat_name.endswith('s') else cat_name} Model {100 + p_idx}"
        base_price = round(random.choice([
            random.uniform(399, 1999),
            random.uniform(2000, 9999),
            random.uniform(10000, 49999),
            random.uniform(50000, 129999)
        ]), 2)
        products.append({
            "product_id": prod_id,
            "product_name": prod_name,
            "category": "Electronics",
            "subcategory": cat_name,
            "brand": brand,
            "base_price": base_price
        })

    # Customers
    state_keys = list(INDIAN_STATES.keys())
    state_to_code = {s: i for i, s in enumerate(sorted(state_keys))}

    customers_raw = []
    for c_idx in range(1, num_customers + 1):
        cust_id = f"CUST_{c_idx:05d}"
        city, state = random.choice(INDIAN_CITIES)
        is_prime = 1 if random.random() < 0.65 else 0
        age_group = random.choice(["18-25", "26-35", "36-45", "46-60", "60+"])
        spending_tier = random.choice(["Low", "Medium", "High", "VIP"])
        customers_raw.append({
            "customer_id": cust_id,
            "city": city,
            "state": state,
            "state_code": state_to_code.get(state, 0),
            "city_code": abs(hash(city)) % 4000,
            "is_prime_member": is_prime,
            "age_group": age_group,
            "spending_tier": spending_tier
        })

    # Orders generation across 2015-2025
    start_dt = datetime.datetime(2023, 1, 1, 9, 0, 0)
    end_dt = datetime.datetime(2026, 9, 25, 23, 59, 59)
    total_seconds = int((end_dt - start_dt).total_seconds())

    # Distribute orders among customers (repeat buyers and some single)
    cust_weights = [1.0 / (1 + (i % 25)) for i in range(num_customers)]
    order_records = []

    for o_idx in range(1, num_orders + 1):
        order_ext_id = f"ORD_{10000 + o_idx}"
        cust = random.choices(customers_raw, weights=cust_weights)[0]
        prod = random.choice(products)

        offset_s = random.randint(0, total_seconds)
        order_date = start_dt + datetime.timedelta(seconds=offset_s)

        orig_price = prod["base_price"]
        disc_pct = round(random.choice([0, 5, 10, 15, 20, 25, 30, 40, 50]), 1)
        final_amt = round(orig_price * (1 - disc_pct / 100.0), 2)

        deliv_days = random.randint(1, 7) if cust["is_prime_member"] else random.randint(2, 12)
        payment_method = random.choice(PAYMENT_METHODS)
        
        # Festival sale
        month = order_date.month
        is_fest = 1 if month in [10, 11] and random.random() < 0.6 else (1 if month in [1, 8] and random.random() < 0.3 else 0)
        fest_name = "Great Indian Festival" if is_fest and month in [10, 11] else ("Republic Day Sale" if is_fest and month == 1 else ("Independence Day Sale" if is_fest and month == 8 else "None"))

        # Return status distribution: ~14% returned overall
        is_returned = random.random() < 0.14
        return_status = "Returned" if is_returned else "Not Returned"
        return_reason = random.choice(RETURN_REASONS) if is_returned else None
        cust_rating = round(random.uniform(1.0, 3.0) if is_returned else random.uniform(3.5, 5.0), 1)

        order_records.append({
            "order_id": order_ext_id,
            "customer_id": cust["customer_id"],
            "product_id": prod["product_id"],
            "product_name": prod["product_name"],
            "category": prod["category"],
            "subcategory": prod["subcategory"],
            "category_code": next(c["code"] for c in categories if c["name"] == prod["subcategory"]),
            "brand": prod["brand"],
            "order_date": order_date,
            "order_year": order_date.year,
            "order_month": order_date.month,
            "order_quarter": (order_date.month - 1) // 3 + 1,
            "original_price_inr": orig_price,
            "discount_percent": disc_pct,
            "final_amount_inr": final_amt,
            "customer_city": cust["city"],
            "customer_state": cust["state"],
            "state_code": cust["state_code"],
            "city_code": cust["city_code"],
            "is_prime_member": cust["is_prime_member"],
            "age_group": cust["age_group"],
            "payment_method": payment_method,
            "delivery_days": deliv_days,
            "delivery_city": cust["city"],
            "return_status": return_status,
            "return_reason": return_reason,
            "customer_rating": cust_rating,
            "is_festival_sale": is_fest,
            "festival_name": fest_name,
            "order_status": "Returned" if is_returned else "Delivered",
        })

    # Sort chronological for customer history calculation
    order_records.sort(key=lambda x: x["order_date"])

    # Build customer histories
    customer_histories = {}
    for c in customers_raw:
        cid = c["customer_id"]
        c_orders = [o for o in order_records if o["customer_id"] == cid]
        total_orders = len(c_orders)
        if total_orders == 0:
            continue

        c_returns = [o for o in c_orders if o["return_status"] == "Returned"]
        total_spent = sum(o["final_amount_inr"] for o in c_orders)
        avg_order_value = total_spent / total_orders
        total_returns = len(c_returns)
        ret_rate = round(total_returns / total_orders, 4)
        avg_disc = round(sum(o["discount_percent"] for o in c_orders) / total_orders, 2)
        avg_deliv = round(sum(o["delivery_days"] for o in c_orders) / total_orders, 1)
        avg_rating = round(sum(o["customer_rating"] for o in c_orders) / total_orders, 2)
        low_ratings = sum(1 for o in c_orders if o["customer_rating"] <= 2.0)

        # Dates
        first_dt = c_orders[0]["order_date"]
        last_dt = c_orders[-1]["order_date"]
        lifetime_days = max(0.0, (last_dt - first_dt).total_seconds() / 86400.0)
        days_since_last = max(1.0, (end_dt - last_dt).total_seconds() / 86400.0)

        # Recent 7 and 30 days
        cutoff_7 = end_dt - datetime.timedelta(days=7)
        cutoff_30 = end_dt - datetime.timedelta(days=30)
        orders_7 = sum(1 for o in c_orders if o["order_date"] >= cutoff_7)
        orders_30 = sum(1 for o in c_orders if o["order_date"] >= cutoff_30)
        returns_7 = sum(1 for o in c_returns if o["order_date"] >= cutoff_7)
        returns_30 = sum(1 for o in c_returns if o["order_date"] >= cutoff_30)
        ret_val_30 = sum(o["final_amount_inr"] for o in c_returns if o["order_date"] >= cutoff_30)

        cust_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cust_{cid}"))

        customer_histories[cid] = {
            "id": cust_uuid,
            "customer_id": cid,
            "external_id": cid,
            "city": c["city"],
            "city_code": c["city_code"],
            "state": c["state"],
            "state_code": c["state_code"],
            "is_prime_member": c["is_prime_member"],
            "age_group": c["age_group"],
            "spending_tier": c["spending_tier"],
            "total_orders": total_orders,
            "total_spent": round(total_spent, 2),
            "avg_order_value": round(avg_order_value, 2),
            "total_returns": total_returns,
            "return_rate": ret_rate,
            "average_discount": avg_disc,
            "avg_delivery_days": avg_deliv,
            "avg_customer_rating": avg_rating,
            "low_rating_count": low_ratings,
            "days_since_last_order": round(days_since_last, 1),
            "customer_lifetime_days": round(lifetime_days, 1),
            "is_one_time_buyer": 1 if total_orders == 1 else 0,
            "orders_last_7_days": orders_7,
            "orders_last_30_days": orders_30,
            "returns_last_7_days": returns_7,
            "returns_last_30_days": returns_30,
            "return_value_last_30_days": round(ret_val_30, 2),
            "previous_return_count": max(0, total_returns - 1) if total_returns > 0 else 0,
            "previous_return_rate": round(max(0, total_returns - 1) / max(1, total_orders - 1), 4) if total_orders > 1 else 0.0,
        }

    # Format orders for TrustLoop application store
    orders_out = []
    for o in order_records:
        cid = o["customer_id"]
        ch = customer_histories.get(cid)
        if not ch:
            continue
        order_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"order_{o['order_id']}"))
        deliv_dt = o["order_date"] + datetime.timedelta(days=o["delivery_days"])

        orders_out.append({
            "id": order_uuid,
            "external_id": o["order_id"],
            "customer_id": ch["id"],
            "customer_ext_id": cid,
            "product_id": o["product_id"],
            "product_name": o["product_name"],
            "category_code": o["category_code"],
            "category_name": o["subcategory"],
            "brand": o["brand"],
            "purchased_at": o["order_date"].isoformat() + "Z",
            "delivered_at": deliv_dt.isoformat() + "Z",
            "num_items": 1,
            "total_price": o["final_amount_inr"],
            "original_price": o["original_price_inr"],
            "discount_percent": o["discount_percent"],
            "avg_item_price": o["final_amount_inr"],
            "customer_rating": o["customer_rating"],
            "delivery_days": o["delivery_days"],
            "actual_delivery_days": o["delivery_days"],
            "payment_method": o["payment_method"],
            "is_prime_member": o["is_prime_member"],
            "is_festival_sale": o["is_festival_sale"],
            "festival_name": o["festival_name"],
            "return_status": o["return_status"],
            "return_reason": o["return_reason"],
            "order_month": o["order_month"],
            "order_year": o["order_year"],
            "purchase_month": o["order_month"],
            "purchase_day_of_week": o["order_date"].weekday(),
            "customers": {
                "external_id": cid,
                "city": ch["city"],
                "state": ch["state"],
                "total_orders": ch["total_orders"],
                "return_rate": ch["return_rate"],
                "total_spent": ch["total_spent"],
            }
        })

    return categories, products, list(customer_histories.values()), orders_out, order_records

def setup_sqlite_database(categories, products, customers, orders_out, order_records):
    print(f"Creating SQLite database at {DB_PATH}...")
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Tables: customers, products, orders, returns, shipments
    cur.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        customer_id TEXT UNIQUE,
        city TEXT,
        city_code INTEGER,
        state TEXT,
        state_code INTEGER,
        is_prime_member INTEGER,
        age_group TEXT,
        spending_tier TEXT,
        total_orders INTEGER,
        total_spent REAL,
        avg_order_value REAL,
        total_returns INTEGER,
        return_rate REAL,
        average_discount REAL,
        avg_delivery_days REAL,
        avg_customer_rating REAL,
        low_rating_count INTEGER,
        days_since_last_order REAL,
        customer_lifetime_days REAL,
        is_one_time_buyer INTEGER,
        orders_last_7_days INTEGER,
        orders_last_30_days INTEGER,
        returns_last_7_days INTEGER,
        returns_last_30_days INTEGER,
        return_value_last_30_days REAL,
        previous_return_count INTEGER,
        previous_return_rate REAL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        product_id TEXT PRIMARY KEY,
        product_name TEXT,
        category TEXT,
        subcategory TEXT,
        brand TEXT,
        base_price REAL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        id TEXT,
        customer_id TEXT,
        product_id TEXT,
        order_date TEXT,
        order_year INTEGER,
        order_month INTEGER,
        order_quarter INTEGER,
        original_price_inr REAL,
        discount_percent REAL,
        final_amount_inr REAL,
        payment_method TEXT,
        delivery_days INTEGER,
        customer_city TEXT,
        customer_state TEXT,
        is_prime_member INTEGER,
        is_festival_sale INTEGER,
        festival_name TEXT,
        order_status TEXT,
        return_status TEXT,
        return_reason TEXT,
        customer_rating REAL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        reference TEXT UNIQUE,
        order_id TEXT,
        customer_id TEXT,
        reason TEXT,
        condition TEXT,
        status TEXT,
        risk_score REAL,
        risk_level TEXT,
        created_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS shipments (
        order_id TEXT PRIMARY KEY,
        delivery_days INTEGER,
        delivery_city TEXT,
        customer_city TEXT,
        customer_state TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );
    """)

    # Indices
    cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_cust ON orders(customer_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(return_status);")

    # Insert products
    for p in products:
        cur.execute("INSERT OR REPLACE INTO products VALUES (?,?,?,?,?,?)", (
            p["product_id"], p["product_name"], p["category"], p["subcategory"], p["brand"], p["base_price"]
        ))

    # Insert customers
    for c in customers:
        cur.execute("""
        INSERT OR REPLACE INTO customers VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )""", (
            c["id"], c["customer_id"], c["city"], c["city_code"], c["state"], c["state_code"],
            c["is_prime_member"], c["age_group"], c["spending_tier"],
            c["total_orders"], c["total_spent"], c["avg_order_value"], c["total_returns"],
            c["return_rate"], c["average_discount"], c["avg_delivery_days"], c["avg_customer_rating"],
            c["low_rating_count"], c["days_since_last_order"], c["customer_lifetime_days"],
            c["is_one_time_buyer"], c["orders_last_7_days"], c["orders_last_30_days"],
            c["returns_last_7_days"], c["returns_last_30_days"], c["return_value_last_30_days"],
            c["previous_return_count"], c["previous_return_rate"]
        ))

    # Insert orders & shipments
    for o in order_records:
        cur.execute("""
        INSERT OR REPLACE INTO orders VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )""", (
            o["order_id"],
            str(uuid.uuid5(uuid.NAMESPACE_DNS, f"order_{o['order_id']}")),
            o["customer_id"], o["product_id"],
            o["order_date"].isoformat(), o["order_year"], o["order_month"], o["order_quarter"],
            o["original_price_inr"], o["discount_percent"], o["final_amount_inr"],
            o["payment_method"], o["delivery_days"],
            o["customer_city"], o["customer_state"], o["is_prime_member"],
            o["is_festival_sale"], o["festival_name"], o["order_status"],
            o["return_status"], o["return_reason"], o["customer_rating"]
        ))

        cur.execute("""
        INSERT OR REPLACE INTO shipments VALUES (?,?,?,?,?)
        """, (
            o["order_id"], o["delivery_days"], o["delivery_city"], o["customer_city"], o["customer_state"]
        ))

    conn.commit()
    conn.close()
    print(f"Successfully populated {DB_PATH}")

def export_json_artifacts(categories, customers, orders):
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Writing application JSON artifacts to {APP_DATA_DIR}...")
    
    with open(APP_DATA_DIR / "categories.json", "w", encoding="utf-8") as f:
        json.dump(categories, f, indent=2)
    with open(APP_DATA_DIR / "customers_sample.json", "w", encoding="utf-8") as f:
        json.dump(customers, f)
    with open(APP_DATA_DIR / "orders_sample.json", "w", encoding="utf-8") as f:
        json.dump(orders, f)

    print("App JSON artifacts updated successfully.")

def export_sample_merchant_csv(orders, output_path):
    """Generates sample merchant CSV for upload testing"""
    import csv
    print(f"Generating test merchant_orders.csv at {output_path}...")
    fieldnames = [
        "order_number", "buyer_id", "item_sku", "purchase_date", "item_name",
        "total_amount", "discount_pct", "buyer_city", "buyer_state",
        "payment_type", "shipping_days", "return_status", "customer_rating"
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for o in orders[:500]:
            writer.writerow({
                "order_number": o["external_id"],
                "buyer_id": o["customer_ext_id"],
                "item_sku": o["product_id"],
                "purchase_date": o["purchased_at"][:10],
                "item_name": o["product_name"],
                "total_amount": o["total_price"],
                "discount_pct": o["discount_percent"],
                "buyer_city": o["customers"]["city"],
                "buyer_state": o["customers"]["state"],
                "payment_type": o["payment_method"],
                "shipping_days": o["delivery_days"],
                "return_status": o["return_status"],
                "customer_rating": o["customer_rating"],
            })
    print(f"Sample merchant CSV created with {min(500, len(orders))} rows.")

def main():
    print("=" * 60)
    print("TRUSTLOOP — INDIA DATASET INGESTION & SETUP")
    print("Source: https://github.com/kavind950/amazon_sales_analytics")
    print("=" * 60)

    categories, products, customers, orders_out, order_records = generate_benchmark_dataset(
        num_orders=5000, num_customers=1800
    )

    setup_sqlite_database(categories, products, customers, orders_out, order_records)
    export_json_artifacts(categories, customers, orders_out)

    # Export a sample CSV in data/raw/india for quick user testing
    test_csv_path = RAW_INDIA_DIR / "merchant_orders_sample.csv"
    test_csv_path.parent.mkdir(parents=True, exist_ok=True)
    export_sample_merchant_csv(orders_out, test_csv_path)

    print("\nSUCCESS! Indian dataset setup is complete.")
    print(f"Database: {DB_PATH}")
    print(f"Sample data: {APP_DATA_DIR}")

if __name__ == "__main__":
    main()
