-- Run this after schema.sql. These policies keep the admin workspace private.
-- Members can be exposed later through a dedicated access-code endpoint, not
-- by granting anonymous read access to the full roster.

create or replace function public.is_guild_admin(target_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guild_admins
    where guild_id = target_guild_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_guild_admin(uuid) from public;
grant execute on function public.is_guild_admin(uuid) to authenticated;

create policy guild_admins_can_read_own_guild
on public.guilds for select to authenticated
using (public.is_guild_admin(id));

create policy guild_admins_can_read_membership
on public.guild_admins for select to authenticated
using (user_id = auth.uid() or public.is_guild_admin(guild_id));

create policy guild_admins_manage_members
on public.members for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_chests
on public.chests for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_items
on public.items for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_plans
on public.regear_plans for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_assignments
on public.regear_assignments for all to authenticated
using (public.is_guild_admin((select guild_id from public.regear_plans where id = plan_id)))
with check (public.is_guild_admin((select guild_id from public.regear_plans where id = plan_id)));

create policy guild_admins_manage_requests
on public.regear_requests for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_templates
on public.role_templates for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_invites
on public.admin_invites for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));

create policy guild_admins_manage_access_codes
on public.member_access_codes for all to authenticated
using (public.is_guild_admin(guild_id))
with check (public.is_guild_admin(guild_id));
