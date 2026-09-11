-- Evidence images storage bucket and access policies
insert into storage.buckets (id, name, public)
values ('return-evidence', 'return-evidence', false)
on conflict (id) do nothing;

drop policy if exists "read return evidence" on storage.objects;
create policy "read return evidence" on storage.objects for select to anon, authenticated
  using (bucket_id = 'return-evidence');

drop policy if exists "upload return evidence" on storage.objects;
create policy "upload return evidence" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'return-evidence');