-- Fix RLS permissions for demo mode and relax return_requests foreign key

-- 1. Enable insert/update policies for orders, customers, and categories
drop policy if exists "write categories" on public.product_categories;
create policy "write categories" on public.product_categories for insert to anon, authenticated with check (true);
drop policy if exists "update categories" on public.product_categories;
create policy "update categories" on public.product_categories for update to anon, authenticated using (true) with check (true);

drop policy if exists "write customers" on public.customers;
create policy "write customers" on public.customers for insert to anon, authenticated with check (true);
drop policy if exists "update customers" on public.customers;
create policy "update customers" on public.customers for update to anon, authenticated using (true) with check (true);

drop policy if exists "write orders" on public.orders;
create policy "write orders" on public.orders for insert to anon, authenticated with check (true);
drop policy if exists "update orders" on public.orders;
create policy "update orders" on public.orders for update to anon, authenticated using (true) with check (true);

-- 2. Relax foreign key constraint so in-memory/dataset orders never block return submissions
alter table public.return_requests drop constraint if exists return_requests_order_id_fkey;
