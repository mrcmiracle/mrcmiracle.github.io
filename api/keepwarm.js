/**
 * GET /api/keepwarm — stops the Supabase project being auto-paused.
 *
 * The database sits on Supabase's free plan, which pauses a project after a
 * stretch with no activity. When that happened on 2026-10-11 the site stayed
 * up - pages, the wound tool and air quality do not touch Supabase - but
 * everything that records anything stopped: /api/impact returned 502, sign-in
 * failed, and api/q.js could no longer look a poster code up, so it dropped
 * ?src and the scan went uncounted. Printed posters kept sending people to the
 * site and nothing remembered that they came. That is the failure this
 * prevents: silent loss of the very data the project exists to collect.
 *
 * vercel.json runs this once a day. One cheap read is enough to count as
 * activity; nothing is written, because the events table is the project's
 * record and must not carry rows that no human caused.
 *
 * Deliberate choices:
 *  - The ANON key, never service_role. This endpoint is reachable by anyone,
 *    so it is given the key that is designed to be public and can do nothing
 *    on its own (events has row level security on with no policies).
 *  - no-store. A response served from Vercel's CDN would never reach Postgres,
 *    and the project would pause anyway while this endpoint looked healthy.
 *  - If CRON_SECRET is set in the project, it is required. Unset, the endpoint
 *    still works, so the protection can be turned on later without a deploy.
 */
export default async function handler(req, res) {
  // Must reach Postgres every time, or it is not keeping anything warm.
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const secret = process.env.CRON_SECRET || '';
  if (secret && req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  const started = Date.now();
  try {
    /* A select that PostgREST has to pass to Postgres. Row level security may
       return nothing, which is fine and expected - the query still ran, and
       running is the whole point. */
    const r = await fetch(url + '/rest/v1/qr_codes?select=slug&limit=1', {
      headers: { apikey: anon, Authorization: 'Bearer ' + anon },
      signal: AbortSignal.timeout(8000)
    });
    const ms = Date.now() - started;

    if (!r.ok) {
      // 5xx here usually means the project is paused or still coming up.
      console.error('[keepwarm] database read HTTP ' + r.status + ' in ' + ms + 'ms');
      return res.status(503).json({ ok: false, error: 'database HTTP ' + r.status, ms });
    }
    console.log('[keepwarm] ok in ' + ms + 'ms');
    return res.status(200).json({ ok: true, ms });
  } catch (err) {
    const ms = Date.now() - started;
    console.error('[keepwarm] ' + err.name + ' after ' + ms + 'ms');
    return res.status(503).json({ ok: false, error: err.name, ms });
  }
}
