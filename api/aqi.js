/**
 * GET /api/aqi — current air quality for every Washington reporting area.
 *
 * Source: AirNow's public reporting-area file, which needs no API key:
 *   https://files.airnowtech.org/airnow/today/reportingarea.dat
 * For King County that data comes from the Puget Sound Clean Air Agency, the
 * actual regional authority, via EPA AirNow.
 *
 * The upstream file is ~1.7MB and the server does not gzip it, so this
 * endpoint parses it down to ~9KB of JSON and caches hard. The browser then
 * picks the nearest area itself using the zip centroids it already has, which
 * means one cache entry serves every visitor regardless of location.
 */

const SOURCE = 'https://files.airnowtech.org/airnow/today/reportingarea.dat';
const STATE = 'WA';
const MEM_TTL_MS = 15 * 60 * 1000;

// Warm invocations reuse this instead of re-downloading 1.7MB.
let cache = { at: 0, payload: null };

function parse(text) {
  const byArea = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const f = line.split('|');
    if (f.length < 17) continue;
    if (f[8] !== STATE) continue;
    if (f[6] !== 'Y') continue;              // primary reporting parameter only
    if (parseInt(f[4], 10) !== 0) continue;  // today
    const aqi = parseInt(f[12], 10);
    if (!Number.isFinite(aqi)) continue;
    const lat = parseFloat(f[9]);
    const lon = parseFloat(f[10]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const rec = {
      name: f[7], lat, lon, param: f[11], aqi,
      cat: f[13], action: f[14] === 'Yes',
      agency: f[16], type: f[5], time: f[2], tz: f[3], date: f[1]
    };
    // Prefer an actual observation over a forecast for the same area.
    const prev = byArea.get(rec.name);
    if (!prev || (prev.type !== 'O' && rec.type === 'O')) byArea.set(rec.name, rec);
  }
  return [...byArea.values()];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  if (cache.payload && Date.now() - cache.at < MEM_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ ...cache.payload, cached: true });
  }

  try {
    const upstream = await fetch(SOURCE, {
      headers: { 'User-Agent': 'MRC-Miracle/1.0 (+https://mrcmiracle.vercel.app)' }
    });
    if (!upstream.ok) throw new Error('AirNow HTTP ' + upstream.status);

    const areas = parse(await upstream.text());
    if (!areas.length) throw new Error('no Washington rows in the feed');

    const payload = {
      ok: true,
      source: 'AirNow (EPA)',
      fetched: new Date().toISOString(),
      areas
    };
    cache = { at: Date.now(), payload };

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[aqi] ' + err.message);
    // Serve stale rather than nothing: old air quality beats a blank panel.
    if (cache.payload) {
      res.setHeader('Cache-Control', 'public, s-maxage=120');
      return res.status(200).json({ ...cache.payload, stale: true });
    }
    return res.status(503).json({ ok: false, error: err.message });
  }
}
