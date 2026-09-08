-- Run this once in Supabase SQL Editor for existing Coup De Grace projects.
-- It adds Albion's quality tiers and allows the same item name at different tiers.

alter table public.items
  add column if not exists tier text not null default 'Unspecified';

drop index if exists public.items_guild_name_idx;
create unique index if not exists items_guild_name_tier_idx
  on public.items (guild_id, lower(name), tier);
