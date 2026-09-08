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
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const url = process.env.SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    return res.status(200).json({ ok: false, reason: 'sign-in not configured' });
  }

  /* A present-but-unusable key is worse than a missing one: sign-in fails at the
     browser with an opaque "Invalid API key" while this endpoint reports ok.
     The common cause is pasting the value the Supabase dashboard *displays*,
     which masks everything after the first few characters with U+2022 bullets.
     Check the shape here so the failure is legible from one curl. */
  const looksLegacyJwt = anon.split('.').length === 3;
  const looksPublishable = anon.startsWith('sb_publishable_');
  if (!looksLegacyJwt && !looksPublishable) {
    const bullets = (anon.match(/\u2022/g) || []).length;
    const masked = bullets > 0 || anon.includes('*');
    /* Report the shape of what is actually stored so the value can be checked
       without guessing. Safe to show: this key is public by design, and a value
       that fails these checks is not a working key anyway. */
    return res.status(200).json({
      ok: false,
      reason: masked
        ? 'SUPABASE_ANON_KEY looks masked - it holds the characters the dashboard displays, not the key. Reveal the key before copying it.'
        : 'SUPABASE_ANON_KEY is not a recognisable Supabase key (expected a JWT with two dots, or an sb_publishable_ key).',
      observed: {
        length: anon.length,
        startsWith: anon.slice(0, 8),
        bulletChars: bullets,
        dots: anon.split('.').length - 1,
        expected: 'a JWT about 208 characters long with exactly 2 dots and 0 bullets'
      }
    });
  }
  if (anon.startsWith('sb_secret_') || anon.includes('service_role')) {
    // Never hand a service_role key to the browser: it bypasses row level security.
    return res.status(200).json({ ok: false, reason: 'SUPABASE_ANON_KEY holds a secret key. Replace it with the anon or publishable key.' });
  }
  /* Which providers are actually switched on. Asked here, server-side and
     cached for an hour, so the browser learns it from the config call it
     already makes rather than paying for a second request. The sign-in UI
     renders a button per enabled provider, so turning Apple on in the Supabase
     dashboard makes its button appear with no code change and no dead button
     while it is off. */
  let providers = ['google'];
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/settings', {
      headers: { apikey: anon }
    });
    if (r.ok) {
      const ext = (await r.json()).external || {};
      const found = Object.keys(ext).filter((k) => ext[k] && k !== 'email' && k !== 'phone' && k !== 'anonymous_users');
      if (found.length) providers = found;
    }
  } catch (err) {
    // Never fail the whole config over this; fall back to the known provider.
    console.warn('[config] provider list unavailable:', err.message);
  }

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ ok: true, url, anonKey: anon, providers });
}
