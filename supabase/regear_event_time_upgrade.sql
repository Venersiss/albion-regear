-- Run this once in Supabase SQL Editor after daily_regear_upgrade.sql.
-- Adds an optional UTC start time to each CTA/event tab.

alter table public.regear_events
  add column if not exists event_time time without time zone;
