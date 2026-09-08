/**
 * GET /api/sites — cleaner air sites Unit 503 has activated for a smoke event.
 *
 * Washington publishes no fixed list of cleaner air sites; local health
 * jurisdictions activate them per event. data/clean-air-sites.json holds the
 * 344 real IMLS libraries as the year-round baseline, and this endpoint carries
 * whatever is switched on right now. The page merges the two, activated first.
 *
 * Read with service_role because public.sites has row level security on with no
 * policies, exactly like public.events — the browser never touches the table.
 * Only rows with active = true are returned, and only the fields the card
 * renders; the internal note column is never exposed.
 *
 * Cached only briefly at the edge. This is the fastest-moving data on the site:
 * when a coordinator withdraws a site, people must stop being sent there
 * quickly, so the window is deliberately short. 30 seconds still absorbs a rush
 * of visitors arriving from a poster QR code at once, while a withdrawal
 * propagates in about a minute at worst.
 */
const FIELDS = [
  'id', 'name', 'kind', 'city', 'county', 'address', 'zip', 'lat', 'lon', 'phone',
  'hours', 'hours_es', 'transit', 'transit_es', 'pets', 'access',
  'access_notes', 'access_notes_es', 'activated_at'
].join(',');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Not an error: the site works from the JSON baseline alone.
    return res.status(200).json({ ok: true, sites: [], reason: 'not configured' });
  }

  try {
    const url = SUPABASE_URL.replace(/\/$/, '') +
      '/rest/v1/sites?select=' + FIELDS + '&active=eq.true&order=activated_at.desc';
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
      }
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 200);
      console.error('[sites] supabase HTTP ' + r.status + ' ' + body);
      return res.status(502).json({ ok: false, error: 'upstream ' + r.status });
    }
    const rows = await r.json();
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({ ok: true, sites: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    console.error('[sites] ' + err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
}
