/**
 * GET /q/<slug> — what a printed QR code points at.
 *
 * vercel.json rewrites /q/<slug> to /api/q?slug=<slug>. This:
 *
 *  1. Looks the code up. An unknown or deactivated code still redirects to the
 *     home page - a poster that outlived its code must never show an error.
 *  2. Reads, or creates, the first-party `mrcm_vid` cookie: a random browser
 *     id, the same value js/track.js keeps in localStorage. It is what lets a
 *     repeat scan from the same browser be recognised at the moment of the
 *     scan, before any page has loaded (approved). Random, readable only by
 *     this site, derived from nothing about the person or device.
 *  3. Records one `qr_scan` event server-side. This counts every scan, even
 *     when the page is then blocked, fails to load, or is closed at once.
 *     Same retry-with-idempotency-key as api/track.js: the REST gateway can
 *     504 on the first write after a quiet spell and that write is lost.
 *  4. Redirects to the code's destination with ?src=<slug>, so every later
 *     action on the site is attributed to this poster.
 *
 * NOT recorded, deliberately: IP address, user agent, location. The request
 * carries all three; none of them is read or stored here.
 *
 * The redirect is never held hostage to the database: the write gets at most
 * WRITE_BUDGET_MS, and the person is sent on regardless. If the write does not
 * land in time, the page_view the destination sends still carries ?src.
 */
import { randomBytes, randomUUID } from 'node:crypto';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const VID_RE = /^[a-z0-9]{6,40}$/;
const WRITE_BUDGET_MS = 2500;
const ONE_YEAR = 60 * 60 * 24 * 365;

function newVisitorId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

function withSrc(destination, slug) {
  const [pathAndQuery, hash] = destination.split('#');
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  return pathAndQuery + sep + 'src=' + encodeURIComponent(slug) + (hash ? '#' + hash : '');
}

export default async function handler(req, res) {
  // Every scan must reach this function; a cached redirect would count nothing.
  res.setHeader('Cache-Control', 'no-store');

  const slug = String((req.query && req.query.slug) || '').toLowerCase();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  let visitor = readCookie(req, 'mrcm_vid');
  if (!VID_RE.test(visitor)) visitor = newVisitorId();
  res.setHeader('Set-Cookie',
    `mrcm_vid=${visitor}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`);

  if (!SLUG_RE.test(slug) || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }

  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  };
  const deadline = Date.now() + WRITE_BUDGET_MS;
  const timeLeft = () => Math.max(0, deadline - Date.now());

  // 1. look the code up
  let destination = '/';
  let known = false;
  try {
    const ctl = AbortSignal.timeout(Math.min(1200, timeLeft()));
    const r = await fetch(base + '/qr_codes?select=destination,active&slug=eq.' + encodeURIComponent(slug),
      { headers, signal: ctl });
    if (r.ok) {
      const rows = await r.json();
      if (rows.length && rows[0].active) { destination = rows[0].destination || '/'; known = true; }
    }
  } catch (err) {
    console.warn('[q] lookup failed for ' + slug + ': ' + err.name);
  }

  // 3. record the scan (known, active codes only - an unknown slug is noise)
  if (known) {
    const body = JSON.stringify({
      event: 'qr_scan', src: slug, visitor, page: 'qr',
      ts: new Date().toISOString(), event_uid: randomUUID()
    });
    const DELAYS = [0, 300, 700];
    for (let i = 0; i < DELAYS.length && timeLeft() > 150; i++) {
      if (DELAYS[i]) await new Promise((r) => setTimeout(r, Math.min(DELAYS[i], timeLeft())));
      try {
        const r = await fetch(base + '/events?on_conflict=event_uid', {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body,
          signal: AbortSignal.timeout(Math.max(100, timeLeft()))
        });
        if (r.ok) break;
        if (r.status < 500) { console.error('[q] scan rejected: HTTP ' + r.status); break; }
        console.warn('[q] scan write HTTP ' + r.status + ', attempt ' + (i + 1));
      } catch (err) {
        console.warn('[q] scan write ' + err.name + ', attempt ' + (i + 1));
      }
    }
  }

  // 4. send them on. Only a REAL code attributes the visit: an unknown slug
  //    goes home with no ?src, or the made-up label would be remembered by the
  //    browser and stamped on everything that person did afterwards.
  res.setHeader('Location', known ? withSrc(destination, slug) : '/');
  return res.status(302).end();
}
