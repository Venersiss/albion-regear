-- Run this once in Supabase SQL Editor for existing Coup De Grace projects.
-- Makes persisted online notifications identify the administrator by username.

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
  actor_name_value := nullif(row_data ->> 'sender_name', '');

  if tg_table_name = 'admin_presence' then
    if tg_op = 'UPDATE' and coalesce((old_data ->> 'last_seen_at')::timestamptz, now()) >= now() - interval '3 minutes' then
      return coalesce(new, old);
    end if;
    type_value := 'admin_presence';
    title_value := 'Admin is online';
    body_value := 'An administrator is now active in the workspace.';
  elsif tg_table_name = 'admin_messages' then
    type_value := 'chat';
    title_value := 'New admin chat message';
    body_value := left(coalesce(row_data ->> 'body', ''), 180);
  elsif tg_table_name = 'admin_invites' then
    type_value := 'invite';
    title_value := 'Administrator invitation sent';
    body_value := 'An invitation was sent to ' || coalesce(row_data ->> 'email', 'a new administrator') || '.';
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
  elsif tg_table_name = 'regear_requests' then
    type_value := 'regear';
    select character_name into subject_value from public.members where id = nullif(row_data ->> 'member_id', '')::uuid;
    subject_value := coalesce(subject_value, 'a member');
    if tg_op = 'INSERT' then
      title_value := 'New regear reported';
      body_value := 'A death report was added for ' || subject_value || '.';
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
  else
    return coalesce(new, old);
  end if;

  if actor_name_value is null and actor_id_value is not null then
    select coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1))
      into actor_name_value
      from auth.users
      where id = actor_id_value;
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
