/**
 * POST /api/me — who is signed in, and what they have already done.
 *
 * Called once per page by js/account.js when someone is signed in. It does
 * three things, all on the server:
 *
 *  1. Verifies the caller's Supabase access token by asking Supabase who it
 *     belongs to. The token is never decoded and trusted locally, and nothing
 *     the browser says about its own identity is used.
 *  2. Links this browser's earlier ANONYMOUS survey answers to the account
 *     (approved: a person who answered on a phone and signs in later still
 *     forms a before/after pair). Only rows with no account yet are touched,
 *     so an answer already belonging to one account can never be moved to
 *     another. The visitor id is random per browser and not guessable, which
 *     is what stops someone claiming a stranger's answers.
 *  3. Reports whether the account is a coordinator (ADMIN_EMAILS) and which
 *     halves of the survey it has already answered, so the survey does not
 *     ask the first half again on a second device.
 *
 * Returns nothing that is not the caller's own.
 */
const VISITOR_RE = /^[a-z0-9]{1,40}$/;

async function verifyUser(token, url, anon) {
  const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id, email: String(u.email || '').toLowerCase() } : null;
}

function allowList() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ ok: false, error: 'not configured' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'sign in first' });

  let user;
  try {
    user = await verifyUser(token, SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('[me] token check failed:', err.message);
    return res.status(502).json({ ok: false, error: 'could not verify sign-in' });
  }
  if (!user) return res.status(401).json({ ok: false, error: 'sign in again' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/events';
  const svc = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  };

  // 2. link this browser's anonymous answers
  let linked = 0;
  const visitor = typeof body.visitor === 'string' ? body.visitor : '';
  if (VISITOR_RE.test(visitor)) {
    try {
      const r = await fetch(
        base + '?visitor=eq.' + encodeURIComponent(visitor) + '&account=is.null&event=eq.prep_check',
        { method: 'PATCH', headers: { ...svc, Prefer: 'return=representation' },
          body: JSON.stringify({ account: user.id }) });
      if (r.ok) linked = (await r.json()).length;
      else console.error('[me] link failed: HTTP ' + r.status);
    } catch (err) {
      // Linking is a bonus. Failing it must not stop someone signing in.
      console.error('[me] link failed:', err.message);
    }
  }

  // 3. which survey halves this account has answered
  const survey = { baseline: false, followup: false };
  try {
    const r = await fetch(
      base + '?select=prep_phase&event=eq.prep_check&account=eq.' + encodeURIComponent(user.id),
      { headers: svc });
    if (r.ok) {
      for (const row of await r.json()) {
        if (row.prep_phase === 'baseline') survey.baseline = true;
        if (row.prep_phase === 'followup') survey.followup = true;
      }
    }
  } catch (err) {
    console.error('[me] survey status failed:', err.message);
  }

  return res.status(200).json({
    ok: true,
    email: user.email,
    is_coordinator: allowList().includes(user.email),
    survey,
    linked
  });
}
