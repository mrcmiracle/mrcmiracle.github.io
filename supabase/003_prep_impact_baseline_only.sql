-- prep_impact(): readiness snapshot from the single survey.
--
-- Applied to the live database on 2026-10-18 (migration
-- "prep_impact_baseline_only"). Recorded here because four of the site's five
-- RPCs previously existed only in the live database with no file behind them.
--
-- The later-visit follow-up survey was removed on the same day: it had
-- collected 5 answers against 15 first answers, too few to compare people to
-- themselves. Follow-up rows already in public.events are deliberately LEFT IN
-- PLACE - they are simply no longer read. Nothing deletes them.
--
-- Each readiness item reports its own denominator ("yes" out of "n") because
-- every survey question is optional and the bases genuinely differ.

create or replace function public.prep_impact()
returns json
language sql
stable security definer
set search_path to ''
as $function$
  with answers as (
    select coalesce(account::text, visitor) as who, *
    from public.events
    where event = 'prep_check'
  ),
  first_answer as (
    select distinct on (who) who,
           prep_water w, prep_air a, prep_plan p, prep_firstaid f, prep_confidence c,
           household_size, age_band, hh_older, hh_child, hh_disability, hh_language
    from answers where prep_phase = 'baseline'
    order by who, received_at asc
  ),
  scored as (
    select *, coalesce(w,0)+coalesce(a,0)+coalesce(p,0)+coalesce(f,0) as s
    from first_answer
  )
  select json_build_object(
    'responses', (select count(*) from first_answer),
    'have', json_build_object(
      'water',    json_build_object('yes',(select count(*) from first_answer where w=1),
                                    'n',  (select count(w) from first_answer)),
      'air',      json_build_object('yes',(select count(*) from first_answer where a=1),
                                    'n',  (select count(a) from first_answer)),
      'plan',     json_build_object('yes',(select count(*) from first_answer where p=1),
                                    'n',  (select count(p) from first_answer)),
      'firstaid', json_build_object('yes',(select count(*) from first_answer where f=1),
                                    'n',  (select count(f) from first_answer))),
    'score', json_build_object(
      'n',      (select count(*) from scored),
      'avg',    (select coalesce(avg(s),0)::numeric(4,2) from scored),
      'out_of', 4,
      'none',   (select count(*) from scored where s = 0),
      'all',    (select count(*) from scored where s = 4)),
    'confidence', json_build_object(
      'n',    (select count(c) from first_answer),
      'avg',  (select round(avg(c),2) from first_answer where c is not null),
      'low',  (select count(*) from first_answer where c <= 2),
      'high', (select count(*) from first_answer where c >= 4)),
    'reach',   json_build_object(
                 'respondents',          (select count(*) from first_answer),
                 'household_n',          (select count(household_size) from first_answer),
                 'people_in_households', (select coalesce(sum(household_size),0) from first_answer),
                 'age', (select coalesce(json_object_agg(age_band, n), '{}'::json) from (
                           select age_band, count(*) n from first_answer
                           where age_band is not null group by age_band) x),
                 'older',      (select count(*) from first_answer where hh_older = 1),
                 'child',      (select count(*) from first_answer where hh_child = 1),
                 'disability', (select count(*) from first_answer where hh_disability = 1),
                 'language',   (select count(*) from first_answer where hh_language = 1),
                 'any_vulnerable', (select count(*) from first_answer
                                    where hh_older = 1 or hh_child = 1 or hh_disability = 1
                                       or hh_language = 1 or age_band = '65plus'))
  );
$function$;
