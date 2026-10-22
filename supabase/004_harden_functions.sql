-- Applied to the live database 2026-10-21 as migration
-- "harden_function_grants_and_search_path", after the Supabase security advisor.
--
-- 1. sites_touch() is a TRIGGER function (returns trigger, one trigger on
--    public.sites). It had a mutable search_path - the gap every other function
--    here already closes - and EXECUTE for anon and authenticated, which is
--    meaningless for a trigger function and is just surface area.
--
-- 2. section_use() is SECURITY DEFINER and had EXECUTE for authenticated, so a
--    signed-in visitor could call it over /rest/v1/rpc/. Every other reporting RPC
--    grants nothing to the API roles and is reached only by api/impact.js with the
--    service role. This makes section_use consistent with the rest.
--
-- NOT changed, deliberately: events, qr_codes and sites have RLS enabled with no
-- policies. The advisor reports that at INFO level, but it is the intended design -
-- no policy means the anon key can read and write nothing, and every access goes
-- through a server-side route holding the service role. Adding policies to silence
-- the lint would weaken the site.

alter function public.sites_touch() set search_path = '';

revoke execute on function public.sites_touch() from anon, authenticated, public;
revoke execute on function public.section_use() from anon, authenticated, public;
