/**
 * GET /api/air?lat=..&lon=.. — current air quality for one point, from
 * Google's Air Quality API.
 *
 * WHY THIS IS SEPARATE FROM /api/aqi
 * /api/aqi serves every Washington reporting area from EPA AirNow in one
 * cached payload: free, no key, and for King County it carries the Puget Sound
 * Clean Air Agency's own numbers - the regional authority. That stays the
 * primary source and the fallback. This endpoint adds what AirNow's summary
 * file does not have for a specific address: the pollutant breakdown and
 * Google's health guidance for the exact point someone searched.
 *
 * WHY IT IS SERVER-SIDE
 * The key is a billed credential and must never reach a browser. Just as
 * important, calling Google from the page would hand every visitor's IP and
 * their searched location to Google. This way Google sees this server asking
 * about a coordinate, and nothing about who asked. That keeps the promise on
 * /privacy.html intact.
 *
 * COST CONTROL
 * Coordinates are snapped to a ~5km grid and cached, so a hundred people
 * searching the same town is one billed call, not a hundred. Without the snap,
 * two people on opposite sides of a street would each cost a call.
 */

const ENDPOINT = 'https://airquality.googleapis.com/v1/currentConditions:lookup';
const MEM_TTL_MS = 10 * 60 * 1000;
const GRID = 0.05;                     // ~5.5km of latitude
const MAX_ENTRIES = 200;               // a warm instance holds no more than this

const cache = new Map();               // "lat,lon" -> { at, payload }

function snap(n) {
  return Math.round(n / GRID) * GRID;
}

function remember(key, payload) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), payload });
}

/* Google returns a list of indexes: its own "universal" AQI and, where it has
   one, the local official index - in the US, the EPA AQI. Only the EPA one is
   used. The universal index is deliberately DROPPED rather than used as a
   fallback: it is scored in the opposite direction, so passing it through
   under the same name would publish "81 - excellent" on a page where 81 means
   unhealthy for sensitive groups. Anything returned carries the scale it is
   on, so nothing downstream can mix them by accident. */
function pickIndex(indexes) {
  const list = Array.isArray(indexes) ? indexes : [];
  const epa = list.find((i) => i.code === 'usa_epa');
  return epa || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const key = process.env.GOOGLE_AQ_KEY;
  if (!key) {
    // Not an error: the site works without this. Say so plainly so a missing
    // key is never mistaken for a broken endpoint.
    return res.status(200).json({ ok: false, reason: 'not configured', configured: false });
  }

  const lat = parseFloat(req.query && req.query.lat);
  const lon = parseFloat(req.query && req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ ok: false, error: 'lat and lon required' });
  }

  const gLat = snap(lat);
  const gLon = snap(lon);
  const cacheKey = gLat.toFixed(2) + ',' + gLon.toFixed(2);

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < MEM_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ ...hit.payload, cached: true });
  }

  try {
    const upstream = await fetch(ENDPOINT + '?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: gLat, longitude: gLon },
        /* LOCAL_AQI is what makes Google return the US EPA index alongside its
           own. Without it the only index in the reply is Google's "universal"
           AQI, which runs the OTHER WAY - 100 is clean air there, while 100 on
           the EPA scale is unhealthy for sensitive groups. Every other number
           on this site, and every message King County puts out, is EPA. Two
           scales that look identical and mean opposite things must never reach
           the same page. */
        extraComputations: ['LOCAL_AQI', 'HEALTH_RECOMMENDATIONS', 'POLLUTANT_CONCENTRATION', 'DOMINANT_POLLUTANT_CONCENTRATION'],
        languageCode: 'en'
      }),
      signal: AbortSignal.timeout(8000)
    });

    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      /* Google's own message is the useful part when a key is wrong, an API is
         not enabled, or billing is off - the three things that actually go
         wrong here. Pass it through rather than flattening it to "error". */
      const detail = (body && body.error && body.error.message) || ('HTTP ' + upstream.status);
      console.error('[air] Google Air Quality refused: ' + detail);
      return res.status(502).json({ ok: false, error: 'air quality unavailable', detail, configured: true });
    }

    const index = pickIndex(body.indexes);
    const payload = {
      ok: true,
      source: 'Google Air Quality API',
      at: body.dateTime || new Date().toISOString(),
      point: { lat: gLat, lon: gLon },
      // Null rather than a number on an unknown scale, when no EPA index came back.
      scale: index ? 'usa_epa' : null,
      aqi: index ? index.aqi : null,
      category: index ? index.category : null,
      dominant: (index && index.dominantPollutant) ||
                (body.pollutants && body.pollutants.length ? body.pollutants[0].code : null),
      pollutants: (body.pollutants || []).map((p) => ({
        code: p.code,
        name: p.displayName,
        value: p.concentration && p.concentration.value,
        units: p.concentration && p.concentration.units
      })),
      advice: (body.healthRecommendations && body.healthRecommendations.generalPopulation) || null
    };

    remember(cacheKey, payload);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[air] ' + err.name + ': ' + err.message);
    return res.status(502).json({ ok: false, error: 'air quality unavailable', configured: true });
  }
}
