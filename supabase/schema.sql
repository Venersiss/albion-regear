-- Starter schema for Albion Regear.
-- Run this after creating a Supabase project. Auth users are admins; members do not need accounts.

create extension if not exists "pgcrypto";

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'Americas',
  created_at timestamptz not null default now()
);

create table if not exists public.guild_admins (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  character_name text not null,
  role text not null default 'DPS',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (guild_id, character_name)
);

create table if not exists public.chests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  label text not null,
  location_note text,
  unique (guild_id, label)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  chest_id uuid references public.chests(id) on delete set null,
  name text not null,
  category text not null,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.regear_plans (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'complete')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.regear_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.regear_plans(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  weapon text,
  off_hand text,
  helmet text,
  armor text,
  boots text,
  status text not null default 'needed' check (status in ('needed', 'issued', 'regeared')),
  marked_at timestamptz,
  unique (plan_id, member_id)
);

create index if not exists members_guild_id_idx on public.members(guild_id);
create index if not exists items_guild_id_idx on public.items(guild_id);
create index if not exists plans_guild_id_starts_at_idx on public.regear_plans(guild_id, starts_at);

-- Enable RLS before connecting the client. Tighten policies around guild_admins
-- and a public member lookup/invite code in the next integration pass.
alter table public.guilds enable row level security;
alter table public.guild_admins enable row level security;
alter table public.members enable row level security;
alter table public.chests enable row level security;
alter table public.items enable row level security;
alter table public.regear_plans enable row level security;
alter table public.regear_assignments enable row level security;

