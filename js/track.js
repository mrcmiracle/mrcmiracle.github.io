/* track.js — anonymous usage measurement.
   Collects NO personal information: no name, email, address, phone, precise
   location, or IP. A random visitor id lives in this browser only and contains
   nothing derived from the person or device.
   Failures never interrupt the page — an emergency site must work when the
   spreadsheet is down. Errors are logged to the console, not swallowed silently. */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // Events go to this site's own /api/track function, which writes to
  // Supabase and mirrors to the Google Sheet. Both sets of credentials
  // live in Vercel's environment variables, never in this file.
  // Requires the Vercel deployment; see docs/BACKEND.md.
  // Set to '' to disable collection and log to the console instead.
  var ENDPOINT = '/api/track';
  // ---------------------------------------------------------------

  var SITE_VERSION = '1.0.0';
  var VID_KEY = 'mrcm_vid';
  var SRC_KEY = 'mrcm_src';
  var SEEN_KEY = 'mrcm_seen';
  var SID_KEY = 'mrcm_sid';

  function rand(n) {
    var out = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var buf = new Uint8Array(n);
    (global.crypto || global.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) out += chars[buf[i] % chars.length];
    return out;
  }

  function store(area, key, make) {
    try {
      var v = global[area].getItem(key);
      if (!v) { v = make(); global[area].setItem(key, v); }
      return v;
    } catch (e) {
      return make(); // private mode — a fresh id each time, which is fine
    }
  }

  function readVidCookie() {
    var m = /(?:^|;\s*)mrcm_vid=([a-z0-9]{6,40})(?:;|$)/.exec(document.cookie || '');
    return m ? m[1] : '';
  }
  function writeVidCookie(v) {
    try {
      document.cookie = 'mrcm_vid=' + v + '; Path=/; Max-Age=31536000; SameSite=Lax' +
        (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* cookies disabled: scans simply cannot be de-duplicated */ }
  }
  /* phone / tablet / computer, from pointer type and screen size only. The
     user agent string is never read, so nothing about the model or browser
     is known, let alone stored. */
  function deviceCategory() {
    try {
      var coarse = global.matchMedia && global.matchMedia('(pointer: coarse)').matches;
      var shortSide = Math.min(global.screen.width, global.screen.height);
      if (!coarse) return 'computer';
      return shortSide >= 600 ? 'tablet' : 'phone';
    } catch (e) { return ''; }
  }

  var Track = {
    enabled: true,
    visitorId: '',
    src: '',
    sessionId: '',
    visitNumber: 1,
    pageStart: 0,
    maxScroll: 0,
    _sentMilestones: {},

    init: function (pageName) {
      this.page = pageName || (location.pathname.split('/').pop() || 'index.html');
      /* One browser id, kept in two places that must agree:
           localStorage  what every page event carries
           mrcm_vid cookie  what api/q.js can read at the moment of a QR scan,
                            before any page has loaded (approved)
         If only the cookie exists - a first visit that began with a scan -
         adopt the id the scan was recorded under, so that scan and everything
         after it belong to the same browser. Otherwise localStorage wins and
         the cookie is written to match, so the NEXT scan is recognised. */
      var cookieVid = readVidCookie();
      var stored = null;
      try { stored = global.localStorage.getItem(VID_KEY); } catch (e) { stored = null; }
      if (!stored && cookieVid) {
        try { global.localStorage.setItem(VID_KEY, cookieVid); } catch (e) { /* private mode */ }
      }
      this.visitorId = store('localStorage', VID_KEY, function () { return cookieVid || rand(10); });
      if (cookieVid !== this.visitorId) writeVidCookie(this.visitorId);
      this.device = deviceCategory();

      /* Which poster the visitor arrived from. Each printed QR carries its own
         ?src= (for example ?src=kcls-bothell), so the team can see which
         placements actually reach people instead of guessing.

         It names a poster, not a person: it is the same value for everyone who
         scans that sheet of paper, and it carries nothing about the device.
         Remembered for this browser so later pages in the same visit are still
         attributed to the poster that started it. */
      try {
        var fromUrl = new URLSearchParams(location.search).get('src');
        if (fromUrl) {
          // Keep it short and boring: a label, not a payload.
          fromUrl = fromUrl.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
          if (fromUrl) global.localStorage.setItem(SRC_KEY, fromUrl);
        }
        this.src = global.localStorage.getItem(SRC_KEY) || '';
      } catch (e) { this.src = ''; }
      this.sessionId = store('sessionStorage', SID_KEY, function () { return rand(8); });
      this.pageStart = Date.now();

      // Visit counter: how many separate sessions this browser has started.
      var isNewSession = false;
      try {
        if (!global.sessionStorage.getItem('mrcm_counted')) {
          global.sessionStorage.setItem('mrcm_counted', '1');
          isNewSession = true;
          var n = parseInt(global.localStorage.getItem(SEEN_KEY) || '0', 10) + 1;
          global.localStorage.setItem(SEEN_KEY, String(n));
          this.visitNumber = n;
        } else {
          this.visitNumber = parseInt(global.localStorage.getItem(SEEN_KEY) || '1', 10);
        }
      } catch (e) { this.visitNumber = 1; }

      this.send('page_view', {
        returning: this.visitNumber > 1 ? 1 : 0,
        visit_number: this.visitNumber,
        new_session: isNewSession ? 1 : 0,
        device: this.device
      });

      this.watchScroll();
      this.watchSections();
      this.watchExit();
    },

    watchScroll: function () {
      var self = this;
      var ticking = false;
      function measure() {
        var h = document.documentElement.scrollHeight - global.innerHeight;
        var pct = h <= 0 ? 100 : Math.round((global.scrollY / h) * 100);
        if (pct > self.maxScroll) self.maxScroll = Math.min(pct, 100);
        ticking = false;
      }
      global.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; global.requestAnimationFrame(measure); }
      }, { passive: true });
      measure();
    },

    /* Which reference sections people actually open. */
    watchSections: function () {
      var self = this;
      document.querySelectorAll('details.sect').forEach(function (d) {
        d.addEventListener('toggle', function () {
          if (d.open) self.send('section_open', { section: d.getAttribute('data-sect') || d.id || '?' });
        });
      });
    },

    watchExit: function () {
      var self = this;
      var sent = false;
      function bye() {
        if (sent) return;
        sent = true;
        self.send('page_exit', {
          seconds: Math.round((Date.now() - self.pageStart) / 1000),
          scroll_pct: self.maxScroll
        }, true);
      }
      global.addEventListener('pagehide', bye);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') bye();
      });
    },

    /* props values must be plain strings/numbers — never personal information. */
    /* `token` is optional: a signed-in person's access token, passed so the
       server can verify who they are and link the event to their account. It
       goes in the Authorization HEADER, never the body - the body is mirrored
       verbatim to the Google Sheet, and a token must never end up there. */
    send: function (event, props, useBeacon, token) {
      if (!this.enabled) return;
      var body = {
        ts: new Date().toISOString(),
        event: event,
        page: this.page,
        lang: (global.I18N && global.I18N.lang) || document.documentElement.lang || 'en',
        src: this.src || '',
        visitor: this.visitorId,
        session: this.sessionId,
        site_version: SITE_VERSION
      };
      if (props) Object.keys(props).forEach(function (k) { body[k] = props[k]; });

      if (!ENDPOINT) {
        console.info('[track: not yet connected]', event, body);
        return;
      }

      var payload = JSON.stringify(body);
      try {
        // text/plain avoids a CORS preflight, which Apps Script does not answer.
        // sendBeacon cannot carry an Authorization header, so a signed-in send
        // always goes by fetch.
        if (useBeacon && !token && global.navigator.sendBeacon) {
          global.navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
          return;
        }
        // Same-origin on Vercel, so this is a readable response: a failure is
        // now visible in the console instead of silently disappearing, which
        // is exactly how the previous collector went unnoticed for weeks.
        fetch(ENDPOINT, {
          method: 'POST',
          keepalive: true,
          headers: token
            ? { 'Content-Type': 'text/plain;charset=UTF-8', Authorization: 'Bearer ' + token }
            : { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: payload
        }).then(function (r) {
          if (!r.ok) console.warn('[track] "' + event + '" rejected: HTTP ' + r.status);
        }).catch(function (err) {
          console.warn('[track] send failed for "' + event + '":', err.message);
        });
      } catch (err) {
        console.warn('[track] send threw for "' + event + '":', err.message);
      }
    }
  };

  global.Track = Track;
}(window));
