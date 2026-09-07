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

  var Track = {
    enabled: true,
    visitorId: '',
    sessionId: '',
    visitNumber: 1,
    pageStart: 0,
    maxScroll: 0,
    _sentMilestones: {},

    init: function (pageName) {
      this.page = pageName || (location.pathname.split('/').pop() || 'index.html');
      this.visitorId = store('localStorage', VID_KEY, function () { return rand(10); });
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
        new_session: isNewSession ? 1 : 0
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
    send: function (event, props, useBeacon) {
      if (!this.enabled) return;
      var body = {
        ts: new Date().toISOString(),
        event: event,
        page: this.page,
        lang: (global.I18N && global.I18N.lang) || document.documentElement.lang || 'en',
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
        if (useBeacon && global.navigator.sendBeacon) {
          global.navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
          return;
        }
        // Same-origin on Vercel, so this is a readable response: a failure is
        // now visible in the console instead of silently disappearing, which
        // is exactly how the previous collector went unnoticed for weeks.
        fetch(ENDPOINT, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
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
