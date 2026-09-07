-- 002_security.sql — run this after schema.sql, in Supabase → SQL Editor.
-- Resolves two Supabase security-linter findings. Safe to run more than once.
--
-- Background: /api/stats calls impact_stats() with the service_role key from
-- the Vercel function, so the public roles never needed EXECUTE on it. The
-- grant in the original schema was unnecessary and is removed here.

revoke execute on function public.impact_stats() from anon;
revoke execute on function public.impact_stats() from authenticated;
revoke execute on function public.impact_stats() from public;

-- Belt and braces: the events table should be unreachable by the public roles
-- by every route, not just via row level security.
revoke all on public.events from anon;
revoke all on public.events from authenticated;

-- A note for anyone reading the linter later:
--
-- "RLS Enabled No Policy" on public.events is INTENTIONAL and is the strongest
-- setting available. RLS on with zero policies means the anon and authenticated
-- roles can neither read nor write a single row. Every write arrives through
-- the Vercel serverless function using the service_role key, which bypasses RLS
-- by design. Adding a policy here would WEAKEN the table, not strengthen it.
--
-- Do not "fix" that warning by adding a policy.

comment on table public.events is
  'Anonymous usage events. RLS is deliberately enabled with NO policies: anon and authenticated can do nothing. Writes come only from the Vercel /api/track function using the service_role key. Adding a policy would weaken this.';

comment on function public.impact_stats() is
  'Aggregate counters for the site''s live impact figures. SECURITY DEFINER so it can read events while events itself stays unreadable. EXECUTE is revoked from anon and authenticated: only the service_role key, used by the Vercel /api/stats function, calls it.';
