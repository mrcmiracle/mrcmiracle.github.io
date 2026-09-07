-- MRC Miracle — Supabase schema
-- Paste this into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

create table if not exists public.events (
  id             bigint generated always as identity primary key,
  received_at    timestamptz not null default now(),
  ts             timestamptz,
  event          text not null,
  page           text,
  lang           text,
  visitor        text,          -- random per-browser id, contains nothing about the person
  session        text,          -- random per-visit id
  site_version   text,
  is_returning   int,          -- "returning" alone is a reserved word in Postgres
  visit_number   int,
  new_session    int,
  people         int,
  pets           int,
  meds           int,
  housing        text,
  water_gallons  int,
  item_count     int,
  source         text,
  zip            text,
  city           text,
  results        int,
  nearest_mi     numeric,
  method         text,
  site           text,
  code           text,
  via            text,
  selections     text,
  selection_count int,
  offered_count  int,
  section        text,
  mode           text,
  seconds        int,
  scroll_pct     int,
  "to"           text,
  done           int,
  total          int,
  extra          jsonb
);

-- There is deliberately no ip, user_agent, name, email or precise location
-- column. The site's privacy notice promises none are collected; leaving the
-- columns out means a future change cannot quietly start storing them.

create index if not exists events_event_idx       on public.events (event);
create index if not exists events_received_at_idx on public.events (received_at desc);
create index if not exists events_zip_idx         on public.events (zip) where zip is not null;
create index if not exists events_visitor_idx     on public.events (visitor);

-- Row level security ON with NO policies means: the public anon key can do
-- nothing at all — cannot read, cannot write. Writes happen only through the
-- Vercel function, which uses the service_role key and bypasses RLS.
alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public impact counters for the live counter on the site.
-- security definer lets this one function read the table while the table
-- itself stays unreadable. It returns only aggregate totals, never rows.
-- ---------------------------------------------------------------------------
create or replace function public.impact_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'kits',    (select count(*)                from public.events where event = 'kit_complete'),
    'people',  (select coalesce(sum(people),0) from public.events where event = 'kit_complete'),
    'lookups', (select count(*)                from public.events where event = 'cleanair_lookup'),
    'commits', (select count(*)                from public.events where event = 'plan_selected')
  );
$$;

grant execute on function public.impact_stats() to anon;

-- ---------------------------------------------------------------------------
-- Saved checklist progress for people who choose to sign in with Google.
-- Anonymous visitors never touch this table; their progress stays in their
-- own browser. Each signed-in user can only ever see their own row.
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code        text,
  ticked      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "own progress read"   on public.progress;
drop policy if exists "own progress write"  on public.progress;
drop policy if exists "own progress update" on public.progress;

create policy "own progress read"   on public.progress for select using (auth.uid() = user_id);
create policy "own progress write"  on public.progress for insert with check (auth.uid() = user_id);
create policy "own progress update" on public.progress for update using (auth.uid() = user_id)
                                                              with check (auth.uid() = user_id);
