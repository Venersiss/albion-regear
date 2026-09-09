-- Run this once in Supabase SQL Editor for existing Coup De Grace projects.
alter table public.regear_requests
  add column if not exists regeared_by uuid references auth.users(id) on delete set null,
  add column if not exists regeared_by_name text;

create index if not exists regear_requests_regeared_by_idx
  on public.regear_requests(regeared_by)
  where regeared_by is not null;
