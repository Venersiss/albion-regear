-- Run this once in Supabase SQL Editor after schema.sql and policies.sql.
-- Adds date-scoped CTA/event tabs, multiple item lines with quantities, and
-- archive/audit fields for existing Coup De Grace projects.
-- Then run admin_notifications.sql again so CTA/event edits are audited too.

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

drop policy if exists guild_admins_manage_regear_events on public.regear_events;
create policy guild_admins_manage_regear_events
on public.regear_events for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

drop policy if exists guild_admins_manage_regear_request_items on public.regear_request_items;
create policy guild_admins_manage_regear_request_items
on public.regear_request_items for all to authenticated
using (public.is_guild_admin((select guild_id from public.regear_requests where id = regear_request_id)))
with check (public.is_guild_admin((select guild_id from public.regear_requests where id = regear_request_id)));

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

-- Create a safe fallback CTA tab for legacy requests that do not have one.
insert into public.regear_events (guild_id, event_date, name)
select distinct guild_id, (died_at at time zone 'UTC')::date, 'Unassigned event'
from public.regear_requests
where event_id is null
on conflict (guild_id, event_date, lower(name)) do nothing;

update public.regear_requests r
set event_id = e.id
from public.regear_events e
where r.event_id is null
  and e.guild_id = r.guild_id
  and e.event_date = (r.died_at at time zone 'UTC')::date
  and e.name = 'Unassigned event';
