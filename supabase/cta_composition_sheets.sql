-- Coup De Grace CTA composition sheets.
-- Run after schema.sql and policies.sql in Supabase SQL Editor.

create table if not exists public.cta_sheets (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  cta_name text not null,
  starts_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'open' check (status in ('draft', 'open', 'locked', 'archived')),
  disarray_level integer,
  recommended_group_size integer,
  share_token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cta_parties (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.cta_sheets(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cta_slots (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.cta_parties(id) on delete cascade,
  slot_number integer not null,
  classification text not null default 'DPS' check (classification in ('Tank', 'Support', 'Healer', 'DPS', 'Bomb', 'Caller')),
  role_label text not null default 'DPS',
  weapon text,
  off_hand text,
  helmet text,
  armor text,
  boots text,
  cape text,
  food text,
  potion text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cta_signups (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.cta_sheets(id) on delete cascade,
  slot_id uuid not null references public.cta_slots(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  edit_code_hash text not null,
  attendance_status text not null default 'signed_up' check (attendance_status in ('signed_up', 'present', 'late', 'absent', 'excused')),
  signed_up_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id),
  unique (sheet_id, member_id)
);

create table if not exists public.cta_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  description text,
  template_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cta_activity (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  sheet_id uuid not null references public.cta_sheets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Administrator',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cta_sheets_guild_starts_idx on public.cta_sheets (guild_id, starts_at desc);
create index if not exists cta_parties_sheet_order_idx on public.cta_parties (sheet_id, sort_order);
create index if not exists cta_slots_party_order_idx on public.cta_slots (party_id, sort_order);
create index if not exists cta_signups_sheet_idx on public.cta_signups (sheet_id);
create index if not exists cta_activity_sheet_created_idx on public.cta_activity (sheet_id, created_at desc);

alter table public.cta_sheets enable row level security;
alter table public.cta_parties enable row level security;
alter table public.cta_slots enable row level security;
alter table public.cta_signups enable row level security;
alter table public.cta_templates enable row level security;
alter table public.cta_activity enable row level security;

drop policy if exists guild_admins_manage_cta_sheets on public.cta_sheets;
create policy guild_admins_manage_cta_sheets
on public.cta_sheets for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

drop policy if exists guild_admins_manage_cta_parties on public.cta_parties;
create policy guild_admins_manage_cta_parties
on public.cta_parties for all to authenticated
using (public.is_guild_admin((select guild_id from public.cta_sheets where id = sheet_id)))
with check (public.is_guild_admin((select guild_id from public.cta_sheets where id = sheet_id)));

drop policy if exists guild_admins_manage_cta_slots on public.cta_slots;
create policy guild_admins_manage_cta_slots
on public.cta_slots for all to authenticated
using (public.is_guild_admin((select sheets.guild_id from public.cta_parties parties join public.cta_sheets sheets on sheets.id = parties.sheet_id where parties.id = party_id)))
with check (public.is_guild_admin((select sheets.guild_id from public.cta_parties parties join public.cta_sheets sheets on sheets.id = parties.sheet_id where parties.id = party_id)));

drop policy if exists guild_admins_manage_cta_signups on public.cta_signups;
create policy guild_admins_manage_cta_signups
on public.cta_signups for all to authenticated
using (public.is_guild_admin((select guild_id from public.cta_sheets where id = sheet_id)))
with check (public.is_guild_admin((select guild_id from public.cta_sheets where id = sheet_id)));

drop policy if exists guild_admins_manage_cta_templates on public.cta_templates;
create policy guild_admins_manage_cta_templates
on public.cta_templates for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

drop policy if exists guild_admins_manage_cta_activity on public.cta_activity;
create policy guild_admins_manage_cta_activity
on public.cta_activity for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));
