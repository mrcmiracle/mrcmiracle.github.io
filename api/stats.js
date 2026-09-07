/**
 * GET /api/stats — aggregate impact numbers for the live counter.
 *
 * Returns totals only, never rows. Reads through the impact_stats() function
 * in Supabase, which is security-definer so the events table itself stays
 * unreadable to the public.
 *
 * Cached at the edge so a burst of visitors does not hit the database.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  try {
    const r = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/impact_stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
      },
      body: '{}'
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 200);
      console.error('[stats] supabase HTTP ' + r.status + ' ' + body);
      return res.status(502).json({ ok: false, error: 'upstream ' + r.status });
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    console.error('[stats] ' + err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
}
