import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

with open(BASE_DIR / 'src' / 'lib' / 'ml' / 'artifacts' / 'features.json') as f:
    feat_spec = json.load(f)
cols = feat_spec['featureColumns']

with open(BASE_DIR / 'src' / 'lib' / 'ml' / 'artifacts' / 'xgb.json') as f:
    xgb_art = json.load(f)
with open(BASE_DIR / 'src' / 'lib' / 'ml' / 'artifacts' / 'lr.json') as f:
    lr_art = json.load(f)
with open(BASE_DIR / 'src' / 'lib' / 'ml' / 'artifacts' / 'dt.json') as f:
    dt_art = json.load(f)

with open(BASE_DIR / 'src' / 'lib' / 'trustloop' / 'data' / 'orders_sample.json') as f:
    orders = {o['id']: o for o in json.load(f)}
with open(BASE_DIR / 'src' / 'lib' / 'trustloop' / 'data' / 'customers_sample.json') as f:
    customers = {c['id']: c for c in json.load(f)}
with open(BASE_DIR / 'src' / 'lib' / 'trustloop' / 'data' / 'categories.json') as f:
    categories = {c['code']: c for c in json.load(f)}

def build_vector(order_id):
    o = orders[order_id]
    c = customers[o['customer_id']]
    cat = categories.get(o['category_code'], {})
    
    order_amt = float(o.get('total_price', 0))
    orig_price = float(o.get('original_price', order_amt))
    disc_pct = float(o.get('discount_percent', 0))
    deliv_days = float(o.get('delivery_days', 5))
    rating = float(o.get('customer_rating', 4.0))
    prime = float(o.get('is_prime_member', c.get('is_prime_member', 0)))
    fest = float(o.get('is_festival_sale', 0))
    cat_code = float(o.get('category_code', 0))
    city_code = float(c.get('city_code', 100))
    state_code = float(c.get('state_code', 5))
    month = float(o.get('order_month', 6))
    dow = float(o.get('purchase_day_of_week', 2))
    
    tot_orders = float(c.get('total_orders', 1))
    tot_spent = float(c.get('total_spent', order_amt))
    avg_spend = float(c.get('avg_order_value', order_amt))
    tot_returns = float(c.get('total_returns', 0))
    ret_rate = float(c.get('return_rate', 0))
    avg_disc = float(c.get('average_discount', disc_pct))
    avg_deliv = float(c.get('avg_delivery_days', deliv_days))
    avg_rat = float(c.get('avg_customer_rating', rating))
    low_rat = float(c.get('low_rating_count', 0))
    recency = float(c.get('days_since_last_order', 30))
    lifetime = float(c.get('customer_lifetime_days', 0))
    one_time = float(c.get('is_one_time_buyer', 1))
    ord_7 = float(c.get('orders_last_7_days', 0))
    ord_30 = float(c.get('orders_last_30_days', 0))
    ret_7 = float(c.get('returns_last_7_days', 0))
    ret_30 = float(c.get('returns_last_30_days', 0))
    ret_val_30 = float(c.get('return_value_last_30_days', 0))
    prev_ret = float(c.get('previous_return_count', 0))
    prev_ret_rate = float(c.get('previous_return_rate', 0))
    
    val_ratio = order_amt / max(1.0, avg_spend)
    comp_rate = float(cat.get('complaint_rate', 0.15))
    dissat_rate = float(cat.get('dissatisfaction_rate', 0.17))
    cat_avg_rat = float(cat.get('avg_rating', 4.2))
    cat_low_pct = float(cat.get('low_rating_pct', 12.0))
    
    disc_ret_cross = disc_pct * prev_ret_rate
    rat_deliv_cross = rating * deliv_days
    
    return {
        'order_amount': order_amt, 'original_price': orig_price, 'discount_percent': disc_pct,
        'delivery_days': deliv_days, 'customer_rating': rating, 'is_prime_member': prime,
        'is_festival_sale': fest, 'category_code': cat_code, 'customer_city_code': city_code,
        'customer_state_code': state_code, 'order_month': month, 'order_day_of_week': dow,
        'total_orders': tot_orders, 'total_spent': tot_spent, 'avg_order_value': avg_spend,
        'total_returns': tot_returns, 'return_rate': ret_rate, 'average_discount': avg_disc,
        'avg_delivery_days': avg_deliv, 'avg_customer_rating': avg_rat, 'low_rating_count': low_rat,
        'days_since_last_order': recency, 'customer_lifetime_days': lifetime, 'is_one_time_buyer': one_time,
        'orders_last_7_days': ord_7, 'orders_last_30_days': ord_30, 'returns_last_7_days': ret_7,
        'returns_last_30_days': ret_30, 'return_value_last_30_days': ret_val_30,
        'previous_return_count': prev_ret, 'previous_return_rate': prev_ret_rate,
        'value_to_avg_spend_ratio': val_ratio, 'category_complaint_rate': comp_rate,
        'category_dissatisfaction_rate': dissat_rate, 'category_avg_rating': cat_avg_rat,
        'category_low_rating_pct': cat_low_pct, 'discount_return_cross': disc_ret_cross,
        'rating_delivery_cross': rat_deliv_cross
    }

