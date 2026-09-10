-- Starter schema for Albion Regear.
-- Run this after creating a Supabase project. Auth users are admins; members do not need accounts.

create extension if not exists "pgcrypto";

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'Americas',
  bootstrap_admin_email text not null,
  public_slug text not null unique,
  public_access_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.guild_admins (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.admin_presence (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists admin_presence_last_seen_idx
  on public.admin_presence(guild_id, last_seen_at desc);

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists admin_messages_guild_created_idx
  on public.admin_messages(guild_id, created_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Administrator',
  type text not null default 'activity',
  title text not null,
  body text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_guild_created_idx
  on public.admin_notifications(guild_id, created_at desc);

create table if not exists public.admin_notification_reads (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invited_user_id uuid references auth.users(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_invites_guild_email_idx on public.admin_invites (guild_id, lower(email)) where accepted_at is null;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  character_name text not null,
  role text not null default 'DPS',
  issue_chest text not null default 'Unassigned',
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
  tier text not null default 'Unspecified',
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  created_at timestamptz not null default now()
);

alter table public.items
  add column if not exists tier text not null default 'Unspecified';

drop index if exists items_guild_name_idx;
create unique index if not exists items_guild_name_tier_idx on public.items (guild_id, lower(name), tier);

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
  silver_cost integer not null default 0 check (silver_cost >= 0),
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  marked_at timestamptz,
  unique (plan_id, member_id)
);

-- A regear request is created by an admin after a member dies during a CTA.
-- Keep this separate from the scheduled CTA so one CTA can produce many requests.
create table if not exists public.regear_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  cta_plan_id uuid references public.regear_plans(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  reported_by_name text,
  role text not null default 'DPS' check (role in ('Tank', 'Support', 'Healer', 'DPS', 'Bomb', 'Caller')),
  died_at timestamptz not null default now(),
  death_note text,
  issue_chest text not null default 'Unassigned',
  chest_id uuid references public.chests(id) on delete set null,
  weapon text,
  off_hand text,
  helmet text,
  armor text,
  boots text,
  status text not null default 'open' check (status in ('open', 'issued', 'regeared')),
  silver_cost integer not null default 0 check (silver_cost >= 0),
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  regeared_at timestamptz,
  regeared_by uuid references auth.users(id) on delete set null,
  regeared_by_name text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz,
  archived_from_status text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists regear_requests_guild_status_idx on public.regear_requests(guild_id, status, created_at desc);

create table if not exists public.role_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  role text not null check (role in ('Tank', 'Support', 'Healer', 'DPS', 'Bomb', 'Caller')),
  name text not null,
  weapon text,
  off_hand text,
  helmet text,
  armor text,
  boots text,
  created_at timestamptz not null default now(),
  unique (guild_id, role, name)
);

create table if not exists public.member_access_codes (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists members_guild_id_idx on public.members(guild_id);
create index if not exists items_guild_id_idx on public.items(guild_id);
create index if not exists plans_guild_id_starts_at_idx on public.regear_plans(guild_id, starts_at);

-- Enable RLS before connecting the client. Tighten policies around guild_admins
-- and a public member lookup/invite code in the next integration pass.
alter table public.guilds enable row level security;
alter table public.guild_admins enable row level security;
alter table public.admin_presence enable row level security;
alter table public.admin_messages enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;
alter table public.admin_invites enable row level security;
alter table public.members enable row level security;
alter table public.chests enable row level security;
alter table public.items enable row level security;
alter table public.regear_plans enable row level security;
alter table public.regear_assignments enable row level security;
alter table public.regear_requests enable row level security;
alter table public.role_templates enable row level security;
alter table public.member_access_codes enable row level security;

-- Daily regear events and flexible item lines.
create table if not exists public.regear_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_date date not null,
  name text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists regear_events_guild_date_name_idx
  on public.regear_events (guild_id, event_date, lower(name));

create index if not exists regear_events_guild_date_idx
  on public.regear_events (guild_id, event_date desc);

create table if not exists public.regear_request_items (
  id uuid primary key default gen_random_uuid(),
  regear_request_id uuid not null references public.regear_requests(id) on delete cascade,
  category text not null check (category in ('Weapon', 'Off hand', 'Head', 'Armor', 'Boots', 'Custom')),
  item_name text not null,
  quantity integer not null default 1 check (quantity >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists regear_request_items_request_idx
  on public.regear_request_items (regear_request_id, sort_order);

alter table public.regear_requests
  add column if not exists event_id uuid references public.regear_events(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text,
  add column if not exists updated_at timestamptz,
  add column if not exists archived_from_status text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_by_name text;

do $$
begin
  alter table public.regear_requests drop constraint if exists regear_requests_status_check;
  alter table public.regear_requests add constraint regear_requests_status_check
    check (status in ('open', 'issued', 'regeared', 'archived'));
end $$;

alter table public.regear_events enable row level security;
alter table public.regear_request_items enable row level security;

-- Backfill the legacy one-item-per-slot columns into flexible item lines.
insert into public.regear_request_items (regear_request_id, category, item_name, quantity, sort_order)
select r.id, x.category, x.item_name, 1, x.sort_order
from public.regear_requests r
cross join lateral (
  values
    ('Weapon', r.weapon, 1),
    ('Off hand', r.off_hand, 2),
    ('Head', r.helmet, 3),
    ('Armor', r.armor, 4),
    ('Boots', r.boots, 5)
) as x(category, item_name, sort_order)
where nullif(x.item_name, '') is not null
  and not exists (
    select 1 from public.regear_request_items existing
    where existing.regear_request_id = r.id
  );
