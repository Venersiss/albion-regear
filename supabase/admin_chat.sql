-- Run this once in the Supabase SQL Editor for an existing Coup De Grace project.
-- Admin chat is private to linked administrators in the same guild.

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

alter table public.admin_messages enable row level security;

drop policy if exists guild_admins_manage_messages on public.admin_messages;
create policy guild_admins_manage_messages
on public.admin_messages for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

do $$
begin
  alter publication supabase_realtime add table public.admin_messages;
exception
  when duplicate_object then null;
end $$;