def eval_xgb(vec):
    score = 0.0
    for tree in xgb_art['trees']:
        node = tree
        while 'leaf' not in node:
            split_feat = node['split']
            val = vec.get(split_feat, 0)
            thresh = node['split_condition']
            if val < thresh:
                node = node['children'][0]
            else:
                node = node['children'][1]
        score += node['leaf']
    return 1.0 / (1.0 + math.exp(-score))

def eval_lr(vec):
    z = lr_art['intercept']
    for i, col in enumerate(cols):
        val = vec.get(col, 0)
        mean = lr_art['mean'][i]
        scale = lr_art['scale'][i]
        coef = lr_art['coef'][i]
        scaled = (val - mean) / scale if scale != 0 else 0
        z += coef * scaled
    return 1.0 / (1.0 + math.exp(-z))

def eval_dt(vec):
    tree = dt_art['tree']
    node = 0
    while tree['children_left'][node] != -1:
        feat_idx = tree['feature'][node]
        feat_name = cols[feat_idx]
        val = vec.get(feat_name, 0)
        thresh = tree['threshold'][node]
        if val <= thresh:
            node = tree['children_left'][node]
        else:
            node = tree['children_right'][node]
    return tree['value'][node]

test_orders = [
    ('IN-CURRENT-002', 'Aarav Mehta (Trusted VIP Buyer)'),
    ('IN-CURRENT-005', 'Ananya Singh (Low Risk Buyer)'),
    ('IN-CURRENT-008', 'Vikram Das (Loyal High Rating Buyer)'),
    ('IN-CURRENT-003', 'Priya Verma (Low-Moderate Risk)'),
    ('IN-CURRENT-006', 'Rohit Kumar (Moderate Risk)'),
    ('IN-CURRENT-004', 'Karan Gupta (Moderate Risk)'),
    ('IN-CURRENT-001', 'Rahul Sharma (High Return Rate)'),
    ('IN-CURRENT-007', 'Neha Yadav (Serial Return Abuser)'),
]

for oid, desc in test_orders:
    if oid not in orders:
        continue
    v = build_vector(oid)
    print(f"\n=== Order: {oid} - {desc} ===")
    print(f"  Cust: {orders[oid].get('customer_name')}, Order Amt: INR {v['order_amount']:.2f}")
    print(f"  Order Rating: {v['customer_rating']}, Cust Return Rate: {v['return_rate']*100:.1f}%, Cust AvgRating: {v['avg_customer_rating']:.2f}")
    print(f"  XGBoost Risk Score: {eval_xgb(v):.4f}")
    print(f"  Logistic Regression: {eval_lr(v):.4f}")
    print(f"  Decision Tree: {eval_dt(v):.4f}")
