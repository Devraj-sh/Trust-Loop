-- TrustLoop core trust loop schema
create type public.risk_level as enum ('LOW','MEDIUM','HIGH');
create type public.decision_outcome as enum ('AUTO_APPROVE','MANUAL_REVIEW','REFUND_ON_INSPECTION','DECLINE');
create type public.return_status as enum ('SUBMITTED','ANALYSED','IN_REVIEW','RESOLVED');
create type public.actor_kind as enum ('SYSTEM','HUMAN');

create table public.product_categories (
  code int primary key,
  name text not null,
  avg_rating numeric not null default 0,
  complaint_rate numeric not null default 0,
  dissatisfaction_rate numeric not null default 0,
  low_rating_pct numeric not null default 0
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  city text not null,
  city_code int not null,
  state text not null,
  state_code int not null,
  total_orders int not null default 0,
  total_items_purchased int not null default 0,
  avg_items_per_order numeric not null default 0,
  total_spent numeric not null default 0,
  avg_order_value numeric not null default 0,
  total_freight numeric not null default 0,
  freight_to_value_ratio numeric not null default 0,
  total_reviews int not null default 0,
  avg_review_score numeric not null default 0,
  low_rating_count int not null default 0,
  high_rating_count int not null default 0,
  low_rating_percentage numeric not null default 0,
  avg_delivery_days numeric not null default 0,
  late_deliveries int not null default 0,
  late_delivery_percentage numeric not null default 0,
  days_since_last_order numeric not null default 0,
  customer_lifetime_days numeric not null default 0,
  is_one_time_buyer int not null default 1,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  category_code int not null references public.product_categories(code),
  purchased_at timestamptz not null,
  delivered_at timestamptz,
  estimated_delivery_at timestamptz,
  num_items int not null default 1,
  total_price numeric not null,
  avg_item_price numeric not null,
  total_freight numeric not null default 0,
  freight_ratio numeric not null default 0,
  price_segment int not null default 0,
  review_score numeric not null default 5,
  has_review_comment int not null default 0,
  actual_delivery_days numeric not null default 0,
  estimated_delivery_days numeric not null default 0,
  delivery_delay_days numeric not null default 0,
  is_late_delivery int not null default 0,
  purchase_month int not null default 1,
  purchase_day_of_week int not null default 0,
  historical_return_flag int not null default 0,
  created_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id);
create index orders_external_idx on public.orders(external_id);

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  reason_code text not null,
  claimed_condition text not null,
  description text,
  status public.return_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index return_requests_created_idx on public.return_requests(created_at desc);

create table public.return_images (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  storage_path text not null,
  content_type text not null,
  byte_size int not null,
  created_at timestamptz not null default now()
);
create index return_images_return_idx on public.return_images(return_id);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  model_key text not null,
  model_label text not null,
  risk_score numeric not null,
  risk_level public.risk_level not null,
  confidence numeric not null,
  contributions jsonb not null default '[]'::jsonb,
  feature_vector jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index predictions_return_idx on public.predictions(return_id);

