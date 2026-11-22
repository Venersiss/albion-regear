-- Run this once in the Supabase SQL Editor (Kill log, plan Phase 6).
-- Remembers which Albion kill event a regear was created from, so the Kill log can show
-- "In regears" for that death and the same death can't be added twice.

alter table public.regear_requests
  add column if not exists kill_event_id text;

create unique index if not exists regear_requests_kill_event_idx
  on public.regear_requests (guild_id, kill_event_id)
  where kill_event_id is not null;
