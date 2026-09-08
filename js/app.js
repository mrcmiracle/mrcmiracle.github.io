/* app.js — shared boot for every page. Loads before the page-specific module. */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // GoatCounter analytics. Paste the site code you chose at signup
  // (the part before ".goatcounter.com"). Leave empty to disable.
  // See docs/DEPLOY.md step 5.
  var GOATCOUNTER_CODE = 'vihaan';
  // ---------------------------------------------------------------

  /* Loaded from script rather than pasted into five HTML files, so there is
     one place to change it. No cookies; GoatCounter sets none. */
  function loadAnalytics() {
    if (!GOATCOUNTER_CODE) return;
    if (navigator.doNotTrack === '1' || global.doNotTrack === '1') return;
    var s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count');
    s.src = 'https://gc.zgo.at/count.js';
    s.onerror = function () { console.warn('[analytics] GoatCounter script blocked or unreachable'); };
    document.head.appendChild(s);
  }

  function currentPage() {
    var f = location.pathname.split('/').pop();
    return f && f !== '' ? f : 'index.html';
  }

  function markNav(page) {
    document.querySelectorAll('.subnav a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === page || (page === 'index.html' && href === './')) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* "Right now" panels are already in the HTML, so opening one costs no
     network request. Someone standing outside in smoke does not wait. */
  function wireRightNow() {
    document.querySelectorAll('[data-rn-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var which = btn.getAttribute('data-rn-open');
        var panel = document.getElementById('rn-' + which);
        if (!panel) return;
        document.querySelectorAll('.rn-panel').forEach(function (p) { p.hidden = true; });
        panel.hidden = false;
        panel.querySelector('h2').focus();
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        global.Track.send('rightnow_open', { mode: which });
        if (which === 'smoke') loadSmokeAqi();
      });
    });
    document.querySelectorAll('[data-rn-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('.rn-panel');
        if (!panel) return;
        panel.hidden = true;
        var opener = document.querySelector('[data-rn-open="' + panel.id.replace('rn-', '') + '"]');
        if (opener) opener.focus();
        global.Track.send('rightnow_close', { mode: panel.id.replace('rn-', '') });
      });
    });
  }

  /* Outbound clicks (211, air quality map, Instagram) — tells you which
     external resources people actually use. Records the destination host only. */
  function wireOutbound() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="http"], a[href^="mailto:"]');
      if (!a) return;
      var href = a.getAttribute('href');
      var label;
      if (href.indexOf('mailto:') === 0) {
        label = 'email';
      } else {
        try { label = new URL(href).hostname.replace(/^www\./, ''); }
        catch (err) { label = 'unknown'; }
      }
      global.Track.send('outbound_click', { to: label });
    }, true);
  }

  /* Scroll reveal. Purely decorative — elements are visible by default in CSS
     for anyone with reduced motion, and if IntersectionObserver is missing we
     just show everything immediately. */
  function wireReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in global)) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Landing-page counters come from a 52-byte file generated from the real
     dataset, so the headline numbers cannot drift from data/clean-air-sites.json. */
  function fillStats() {
    var n = document.getElementById('stat-sites');
    if (!n) return;
    fetch('data/stats.json')
      .then(function (r) { if (!r.ok) throw new Error('stats.json HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (d.sites) n.textContent = d.sites;
        var c = document.getElementById('stat-counties');
        if (c && d.counties) c.textContent = d.counties;
      })
      .catch(function (err) { console.warn('[stats] ' + err.message); });

    // Live impact counter. Deliberately hidden until there is enough real
    // usage to be worth showing - "0 kits planned" reads worse than no
    // counter at all, and an inflated number is not an option.
    var MIN_TO_SHOW = 5;
    fetch('/api/stats')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !d.kits || d.kits < MIN_TO_SHOW) return;
        var strip = document.querySelector('.stats');
        if (!strip) return;
        var t = function (k) { return global.I18N ? global.I18N.t(k) : k; };
        var cell = document.createElement('div');
        cell.className = 'stat';
        var b = document.createElement('b');
        b.textContent = d.kits;
        var span = document.createElement('span');
        span.setAttribute('data-i18n', 'home.stat.kits');
        span.textContent = t('home.stat.kits');
        cell.appendChild(b); cell.appendChild(span);
        strip.appendChild(cell);
      })
      .catch(function (err) { console.warn('[impact] ' + err.message); });
  }

  /* Air quality for the panel, loaded only when someone opens it. The landing
     page itself stays request-free, which is the whole point of the panels
     being inline. Seattle's Census centroid is used as the reference point:
     the site is King County first, and no visitor location is involved. */
  var SEATTLE = { lat: 47.619335, lon: -122.351538 };
  var smokeAqiLoaded = false;
  var lastAqiReading = null;
  function loadSmokeAqi() {
    if (smokeAqiLoaded || !global.AQI) return;
    smokeAqiLoaded = true;
    var host = document.getElementById('aqi-smoke');
    if (!host) return;
    var t = function (k, v) { return global.I18N ? global.I18N.t(k, v) : k; };
    host.hidden = false;
    host.className = 'aqi';
    host.textContent = '';
    var p = document.createElement('p');
    p.className = 'aqi-none small';
    p.textContent = t('aqi.loading');
    host.appendChild(p);
    global.AQI.nearest(SEATTLE.lat, SEATTLE.lon).then(function (reading) {
      lastAqiReading = reading;
      global.AQI.render(host, reading, t);
      if (reading) global.Track.send('aqi_lookup', { results: reading.area.aqi, city: reading.area.name, method: 'rightnow' });
    });
  }

  /* The air quality panel is built in JavaScript, so redraw it in the new
     language from the reading already held. No refetch: the numbers have not
     changed, only the words around them. */
  document.addEventListener('i18n:changed', function () {
    var host = document.getElementById('aqi-smoke');
    if (!host || host.hidden || !smokeAqiLoaded || !global.AQI || !lastAqiReading) return;
    global.AQI.render(host, lastAqiReading, function (k, v) { return global.I18N ? global.I18N.t(k, v) : k; });
  });

  function stampYear() {
    document.querySelectorAll('[data-year]').forEach(function (e) {
      e.textContent = String(new Date().getFullYear());
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = currentPage();
    loadAnalytics();
    global.Track.init(page);
    // Other modules await this before rendering text built in JavaScript.
    global.I18N.ready = global.I18N.init();
    markNav(page);
    wireRightNow();
    wireOutbound();
    wireReveal();
    fillStats();
    stampYear();
  });
}(window));
