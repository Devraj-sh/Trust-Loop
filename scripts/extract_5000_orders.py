import zipfile
import csv
import io
import json
import os
import uuid
import datetime

zip_path = r'C:\Users\drajs\Downloads\smart-return-risk-analytics-master.zip'

print("Opening zip archive...")
with zipfile.ZipFile(zip_path, 'r') as z:
    # 1. Load product features to build categories
    print("Reading product features...")
    cat_names = set()
    cat_stats = {}
    with z.open('smart-return-risk-analytics-master/data/sql_outputs/product_features.csv') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for row in reader:
            cat = row.get('product_category_name') or 'outros'
            if cat not in cat_stats:
                cat_stats[cat] = {
                    'name': cat,
                    'complaint_sum': 0.0,
                    'dissat_sum': 0.0,
                    'rating_sum': 0.0,
                    'low_sum': 0.0,
                    'count': 0
                }
            cat_stats[cat]['complaint_sum'] += float(row.get('high_complaint_product') or 0)
            cat_stats[cat]['dissat_sum'] += float(row.get('high_dissatisfaction_rate') or 0)
            cat_stats[cat]['rating_sum'] += float(row.get('avg_review_score') or 0)
            cat_stats[cat]['low_sum'] += float(row.get('low_rating_percentage') or 0)
            cat_stats[cat]['count'] += 1

    sorted_cats = sorted(cat_stats.keys())
    cat_map = {}
    categories = []
    for code, name in enumerate(sorted_cats):
        s = cat_stats[name]
        cnt = max(1, s['count'])
        cat_obj = {
            'code': code,
            'name': name,
            'avg_rating': round(s['rating_sum'] / cnt, 2),
            'complaint_rate': round(s['complaint_sum'] / cnt, 4),
            'dissatisfaction_rate': round(s['dissat_sum'] / cnt, 4),
            'low_rating_pct': round(s['low_sum'] / cnt, 2),
        }
        categories.append(cat_obj)
        cat_map[name] = cat_obj

    # 2. Read customers
    print("Reading customer features...")
    customers_dict = {}
    with z.open('smart-return-risk-analytics-master/data/sql_outputs/customer_features.csv') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for r in reader:
            cid = r['customer_unique_id']
            customers_dict[cid] = r

    # 3. Read orders (take first 5000)
    print("Reading order features and assembling 5000 orders...")
    orders = []
    customers_out = {}
    
    # State mapping for codes
    states_list = sorted(list(set([
        'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'ES', 'GO', 
        'PE', 'CE', 'PA', 'MT', 'MA', 'MS', 'PB', 'PI', 'RN', 'AL', 
        'SE', 'TO', 'RO', 'AM', 'AC', 'AP', 'RR'
    ])))
    state_to_code = {s: i for i, s in enumerate(states_list)}

    with z.open('smart-return-risk-analytics-master/data/sql_outputs/order_features_with_returns.csv') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        count = 0
        for r in reader:
            if count >= 5000:
                break
            
            cid = r['customer_unique_id']
            cust_feat = customers_dict.get(cid)
            if not cust_feat:
                continue

            order_ext_id = r['order_id']
            order_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"order_{order_ext_id}"))
            cust_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cust_{cid}"))
            
            cat_name = r.get('product_category') or 'outros'
            cat_obj = cat_map.get(cat_name, categories[0])
            cat_code = cat_obj['code']
            
            city = r.get('customer_city') or 'sao paulo'
            state = r.get('customer_state') or 'SP'
            state_code = state_to_code.get(state, 0)
            city_code = abs(hash(city)) % 4000

            # Store customer
            if cust_id not in customers_out:
                customers_out[cust_id] = {
                    'id': cust_id,
                    'external_id': cid,
                    'city': city,
                    'city_code': city_code,
                    'state': state,
                    'state_code': state_code,
                    'total_orders': int(float(cust_feat.get('total_orders') or 1)),
                    'total_items_purchased': int(float(cust_feat.get('total_items_purchased') or 1)),
                    'avg_items_per_order': float(cust_feat.get('avg_items_per_order') or 1.0),
                    'total_spent': float(cust_feat.get('total_spent') or r.get('total_price') or 0),
                    'avg_order_value': float(cust_feat.get('avg_order_value') or r.get('avg_item_price') or 0),
                    'total_freight': float(cust_feat.get('total_freight') or r.get('total_freight') or 0),
                    'freight_to_value_ratio': float(cust_feat.get('freight_to_value_ratio') or r.get('freight_ratio') or 0),
                    'total_reviews': int(float(cust_feat.get('total_reviews') or 1)),
                    'avg_review_score': float(cust_feat.get('avg_review_score') or 5.0),
                    'low_rating_count': int(float(cust_feat.get('low_rating_count') or 0)),
                    'high_rating_count': int(float(cust_feat.get('high_rating_count') or 1)),
                    'low_rating_percentage': float(cust_feat.get('low_rating_percentage') or 0),
                    'avg_delivery_days': float(cust_feat.get('avg_delivery_days') or r.get('actual_delivery_days') or 10.0),
                    'late_deliveries': int(float(cust_feat.get('late_deliveries') or 0)),
                    'late_delivery_percentage': float(cust_feat.get('late_delivery_percentage') or 0),
                    'days_since_last_order': float(cust_feat.get('days_since_last_order') or 100.0),
                    'customer_lifetime_days': float(cust_feat.get('customer_lifetime_days') or 0.0),
                    'is_one_time_buyer': int(float(cust_feat.get('is_one_time_buyer') or 1)),
                }

            # Parse purchase date
            purch_str = r.get('order_purchase_timestamp') or '2018-05-01 12:00:00'
            try:
                purch_dt = datetime.datetime.strptime(purch_str, '%Y-%m-%d %H:%M:%S')
            except:
                purch_dt = datetime.datetime(2018, 5, 1, 12, 0, 0)

            act_days = float(r.get('actual_delivery_days') or 10.0)
            est_days = float(r.get('estimated_delivery_days') or 20.0)
            deliv_dt = purch_dt + datetime.timedelta(days=act_days)
            est_dt = purch_dt + datetime.timedelta(days=est_days)

            p_segment_str = (r.get('price_segment') or 'low').lower()
            p_segment = 0 if p_segment_str == 'low' else (1 if p_segment_str == 'medium' else 2)

            order_obj = {
                'id': order_id,
                'external_id': order_ext_id,
                'customer_id': cust_id,
                'category_code': cat_code,
                'purchased_at': purch_dt.isoformat() + 'Z',
                'delivered_at': deliv_dt.isoformat() + 'Z',
                'estimated_delivery_at': est_dt.isoformat() + 'Z',
                'num_items': int(float(r.get('num_items') or 1)),
                'total_price': float(r.get('total_price') or 0),
                'avg_item_price': float(r.get('avg_item_price') or 0),
                'total_freight': float(r.get('total_freight') or 0),
                'freight_ratio': float(r.get('freight_ratio') or 0),
                'price_segment': p_segment,
                'review_score': float(r.get('review_score') or 5),
                'has_review_comment': int(float(r.get('has_review_comment') or 0)),
                'actual_delivery_days': act_days,
                'estimated_delivery_days': est_days,
                'delivery_delay_days': float(r.get('delivery_delay_days') or -5.0),
                'is_late_delivery': int(float(r.get('is_late_delivery') or 0)),
                'purchase_month': purch_dt.month,
                'purchase_day_of_week': purch_dt.weekday(),
                # Joined info for instant client display
                'customers': {
                    'external_id': cid,
                    'city': city,
                    'state': state,
                    'total_orders': customers_out[cust_id]['total_orders']
                }
            }
            orders.append(order_obj)
            count += 1

    print(f"Extracted {len(orders)} orders, {len(customers_out)} customers, {len(categories)} categories.")
    
    out_dir = r'c:\Users\drajs\Downloads\trustlayer-ai-main\trustlayer-ai-main\src\lib\trustloop\data'
    os.makedirs(out_dir, exist_ok=True)
    
    with open(os.path.join(out_dir, 'categories.json'), 'w', encoding='utf-8') as f:
        json.dump(categories, f, indent=2)
    with open(os.path.join(out_dir, 'customers_sample.json'), 'w', encoding='utf-8') as f:
        json.dump(list(customers_out.values()), f)
    with open(os.path.join(out_dir, 'orders_sample.json'), 'w', encoding='utf-8') as f:
        json.dump(orders, f)

    print("SUCCESS: JSON files written to src/lib/trustloop/data/")

    # Also generate SQL seed file
    sql_path = r'c:\Users\drajs\Downloads\trustlayer-ai-main\trustlayer-ai-main\drizzle\seed_5000_orders.sql'
    print(f"Writing SQL seed to {sql_path}...")
    with open(sql_path, 'w', encoding='utf-8') as sf:
        sf.write("-- TrustLoop Seed Data: 5000 Orders\n\n")
        
        # Categories
        sf.write("-- 1. Insert product categories\n")
        for cat in categories:
            sf.write(f"INSERT INTO public.product_categories (code, name, avg_rating, complaint_rate, dissatisfaction_rate, low_rating_pct) "
                     f"VALUES ({cat['code']}, '{cat['name']}', {cat['avg_rating']}, {cat['complaint_rate']}, {cat['dissatisfaction_rate']}, {cat['low_rating_pct']}) "
                     f"ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;\n")
        
        # Customers
        sf.write("\n-- 2. Insert customers\n")
        cust_list = list(customers_out.values())
        for c in cust_list:
            city_escaped = c['city'].replace("'", "''")
            sf.write(f"INSERT INTO public.customers (id, external_id, city, city_code, state, state_code, total_orders, total_items_purchased, avg_items_per_order, total_spent, avg_order_value, total_freight, freight_to_value_ratio, total_reviews, avg_review_score, low_rating_count, high_rating_count, low_rating_percentage, avg_delivery_days, late_deliveries, late_delivery_percentage, days_since_last_order, customer_lifetime_days, is_one_time_buyer) "
                     f"VALUES ('{c['id']}', '{c['external_id']}', '{city_escaped}', {c['city_code']}, '{c['state']}', {c['state_code']}, {c['total_orders']}, {c['total_items_purchased']}, {c['avg_items_per_order']}, {c['total_spent']}, {c['avg_order_value']}, {c['total_freight']}, {c['freight_to_value_ratio']}, {c['total_reviews']}, {c['avg_review_score']}, {c['low_rating_count']}, {c['high_rating_count']}, {c['low_rating_percentage']}, {c['avg_delivery_days']}, {c['late_deliveries']}, {c['late_delivery_percentage']}, {c['days_since_last_order']}, {c['customer_lifetime_days']}, {c['is_one_time_buyer']}) "
                     f"ON CONFLICT (external_id) DO NOTHING;\n")
                     
        # Orders
        sf.write("\n-- 3. Insert orders\n")
        for o in orders:
            deliv = f"'{o['delivered_at']}'" if o['delivered_at'] else "NULL"
            est = f"'{o['estimated_delivery_at']}'" if o['estimated_delivery_at'] else "NULL"
            sf.write(f"INSERT INTO public.orders (id, external_id, customer_id, category_code, purchased_at, delivered_at, estimated_delivery_at, num_items, total_price, avg_item_price, total_freight, freight_ratio, price_segment, review_score, has_review_comment, actual_delivery_days, estimated_delivery_days, delivery_delay_days, is_late_delivery, purchase_month, purchase_day_of_week) "
                     f"VALUES ('{o['id']}', '{o['external_id']}', '{o['customer_id']}', {o['category_code']}, '{o['purchased_at']}', {deliv}, {est}, {o['num_items']}, {o['total_price']}, {o['avg_item_price']}, {o['total_freight']}, {o['freight_ratio']}, {o['price_segment']}, {o['review_score']}, {o['has_review_comment']}, {o['actual_delivery_days']}, {o['estimated_delivery_days']}, {o['delivery_delay_days']}, {o['is_late_delivery']}, {o['purchase_month']}, {o['purchase_day_of_week']}) "
                     f"ON CONFLICT (external_id) DO NOTHING;\n")

    print(f"SUCCESS: Wrote SQL seed file ({os.path.getsize(sql_path) / 1024 / 1024:.2f} MB)")
