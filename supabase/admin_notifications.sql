-- Run this once in the Supabase SQL Editor for an existing Coup De Grace project.
-- Creates persistent admin activity notifications and Realtime delivery.

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

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

drop policy if exists guild_admins_read_notifications on public.admin_notifications;
create policy guild_admins_read_notifications
on public.admin_notifications for select to authenticated
using (public.is_guild_admin(guild_id));

drop policy if exists guild_admins_manage_notification_reads on public.admin_notification_reads;
create policy guild_admins_manage_notification_reads
on public.admin_notification_reads for all to authenticated
using (public.is_guild_admin((select guild_id from public.admin_notifications where id = notification_id)))
with check (public.is_guild_admin((select guild_id from public.admin_notifications where id = notification_id)) and user_id = auth.uid());

create or replace function public.record_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  guild_id_value uuid;
  actor_id_value uuid;
  actor_name_value text;
  subject_value text;
  type_value text := 'activity';
  title_value text;
  body_value text;
  entity_id_value uuid;
begin
  guild_id_value := nullif(row_data ->> 'guild_id', '')::uuid;
  entity_id_value := nullif(row_data ->> 'id', '')::uuid;
  actor_id_value := coalesce(
    auth.uid(),
    nullif(row_data ->> 'reported_by', '')::uuid,
    nullif(row_data ->> 'invited_by', '')::uuid,
    nullif(row_data ->> 'sender_id', '')::uuid,
    nullif(row_data ->> 'user_id', '')::uuid
  );
  actor_name_value := coalesce(nullif(row_data ->> 'sender_name', ''), nullif(row_data ->> 'actor_name', ''));

  if tg_table_name = 'admin_presence' then
    if tg_op = 'UPDATE' and coalesce((old_data ->> 'last_seen_at')::timestamptz, now()) >= now() - interval '3 minutes' then
      return coalesce(new, old);
    end if;
    type_value := 'admin_presence';
    title_value := 'Admin is online';
    body_value := 'An administrator is now active in the workspace.';
  elsif tg_table_name = 'admin_messages' then
    type_value := 'chat';
    title_value := case when tg_op = 'INSERT' then 'New admin chat message' when tg_op = 'DELETE' then 'Admin chat message deleted' else 'Admin chat message updated' end;
    body_value := case when tg_op = 'INSERT' then left(coalesce(row_data ->> 'body', ''), 180) when tg_op = 'DELETE' then 'An admin chat message was deleted.' else 'An admin chat message was edited.' end;
  elsif tg_table_name = 'admin_invites' then
    type_value := 'invite';
    title_value := case when tg_op = 'DELETE' then 'Administrator invitation cancelled' else 'Administrator invitation sent' end;
    body_value := case when tg_op = 'DELETE' then 'The invitation for ' || coalesce(row_data ->> 'email', 'a new administrator') || ' was cancelled.' else 'An invitation was sent to ' || coalesce(row_data ->> 'email', 'a new administrator') || '.' end;
  elsif tg_table_name = 'members' then
    type_value := 'member';
    subject_value := coalesce(row_data ->> 'character_name', 'a guild member');
    title_value := case when tg_op = 'INSERT' then 'Member added' when tg_op = 'DELETE' then 'Member removed' else 'Member updated' end;
    body_value := subject_value || case when tg_op = 'INSERT' then ' was added to the roster.' when tg_op = 'DELETE' then ' was removed from the roster.' else ' was updated.' end;
  elsif tg_table_name = 'items' then
    type_value := 'item';
    subject_value := coalesce(row_data ->> 'name', 'an armory item');
    title_value := case when tg_op = 'INSERT' then 'Armory item added' when tg_op = 'DELETE' then 'Armory item removed' else 'Armory item updated' end;
    body_value := subject_value || case when tg_op = 'INSERT' then ' was added to the catalog.' when tg_op = 'DELETE' then ' was removed from the catalog.' else ' was updated.' end;
  elsif tg_table_name = 'regear_events' then
    type_value := 'regear';
    subject_value := coalesce(row_data ->> 'name', 'a CTA/event');
    title_value := case when tg_op = 'INSERT' then 'CTA/event added' when tg_op = 'DELETE' then 'CTA/event removed' else 'CTA/event updated' end;
    body_value := subject_value || case when tg_op = 'INSERT' then ' was added to the daily regear log.' when tg_op = 'DELETE' then ' was removed from the daily regear log.' else ' was updated in the daily regear log.' end;
  elsif tg_table_name = 'regear_requests' then
    type_value := 'regear';
    select character_name into subject_value from public.members where id = nullif(row_data ->> 'member_id', '')::uuid;
    subject_value := coalesce(subject_value, 'a member');
    if tg_op = 'INSERT' then
      title_value := 'New regear reported';
      body_value := 'A death report was added for ' || subject_value || '.';
    elsif tg_op = 'DELETE' then
      title_value := 'Regear request deleted';
      body_value := 'The regear request for ' || subject_value || ' was deleted.';
    elsif coalesce(row_data ->> 'status', '') = 'regeared' and coalesce(old_data ->> 'status', '') <> 'regeared' then
      title_value := 'Regear completed';
      body_value := subject_value || ' was marked as regeared.';
    else
      title_value := 'Regear request updated';
      body_value := 'The regear request for ' || subject_value || ' was updated.';
    end if;
  elsif tg_table_name = 'regear_plans' then
    type_value := 'plan';
    title_value := case when tg_op = 'INSERT' then 'Regear day added' when tg_op = 'DELETE' then 'Regear day removed' else 'Regear day updated' end;
    body_value := coalesce(row_data ->> 'title', 'A regear day') || case when tg_op = 'INSERT' then ' was added.' when tg_op = 'DELETE' then ' was removed.' else ' was updated.' end;
  elsif tg_table_name = 'cta_activity' then
    type_value := 'cta';
    subject_value := coalesce(row_data -> 'details' ->> 'name', row_data ->> 'action', 'CTA composition');
    title_value := 'CTA composition activity';
    body_value := coalesce(row_data ->> 'action', 'A CTA composition change was recorded.') || case when right(coalesce(row_data ->> 'action', ''), 1) = '.' then '' else '.' end;
  else
    return coalesce(new, old);
  end if;

  if actor_name_value is null and actor_id_value is not null then
    select coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1))
      into actor_name_value
      from auth.users
      where id = actor_id_value;
  end if;
  if actor_name_value is null and tg_table_name = 'cta_signups' then
    actor_name_value := subject_value;
  end if;
  actor_name_value := coalesce(actor_name_value, 'Administrator');
  if type_value = 'admin_presence' then
    body_value := actor_name_value || ' is now active in the workspace.';
  elsif type_value <> 'chat' then
    body_value := actor_name_value || ' · ' || coalesce(body_value, 'performed an action.');
  end if;

  insert into public.admin_notifications (guild_id, actor_id, actor_name, type, title, body, entity_id)
  values (guild_id_value, actor_id_value, actor_name_value, type_value, title_value, body_value, entity_id_value);

  return coalesce(new, old);
