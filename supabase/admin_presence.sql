-- Run this once in Supabase SQL Editor to enable cross-device admin presence.
create table if not exists public.admin_presence (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists admin_presence_last_seen_idx
  on public.admin_presence(guild_id, last_seen_at desc);

alter table public.admin_presence enable row level security;

drop policy if exists guild_admins_can_manage_presence on public.admin_presence;
create policy guild_admins_can_manage_presence
on public.admin_presence for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));
