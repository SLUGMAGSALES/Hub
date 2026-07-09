-- ============================================================================
-- SLUG Sales OS — initial schema + Row Level Security
-- ============================================================================
--
-- IMPORTANT — READ BEFORE RUNNING
--
-- This migration is NON-DESTRUCTIVE. Every table uses CREATE TABLE IF NOT
-- EXISTS, so if these tables already exist in your Supabase project this file
-- will NOT drop, alter, or overwrite them. It exists so a fresh environment
-- can be stood up and so your team can RECONCILE these assumed column names
-- against the real tables.
--
-- The column names below were INFERRED from the feature requirements. If your
-- live `slug_*` tables use different column names/types, treat the README
-- "Assumed schema" section as the source of truth to diff against and adjust
-- the application queries accordingly. Do not assume this file matches prod.
--
-- Tables (continuing the team's existing names — none invented):
--   slug_team_members  — the ad-sales reps / users
--   slug_leads         — companies / prospects in the pipeline
--   slug_activities    — a logged lead touch (call, email, meeting, ...)
--   slug_follow_ups    — due/overdue follow-up items, derived from activities
--
-- ============================================================================

-- gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- slug_team_members
-- ----------------------------------------------------------------------------
create table if not exists public.slug_team_members (
  id           uuid primary key default gen_random_uuid(),
  -- Links an app login (Supabase Auth user) to a sales rep profile.
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name    text not null default 'Unnamed rep',
  email        text unique not null,
  role         text not null default 'rep',   -- 'rep' | 'manager' | 'admin'
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- slug_leads
-- ----------------------------------------------------------------------------
create table if not exists public.slug_leads (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  website         text,
  -- Pipeline stage. Kept as text (not an enum) so the team can add stages
  -- without a migration. App expects one of:
  -- 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  stage           text not null default 'new',
  -- The rep who owns this lead (writes are scoped to the owner via RLS).
  owner_id        uuid references public.slug_team_members(id) on delete set null,
  estimated_value numeric(12,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists slug_leads_owner_idx  on public.slug_leads (owner_id);
create index if not exists slug_leads_stage_idx  on public.slug_leads (stage);
create index if not exists slug_leads_company_idx on public.slug_leads (lower(company_name));

-- ----------------------------------------------------------------------------
-- slug_activities  (a logged lead touch / "what happened")
-- ----------------------------------------------------------------------------
create table if not exists public.slug_activities (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references public.slug_leads(id) on delete cascade,
  -- The rep who performed the touch.
  member_id          uuid references public.slug_team_members(id) on delete set null,
  -- How the rep reached out:
  -- 'email' | 'phone' | 'in_person' | 'social' | 'event' | 'text' | 'other'
  contact_method     text not null,
  -- Pipeline stage as of this touch (lets you reconstruct stage history).
  stage              text,
  -- Free-text "what happened" note.
  notes              text,
  -- When to follow up next. Drives slug_follow_ups + the follow-up list.
  next_follow_up_date date,
  occurred_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists slug_activities_lead_idx     on public.slug_activities (lead_id);
create index if not exists slug_activities_member_idx   on public.slug_activities (member_id);
create index if not exists slug_activities_occurred_idx on public.slug_activities (occurred_at desc);

-- ----------------------------------------------------------------------------
-- slug_follow_ups  (derived from activities: who's due / overdue)
-- ----------------------------------------------------------------------------
create table if not exists public.slug_follow_ups (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.slug_leads(id) on delete cascade,
  -- The activity whose next_follow_up_date created this follow-up.
  activity_id  uuid references public.slug_activities(id) on delete cascade,
  -- The rep responsible for the follow-up.
  member_id    uuid references public.slug_team_members(id) on delete set null,
  due_date     date not null,
  status       text not null default 'pending',   -- 'pending' | 'done' | 'cancelled'
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists slug_follow_ups_due_idx    on public.slug_follow_ups (due_date);
create index if not exists slug_follow_ups_status_idx on public.slug_follow_ups (status);
create index if not exists slug_follow_ups_member_idx on public.slug_follow_ups (member_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger for slug_leads
-- ----------------------------------------------------------------------------
create or replace function public.slug_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists slug_leads_touch_updated_at on public.slug_leads;
create trigger slug_leads_touch_updated_at
  before update on public.slug_leads
  for each row execute function public.slug_touch_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
--
-- !!  CRITICAL  !!
-- Enabling RLS in this file is NOT a guarantee. After running this migration
-- you MUST verify in the Supabase dashboard (Authentication -> Policies, or
-- Table Editor -> each table -> "RLS enabled") that RLS shows as ENABLED on
-- ALL FOUR tables. If any table already existed, `enable row level security`
-- below is still applied, but confirm it visually — an unprotected table with
-- the anon key exposes all prospect data to the public internet.
--
-- Policy model:
--   * Any authenticated team member can READ all team data (shared pipeline).
--   * WRITES are scoped to the authenticated rep:
--       - a rep may insert/update/delete leads they OWN,
--       - a rep may insert/update/delete activities/follow-ups they authored,
--       - a rep may only edit their OWN team_member profile row.
--   * The service role key bypasses RLS entirely and is used server-side only
--     (e.g. provisioning a rep's profile on first login).
-- ============================================================================

alter table public.slug_team_members enable row level security;
alter table public.slug_leads         enable row level security;
alter table public.slug_activities    enable row level security;
alter table public.slug_follow_ups    enable row level security;

-- Helper: the slug_team_members.id for the currently authenticated user.
-- SECURITY DEFINER so it can read slug_team_members regardless of that table's
-- own policies (prevents recursive policy evaluation).
create or replace function public.slug_current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.slug_team_members where auth_user_id = auth.uid()
$$;

-- ---- slug_team_members ----------------------------------------------------
-- Read: every authenticated member can see the whole team roster.
drop policy if exists slug_tm_select on public.slug_team_members;
create policy slug_tm_select on public.slug_team_members
  for select to authenticated
  using (true);

-- Insert: a user may create only their OWN profile row.
drop policy if exists slug_tm_insert_self on public.slug_team_members;
create policy slug_tm_insert_self on public.slug_team_members
  for insert to authenticated
  with check (auth_user_id = auth.uid());

-- Update: a user may edit only their OWN profile row.
drop policy if exists slug_tm_update_self on public.slug_team_members;
create policy slug_tm_update_self on public.slug_team_members
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---- slug_leads -----------------------------------------------------------
-- Read: the whole team's pipeline is visible to every authenticated member.
drop policy if exists slug_leads_select on public.slug_leads;
create policy slug_leads_select on public.slug_leads
  for select to authenticated
  using (true);

-- Insert: the new lead must be owned by the authenticated rep.
drop policy if exists slug_leads_insert_own on public.slug_leads;
create policy slug_leads_insert_own on public.slug_leads
  for insert to authenticated
  with check (owner_id = public.slug_current_member_id());

-- Update: only the owning rep may edit (and may not hand ownership away).
drop policy if exists slug_leads_update_own on public.slug_leads;
create policy slug_leads_update_own on public.slug_leads
  for update to authenticated
  using (owner_id = public.slug_current_member_id())
  with check (owner_id = public.slug_current_member_id());

-- Delete: only the owning rep may delete.
drop policy if exists slug_leads_delete_own on public.slug_leads;
create policy slug_leads_delete_own on public.slug_leads
  for delete to authenticated
  using (owner_id = public.slug_current_member_id());

-- ---- slug_activities ------------------------------------------------------
-- Read: all team activity is visible.
drop policy if exists slug_act_select on public.slug_activities;
create policy slug_act_select on public.slug_activities
  for select to authenticated
  using (true);

-- Insert: the activity must be authored by the authenticated rep.
drop policy if exists slug_act_insert_own on public.slug_activities;
create policy slug_act_insert_own on public.slug_activities
  for insert to authenticated
  with check (member_id = public.slug_current_member_id());

-- Update / delete: only the authoring rep.
drop policy if exists slug_act_update_own on public.slug_activities;
create policy slug_act_update_own on public.slug_activities
  for update to authenticated
  using (member_id = public.slug_current_member_id())
  with check (member_id = public.slug_current_member_id());

drop policy if exists slug_act_delete_own on public.slug_activities;
create policy slug_act_delete_own on public.slug_activities
  for delete to authenticated
  using (member_id = public.slug_current_member_id());

-- ---- slug_follow_ups ------------------------------------------------------
-- Read: the whole team's follow-up queue is visible.
drop policy if exists slug_fu_select on public.slug_follow_ups;
create policy slug_fu_select on public.slug_follow_ups
  for select to authenticated
  using (true);

-- Insert: the follow-up must belong to the authenticated rep.
drop policy if exists slug_fu_insert_own on public.slug_follow_ups;
create policy slug_fu_insert_own on public.slug_follow_ups
  for insert to authenticated
  with check (member_id = public.slug_current_member_id());

-- Update / delete: only the owning rep (e.g. to mark done / cancel).
drop policy if exists slug_fu_update_own on public.slug_follow_ups;
create policy slug_fu_update_own on public.slug_follow_ups
  for update to authenticated
  using (member_id = public.slug_current_member_id())
  with check (member_id = public.slug_current_member_id());

drop policy if exists slug_fu_delete_own on public.slug_follow_ups;
create policy slug_fu_delete_own on public.slug_follow_ups
  for delete to authenticated
  using (member_id = public.slug_current_member_id());

-- ============================================================================
-- End of migration. Remember: verify RLS is ENABLED on every table.
-- ============================================================================