end;
$$;

revoke all on function public.record_admin_notification() from public;

drop trigger if exists admin_notifications_presence_trigger on public.admin_presence;
create trigger admin_notifications_presence_trigger
after insert or update on public.admin_presence
for each row execute function public.record_admin_notification();

drop trigger if exists admin_notifications_messages_trigger on public.admin_messages;
create trigger admin_notifications_messages_trigger
after insert or update or delete on public.admin_messages
for each row execute function public.record_admin_notification();

drop trigger if exists admin_notifications_invites_trigger on public.admin_invites;
create trigger admin_notifications_invites_trigger
after insert or delete on public.admin_invites
for each row execute function public.record_admin_notification();

drop trigger if exists admin_notifications_members_trigger on public.members;
create trigger admin_notifications_members_trigger
after insert or update or delete on public.members
for each row execute function public.record_admin_notification();

drop trigger if exists admin_notifications_items_trigger on public.items;
create trigger admin_notifications_items_trigger
after insert or update or delete on public.items
for each row execute function public.record_admin_notification();

drop trigger if exists admin_notifications_requests_trigger on public.regear_requests;
create trigger admin_notifications_requests_trigger
after insert or update or delete on public.regear_requests
for each row execute function public.record_admin_notification();

do $$
begin
  if to_regclass('public.regear_events') is not null then
    execute 'drop trigger if exists admin_notifications_events_trigger on public.regear_events';
    execute 'create trigger admin_notifications_events_trigger after insert or update or delete on public.regear_events for each row execute function public.record_admin_notification()';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cta_activity') is not null then
    execute 'drop trigger if exists admin_notifications_cta_activity_trigger on public.cta_activity';
    execute 'create trigger admin_notifications_cta_activity_trigger after insert on public.cta_activity for each row execute function public.record_admin_notification()';
  end if;
end $$;

drop trigger if exists admin_notifications_plans_trigger on public.regear_plans;
create trigger admin_notifications_plans_trigger
after insert or update or delete on public.regear_plans
for each row execute function public.record_admin_notification();

do $$
begin
  alter publication supabase_realtime add table public.admin_notifications;
exception
  when duplicate_object then null;
end $$;

create or replace function public.record_regear_date_deleted(target_guild_id uuid, target_date date, deleted_record_count integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id_value uuid := auth.uid();
  actor_name_value text;
begin
  if actor_id_value is null or not public.is_guild_admin(target_guild_id) then
    raise exception 'Only a guild administrator can record a deleted regear date.' using errcode = '42501';
  end if;

  select coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1), 'Administrator')
    into actor_name_value
    from auth.users
    where id = actor_id_value;

  insert into public.admin_notifications (guild_id, actor_id, actor_name, type, title, body)
  values (
    target_guild_id,
    actor_id_value,
    coalesce(actor_name_value, 'Administrator'),
    'regear',
    'Death date deleted',
    'Deleted the daily regear date ' || target_date::text || ' and ' || greatest(coalesce(deleted_record_count, 0), 0)::text || ' regear record' || case when greatest(coalesce(deleted_record_count, 0), 0) = 1 then '' else 's' end || '.'
  );

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.record_regear_date_deleted(uuid, date, integer) from public;
grant execute on function public.record_regear_date_deleted(uuid, date, integer) to authenticated;
