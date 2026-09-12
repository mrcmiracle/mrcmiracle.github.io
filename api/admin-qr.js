/**
 * Coordinator-only QR code management.
 *
 * GET    every code, with its live report (scans, different browsers, what
 *        people did next, when scans happen, device mix)
 * POST   { label, category, destination? }  create a code; slug derived from label
 * PATCH  { slug, active }                   switch a code on or off
 *
 * Same security as api/admin-sites.js, in the same order, all server-side:
 *  1. The caller's Supabase access token is verified by asking Supabase who it
 *     belongs to. It is never decoded and trusted here.
 *  2. That verified email must be in ADMIN_EMAILS. If ADMIN_EMAILS is unset,
 *     everything is refused - an unconfigured allow-list fails closed.
 *  3. Only known fields are written, and each is validated.
 *
 * Codes are never deleted, only deactivated. A printed poster may still be on
 * a wall, and its scans are part of the project's record.
 */
const CATEGORIES = new Set(['library', 'school', 'event', 'other']);
const DEST_RE = /^\/[A-Za-z0-9/._#-]*$/;

function allowList() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function whoIs(token, url, anon) {
  const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.email ? String(u.email).toLowerCase() : null;
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // é -> e
    .replace(/@/g, ' at ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function readJson(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b && typeof b === 'object' ? b : {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ ok: false, error: 'not configured' });
  }
  const emails = allowList();
  if (!emails.length) {
    return res.status(503).json({ ok: false, error: 'ADMIN_EMAILS is not set, so no one can manage QR codes' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'sign in first' });

  let email;
  try {
    email = await whoIs(token, SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('[admin-qr] token check failed:', err.message);
    return res.status(502).json({ ok: false, error: 'could not verify sign-in' });
  }
  if (!email) return res.status(401).json({ ok: false, error: 'sign in again' });
  if (!emails.includes(email)) {
    console.warn('[admin-qr] refused ' + email);
    return res.status(403).json({ ok: false, error: 'this account is not a coordinator' });
  }

  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(base + '/rpc/qr_report', { method: 'POST', headers, body: '{}' });
      if (!r.ok) throw new Error('qr_report HTTP ' + r.status);
      return res.status(200).json({ ok: true, report: await r.json() });
    }

    if (req.method === 'POST') {
      const b = readJson(req);
      const label = String(b.label || '').trim().slice(0, 120);
      if (!label) return res.status(400).json({ ok: false, error: 'give the location a name' });
      const category = CATEGORIES.has(b.category) ? b.category : 'other';
      const destination = typeof b.destination === 'string' && DEST_RE.test(b.destination) ? b.destination : '/';
      const root = slugify(label);
      if (root.length < 2) return res.status(400).json({ ok: false, error: 'that name has too few letters or numbers' });

      // A clash gets a numeric suffix rather than an error: two events can
      // reasonably share a name ("Health fair") and each needs its own code.
      for (let n = 1; n <= 20; n++) {
        const slug = n === 1 ? root : (root.slice(0, 40 - String(n).length - 1) + '-' + n);
        const r = await fetch(base + '/qr_codes', {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({ slug, label, category, destination, created_by: email })
        });
        if (r.ok) return res.status(201).json({ ok: true, code: (await r.json())[0] });
        if (r.status !== 409) {
          const detail = (await r.text()).slice(0, 200);
          // 23505 (unique violation) can also surface as 400 from PostgREST.
          if (!/23505|duplicate key/.test(detail)) throw new Error('create HTTP ' + r.status + ' ' + detail);
        }
      }
      return res.status(409).json({ ok: false, error: 'too many codes with that name' });
    }

    if (req.method === 'PATCH') {
      const b = readJson(req);
      const slug = String(b.slug || '');
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)) return res.status(400).json({ ok: false, error: 'bad code' });
      const r = await fetch(base + '/qr_codes?slug=eq.' + encodeURIComponent(slug), {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ active: b.active === true })
      });
      if (!r.ok) throw new Error('update HTTP ' + r.status);
      const rows = await r.json();
      if (!rows.length) return res.status(404).json({ ok: false, error: 'no such code' });
      return res.status(200).json({ ok: true, code: rows[0] });
    }

    return res.status(405).json({ ok: false, error: 'GET, POST or PATCH' });
  } catch (err) {
    console.error('[admin-qr] ' + err.message);
    return res.status(502).json({ ok: false, error: 'database error' });
  }
}
