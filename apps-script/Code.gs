/* NOT IN USE as of 2026-09-07.
 *
 * This mirrored anonymous usage into a Google Sheet. It was removed from
 * api/track.js because the deployed web app refused anonymous callers with
 * HTTP 401 on every attempt, across three sessions and two redeploys by the
 * owner. The likely cause is a Google Workspace (school) account whose admin
 * blocks sharing outside the domain, which cannot be overridden from here.
 *
 * Supabase is the store of record and exports CSV directly, which is what the
 * portfolio actually needs, so nothing is lost.
 *
 * To revive it: republish this script from an account that can set
 * "Who has access: Anyone" (northcreek.mrc@gmail.com rather than the school
 * account), confirm with
 *   curl -s -o /dev/null -w '%{http_code}\n' -X POST '<exec-url>' \
 *     -H 'Content-Type: text/plain;charset=UTF-8' -d '{"event":"test"}'
 * returns a literal 200, then restore the mirror block in api/track.js from
 * git history and re-add the Google Sheet line to priv.s7.b in BOTH language
 * files - the privacy policy must describe where data actually goes.
 */

/**
 * MRC Miracle — anonymous event collector.
 *
 * Paste this into a Google Apps Script project bound to a Google Sheet,
 * then Deploy > New deployment > Web app:
 *     Execute as:  Me
 *     Who has access:  Anyone
 * Copy the resulting /exec URL into js/track.js (the ENDPOINT constant).
 * Full click-by-click instructions are in docs/DEPLOY.md step 4.
 *
 * This script writes one row per event. It never receives or stores names,
 * emails, addresses, phone numbers, precise location, or IP addresses.
 */

/**
 * NOTE: this sheet mirrors the RAW event payload, so the column here is
 * `returning`, matching what the page sends. The Supabase column is called
 * `is_returning`, because `returning` is a reserved word in Postgres. That
 * difference is intentional — do not "fix" one to match the other.
 */
var SHEET_NAME = 'events';

/* Fixed columns keep the sheet pivot-friendly. Anything the site sends that is
   not listed here still gets kept, as JSON, in the final "extra" column — so a
   new event type can never silently lose data. */
var COLUMNS = [
  'received_at', 'ts', 'event', 'page', 'lang', 'visitor', 'session', 'site_version',
  'returning', 'visit_number', 'new_session',
  'people', 'pets', 'meds', 'housing', 'water_gallons', 'item_count', 'source',
  'zip', 'city', 'results', 'nearest_mi', 'method', 'site',
  'code', 'via',
  'selections', 'selection_count', 'offered_count',
  'section', 'mode', 'seconds', 'scroll_pct', 'to',
  'done', 'total',
  'extra'
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }
  return sh;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'no body' });
    }

    var data = JSON.parse(e.postData.contents);
    if (typeof data !== 'object' || data === null) {
      return json_({ ok: false, error: 'body was not an object' });
    }

    var sh = getSheet_();
    var used = {};
    var row = COLUMNS.map(function (col) {
      if (col === 'received_at') return new Date();
      if (col === 'extra') return '';
      used[col] = true;
      return Object.prototype.hasOwnProperty.call(data, col) ? data[col] : '';
    });

    // Anything unexpected is preserved rather than dropped.
    var leftovers = {};
    var any = false;
    Object.keys(data).forEach(function (k) {
      if (!used[k] && k !== 'received_at' && k !== 'extra') { leftovers[k] = data[k]; any = true; }
    });
    if (any) row[COLUMNS.length - 1] = JSON.stringify(leftovers);

    // A lock stops two simultaneous visitors writing to the same row.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sh.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    console.error('doPost failed: ' + err);
    return json_({ ok: false, error: String(err) });
  }
}

/* Visiting the /exec URL in a browser should say something useful,
   so you can confirm the deployment worked. */
function doGet() {
  var sh = getSheet_();
  return json_({
    ok: true,
    message: 'MRC Miracle collector is running.',
    rows: Math.max(0, sh.getLastRow() - 1)
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Run this once from the editor to create the sheet and prove it works.
   Select "testWrite" in the function dropdown and press Run. */
function testWrite() {
  var sh = getSheet_();
  var row = COLUMNS.map(function (c) {
    if (c === 'received_at') return new Date();
    if (c === 'event') return 'test_row';
    if (c === 'page') return 'apps-script-test';
    return '';
  });
  sh.appendRow(row);
  Logger.log('Wrote a test row. Delete it before launch. Total rows: ' + (sh.getLastRow() - 1));
}
