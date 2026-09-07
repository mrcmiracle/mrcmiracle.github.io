/**
 * POST /api/track — the site's only data endpoint.
 *
 * The page sends one event here. This function writes it to Supabase and
 * mirrors it to the Google Sheet. Both credentials stay server-side, so
 * nothing sensitive appears in the page source.
 *
 * Environment variables (set these in Vercel → Settings → Environment Variables):
 *   SUPABASE_URL               https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  the service_role key (NEVER put this in the page)
 *   SHEETS_WEBHOOK_URL         the Apps Script /exec URL   (optional mirror)
 *
 * No npm dependencies: it talks to Supabase over its REST API with fetch, so
 * the project still has no build step and no node_modules.
 */

// Only these event names are accepted. An unknown name is rejected rather than
// stored, so a stranger cannot invent columns or flood the table with junk types.
const ALLOWED_EVENTS = new Set([
  'page_view', 'page_exit', 'section_open',
  'rightnow_open', 'rightnow_close',
  'kit_complete', 'checklist_print', 'checklist_share',
  'code_generated', 'code_restore', 'code_restore_failed',
  'plan_selected', 'plan_skipped',
  'cleanair_lookup', 'directions_click', 'map_open',
  'lang_switch', 'outbound_click',
  'progress_restored', 'progress_cleared',
  'aqi_lookup'
]);

// Every column the events table has. Anything else the page sends is preserved
// as JSON in `extra` rather than dropped.
const COLUMNS = [
  'ts', 'event', 'page', 'lang', 'visitor', 'session', 'site_version',
  'returning', 'visit_number', 'new_session',
  'people', 'pets', 'meds', 'housing', 'water_gallons', 'item_count', 'source',
  'zip', 'city', 'results', 'nearest_mi', 'method', 'site',
  'code', 'via', 'selections', 'selection_count', 'offered_count',
  'section', 'mode', 'seconds', 'scroll_pct', 'to', 'done', 'total'
];
const INT_COLS = new Set([
  'returning', 'visit_number', 'new_session', 'people', 'pets', 'meds',
  'water_gallons', 'item_count', 'results', 'selection_count', 'offered_count',
  'seconds', 'scroll_pct', 'done', 'total'
]);

// The page sends `returning`, but that is a reserved word in Postgres and
// cannot be a column name unquoted. Map it on the way into the database.
const RENAME = { returning: 'is_returning' };

const MAX_BODY = 8 * 1024;   // an event is a few hundred bytes; this is generous
const MAX_STR = 512;

function clampStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > MAX_STR ? s.slice(0, MAX_STR) : s;
}

function toInt(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function readBody(req) {
  // The page posts text/plain to avoid a CORS preflight, so the body may
  // arrive unparsed. Handle both shapes.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let data;
  try {
    data = await readBody(req);
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'bad body: ' + err.message });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ ok: false, error: 'body must be an object' });
  }
  if (!ALLOWED_EVENTS.has(data.event)) {
    return res.status(400).json({ ok: false, error: 'unknown event' });
  }

  // Build the row. Only known columns; everything else goes to `extra`.
  const row = {};
  for (const c of COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(data, c)) continue;
    const col = RENAME[c] || c;
    row[col] = INT_COLS.has(c) ? toInt(data[c]) : clampStr(data[c]);
  }
  if (data.nearest_mi !== undefined && data.nearest_mi !== '') {
    const f = parseFloat(data.nearest_mi);
    row.nearest_mi = Number.isFinite(f) ? f : null;
  }
  const extra = {};
  for (const k of Object.keys(data)) {
    if (!COLUMNS.includes(k) && k !== 'nearest_mi') extra[k] = data[k];
  }
  if (Object.keys(extra).length) row.extra = extra;

  // Deliberately NOT stored: no IP address, no user agent, no geolocation.
  // The site's privacy notice promises this, so do not add them here.

  const results = { supabase: 'skipped', sheets: 'skipped' };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHEETS_WEBHOOK_URL } = process.env;

  const jobs = [];

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    jobs.push(
      fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(row)
      }).then(async (r) => {
        results.supabase = r.ok ? 'ok' : 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200);
      }).catch((e) => { results.supabase = 'error: ' + e.message; })
    );
  }

  if (SHEETS_WEBHOOK_URL) {
    jobs.push(
      fetch(SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(data)
      }).then((r) => { results.sheets = r.ok ? 'ok' : 'HTTP ' + r.status; })
        .catch((e) => { results.sheets = 'error: ' + e.message; })
    );
  }

  await Promise.all(jobs);

  // The mirror failing must never lose the primary write, and neither failing
  // should ever break the page. Report status, log the detail.
  if (results.supabase !== 'ok' && results.supabase !== 'skipped') {
    console.error('[track] supabase write failed:', results.supabase);
  }
  if (results.sheets !== 'ok' && results.sheets !== 'skipped') {
    console.warn('[track] sheets mirror failed:', results.sheets);
  }

  const primaryOk = results.supabase === 'ok' || (results.supabase === 'skipped' && results.sheets === 'ok');
  return res.status(primaryOk ? 200 : 502).json({ ok: primaryOk, ...results });
}
