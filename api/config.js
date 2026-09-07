/**
 * GET /api/config — the public front-end configuration.
 *
 * Returns only the Supabase project URL and the **anon** key. The anon key is
 * designed to be public: it is what every Supabase browser app ships, and on
 * its own it can do nothing here, because the events table has row level
 * security on with no policies and the progress table restricts every row to
 * its own signed-in user.
 *
 * The service_role key is NEVER returned by this endpoint.
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const url = process.env.SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    return res.status(200).json({ ok: false, reason: 'sign-in not configured' });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ ok: true, url, anonKey: anon });
}
