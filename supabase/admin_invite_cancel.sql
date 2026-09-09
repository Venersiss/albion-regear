-- Run this once in Supabase SQL Editor for existing Coup De Grace projects.
alter table public.admin_invites
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null;
