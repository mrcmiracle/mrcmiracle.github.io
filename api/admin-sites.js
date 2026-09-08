/**
 * Admin write endpoint for cleaner air sites.
 *
 * GET    — every site, active or not, for the admin list.
 * POST   — create or update one site.
 * DELETE — remove one site by id.
 *
 * SECURITY, in the order it is enforced. Every one of these runs on the server;
 * none of it can be talked out of by the browser:
 *
 *  1. The caller must present a Supabase access token. It is verified by asking
 *     Supabase who it belongs to — the token is never decoded and trusted here.
 *  2. That verified email must appear in the ADMIN_EMAILS environment variable.
 *     The browser's claim about who it is is ignored entirely; only the address
 *     Supabase returns is used.
 *  3. Only known columns are written, so a caller cannot invent fields, and
 *     activated_at is left to the database trigger.
 *
 * If ADMIN_EMAILS is unset the endpoint refuses everything. That is deliberate:
 * an unconfigured allow-list must fail closed, never open.
 *
 * public.sites has row level security on with no policies, so this route is the
 * only way in, and it holds the service_role key that Vercel keeps server-side.
 */

// Columns a coordinator may set. `id` is handled separately as the key.
const WRITABLE = [
  'name', 'kind', 'city', 'county', 'address', 'zip', 'lat', 'lon', 'phone',
  'hours', 'hours_es', 'transit', 'transit_es', 'pets', 'access',
  'access_notes', 'access_notes_es', 'active', 'note'
];

const PETS = new Set(['yes', 'no', 'service_only', 'unknown']);

function allowList() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/* Ask Supabase who this token belongs to. A forged or expired token fails here,
   which is why the token is never decoded locally. */
async function whoIs(token, url, anon) {
  const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.email ? String(u.email).toLowerCase() : null;
}

function clean(body) {
  const row = {};
  for (const k of WRITABLE) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
    let v = body[k];
    if (k === 'lat' || k === 'lon') {
      v = Number(v);
      if (!Number.isFinite(v)) return { error: k + ' must be a number' };
    } else if (k === 'active') {
      v = v === true || v === 'true';
    } else if (k === 'access') {
      if (!Array.isArray(v)) v = [];
    } else if (k === 'pets') {
      v = PETS.has(v) ? v : 'unknown';
    } else {
      v = String(v == null ? '' : v).slice(0, 500);
    }
    row[k] = v;
  }
  return { row };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ ok: false, error: 'not configured' });
  }

  const emails = allowList();
  if (!emails.length) {
    // Fail closed: no allow-list means nobody is an admin.
    return res.status(503).json({ ok: false, error: 'ADMIN_EMAILS is not set, so no one can edit sites' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'sign in first' });

  let email;
  try {
    email = await whoIs(token, SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('[admin-sites] token check failed:', err.message);
    return res.status(502).json({ ok: false, error: 'could not verify sign-in' });
  }
  if (!email) return res.status(401).json({ ok: false, error: 'sign in again' });
  if (!emails.includes(email)) {
    console.warn('[admin-sites] refused ' + email);
    return res.status(403).json({ ok: false, error: 'this account is not a site coordinator' });
  }

  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/sites';
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(base + '?select=*&order=active.desc,name.asc', { headers });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'upstream ' + r.status });
      return res.status(200).json({ ok: true, sites: await r.json(), you: email });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'DELETE') {
      const id = String(body.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
      const r = await fetch(base + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'upstream ' + r.status });
      console.log('[admin-sites] ' + email + ' deleted ' + id);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      const id = String(body.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
      const { row, error } = clean(body);
      if (error) return res.status(400).json({ ok: false, error });
      if (!row.name) return res.status(400).json({ ok: false, error: 'name is required' });
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) {
        return res.status(400).json({ ok: false, error: 'lat and lon are required' });
      }
      row.id = id;
      const r = await fetch(base + '?on_conflict=id', {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      if (!r.ok) {
        const t = (await r.text()).slice(0, 200);
        console.error('[admin-sites] upstream ' + r.status + ' ' + t);
        return res.status(502).json({ ok: false, error: 'upstream ' + r.status });
      }
      console.log('[admin-sites] ' + email + ' saved ' + id + ' active=' + row.active);
      return res.status(200).json({ ok: true, site: (await r.json())[0] || null });
    }

    return res.status(405).json({ ok: false, error: 'GET, POST or DELETE' });
  } catch (err) {
    console.error('[admin-sites] ' + err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