create table public.policy_evaluations (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  eligible boolean not null,
  window_days_remaining int,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index policy_evaluations_return_idx on public.policy_evaluations(return_id);

create table public.vision_analyses (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  image_id uuid references public.return_images(id) on delete cascade,
  provider text not null,
  model text not null,
  is_fallback boolean not null default false,
  observed_condition text,
  damage_score numeric,
  matches_claim boolean,
  findings jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);
create index vision_analyses_return_idx on public.vision_analyses(return_id);

create table public.behaviour_signals (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  behaviour_score numeric not null,
  signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index behaviour_signals_return_idx on public.behaviour_signals(return_id);

create table public.fusion_results (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  trust_score numeric not null,
  agreement numeric not null,
  evidence jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index fusion_results_return_idx on public.fusion_results(return_id);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  outcome public.decision_outcome not null,
  source public.actor_kind not null default 'SYSTEM',
  confidence numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index decisions_return_idx on public.decisions(return_id);

create table public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  reviewer_name text not null,
  verdict public.decision_outcome not null,
  agreed_with_system boolean not null,
  notes text,
  created_at timestamptz not null default now()
);
create index human_reviews_return_idx on public.human_reviews(return_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  return_id uuid references public.return_requests(id) on delete cascade,
  stage text not null,
  actor public.actor_kind not null default 'SYSTEM',
  actor_name text,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_return_idx on public.audit_events(return_id, created_at);

-- Grants: the app is intentionally open (no sign-in) for this phase.
grant select on public.product_categories to anon, authenticated;
grant select on public.customers to anon, authenticated;
grant select on public.orders to anon, authenticated;
grant select, insert, update on public.return_requests to anon, authenticated;
grant select, insert on public.return_images to anon, authenticated;
grant select, insert on public.predictions to anon, authenticated;
grant select, insert on public.policy_evaluations to anon, authenticated;
grant select, insert on public.vision_analyses to anon, authenticated;
grant select, insert on public.behaviour_signals to anon, authenticated;
grant select, insert on public.fusion_results to anon, authenticated;
grant select, insert, update on public.decisions to anon, authenticated;
grant select, insert on public.human_reviews to anon, authenticated;
grant select, insert on public.audit_events to anon, authenticated;
grant all on public.product_categories, public.customers, public.orders, public.return_requests,
  public.return_images, public.predictions, public.policy_evaluations, public.vision_analyses,
  public.behaviour_signals, public.fusion_results, public.decisions, public.human_reviews,
  public.audit_events to service_role;

alter table public.product_categories enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_images enable row level security;
alter table public.predictions enable row level security;
alter table public.policy_evaluations enable row level security;
alter table public.vision_analyses enable row level security;
alter table public.behaviour_signals enable row level security;
alter table public.fusion_results enable row level security;
alter table public.decisions enable row level security;
alter table public.human_reviews enable row level security;
alter table public.audit_events enable row level security;

-- Reference/history data is read-only to clients.
create policy "read categories" on public.product_categories for select to anon, authenticated using (true);
create policy "read customers" on public.customers for select to anon, authenticated using (true);
create policy "read orders" on public.orders for select to anon, authenticated using (true);

-- Operational tables: open read/append for the unauthenticated demo workspace.
create policy "read returns" on public.return_requests for select to anon, authenticated using (true);
create policy "write returns" on public.return_requests for insert to anon, authenticated with check (true);
create policy "update returns" on public.return_requests for update to anon, authenticated using (true) with check (true);
create policy "read images" on public.return_images for select to anon, authenticated using (true);
create policy "write images" on public.return_images for insert to anon, authenticated with check (true);
create policy "read predictions" on public.predictions for select to anon, authenticated using (true);
create policy "write predictions" on public.predictions for insert to anon, authenticated with check (true);
create policy "read policy evals" on public.policy_evaluations for select to anon, authenticated using (true);
create policy "write policy evals" on public.policy_evaluations for insert to anon, authenticated with check (true);
create policy "read vision" on public.vision_analyses for select to anon, authenticated using (true);
create policy "write vision" on public.vision_analyses for insert to anon, authenticated with check (true);
create policy "read behaviour" on public.behaviour_signals for select to anon, authenticated using (true);
create policy "write behaviour" on public.behaviour_signals for insert to anon, authenticated with check (true);
create policy "read fusion" on public.fusion_results for select to anon, authenticated using (true);
create policy "write fusion" on public.fusion_results for insert to anon, authenticated with check (true);
create policy "read decisions" on public.decisions for select to anon, authenticated using (true);
create policy "write decisions" on public.decisions for insert to anon, authenticated with check (true);
create policy "update decisions" on public.decisions for update to anon, authenticated using (true) with check (true);
create policy "read reviews" on public.human_reviews for select to anon, authenticated using (true);
create policy "write reviews" on public.human_reviews for insert to anon, authenticated with check (true);
create policy "read audit" on public.audit_events for select to anon, authenticated using (true);
create policy "write audit" on public.audit_events for insert to anon, authenticated with check (true);