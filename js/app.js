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
    stampYear();
  });
}(window));
