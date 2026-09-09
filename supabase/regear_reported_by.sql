-- Run this once in Supabase SQL Editor for existing Coup De Grace projects.
-- New daily regear records keep the admin username that created the report.
alter table public.regear_requests
  add column if not exists reported_by_name text;
