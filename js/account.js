/* account.js — the sign-in pill in the header, on every page.

   Signed out:  a compact "Sign in" pill with Google's G mark.
   Signed in:   a circle with the person's first initial. Tapping it opens a
                small panel with their email, their wound history, the
                coordinator dashboard (coordinators only) and Sign out.

   An initial rather than the Google profile photo, deliberately: the photo is
   served from Google's image servers, so showing it would make every page
   view a third-party request - which privacy.html promises never happens.

   Other modules wait on Account.ready, which resolves to
     null                                     when nobody is signed in
     { user: {id, email}, me: {...}, token }  when someone is
   where `me` is the server's verified answer from /api/me (coordinator
   status, which survey halves this account has answered). */
(function (global) {
  'use strict';

  function t(k, v) { return (global.I18N && global.I18N.t) ? global.I18N.t(k, v) : k; }
  function el(tag, cls, key) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (key) { e.setAttribute('data-i18n', key); e.textContent = t(key); }
    return e;
  }

  // Google's G, drawn inline so the button needs no request to Google.
  var G_MARK = '<svg class="g-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    '</svg>';

  var resolveReady;
  var Account = {
    ready: new Promise(function (r) { resolveReady = r; }),
    state: null
  };
  global.Account = Account;

  function visitorId() {
    try { return global.localStorage.getItem('mrcm_vid') || ''; } catch (e) { return ''; }
  }

  /* Ask the server who this is, and link this browser's anonymous answers. */
  function fetchMe(A) {
    return fetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A.session.access_token },
      body: JSON.stringify({ visitor: visitorId() })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function (e) { console.warn('[account] /api/me failed:', e.message); return null; });
  }

  // ---------- age check before the first sign-in ----------
  function ageThenSignIn(A) {
    if (A.ageConfirmed()) return go();

    var dlg = document.createElement('dialog');
    dlg.className = 'age-dialog';
    dlg.appendChild(el('h2', null, 'account.age.h'));
    dlg.appendChild(el('p', null, 'account.age.b'));
    var row = el('div', 'row');
    var yes = el('button', 'btn', 'account.age.yes'); yes.type = 'button';
    var no = el('button', 'btn btn-secondary', 'account.age.no'); no.type = 'button';
    row.appendChild(yes); row.appendChild(no);
    dlg.appendChild(row);
    document.body.appendChild(dlg);

    yes.addEventListener('click', function () { A.confirmAge(true); dlg.close(); dlg.remove(); go(); });
    no.addEventListener('click', function () {
      A.confirmAge(false);
      global.Track.send('age_gate_blocked', {});
      dlg.textContent = '';
      dlg.appendChild(el('h2', null, 'account.age.blocked_h'));
      dlg.appendChild(el('p', null, 'account.age.blocked_b'));
      var ok = el('button', 'btn', 'common.close'); ok.type = 'button';
      ok.addEventListener('click', function () { dlg.close(); dlg.remove(); });
      dlg.appendChild(ok);
      ok.focus();
    });
    dlg.addEventListener('close', function () { if (dlg.isConnected) dlg.remove(); });
    dlg.showModal();
    yes.focus();

    function go() {
      global.Track.send('signin_start', {});
      A.signIn('google').catch(function (err) {
        console.warn('[account] sign-in failed to start:', err.message);
      });
    }
  }

  // ---------- rendering ----------
  function renderSignedOut(host, A) {
    host.textContent = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'signin-pill';
    btn.innerHTML = G_MARK;
    btn.appendChild(el('span', null, 'account.signin'));
    btn.addEventListener('click', function () { ageThenSignIn(A); });
    host.appendChild(btn);
  }

  function renderSignedIn(host, A, me) {
    host.textContent = '';
    var email = (me && me.email) || (A.user && A.user.email) || '';
    var initial = (email.charAt(0) || '?').toUpperCase();

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'account-dot';
    btn.textContent = initial;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'account-panel');
    /* The label interpolates the email, so it cannot be a data-i18n-aria
       attribute that I18N.apply() refreshes. Set it once the dictionary has
       loaded and again on every language change - set any earlier and a
       screen reader announces the raw key "account.menu_for". */
    function paintLabel() { btn.setAttribute('aria-label', t('account.menu_for', { email: email })); }
    paintLabel();
    ((global.I18N && global.I18N.ready) || Promise.resolve()).then(paintLabel);
    document.addEventListener('i18n:changed', paintLabel);

    var panel = el('div', 'account-panel');
    panel.id = 'account-panel';
    panel.hidden = true;

    var who = el('p', 'account-email');
    who.textContent = email;
    panel.appendChild(who);

    function link(href, key) {
      var a = el('a', 'account-link', key);
      a.href = href;
      panel.appendChild(a);
    }
    link('/wound.html#history', 'account.history');
    if (me && me.is_coordinator) link('/admin.html', 'account.coordinator');

    var out = el('button', 'account-link account-signout', 'account.signout');
    out.type = 'button';
    out.addEventListener('click', function () {
      A.signOut();
      global.Track.send('signout', {});
      location.reload();
    });
    panel.appendChild(out);

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(panel.hidden);
      if (!panel.hidden) { var first = panel.querySelector('a, button'); if (first) first.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !host.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); }
    });

    host.appendChild(btn);
    host.appendChild(panel);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var host = document.getElementById('account');
    var A = global.Auth;
    if (!A) { resolveReady(null); return; }

    A.init().then(function (user) {
      if (!user) {
        if (host) renderSignedOut(host, A);
        resolveReady(null);
        return;
      }
      return fetchMe(A).then(function (me) {
        Account.state = { user: user, me: me, token: A.session.access_token };
        if (host) renderSignedIn(host, A, me);
        if (me && me.linked) global.Track.send('progress_synced', { done: me.linked });
        resolveReady(Account.state);
      });
    }).catch(function (err) {
      console.warn('[account] init failed:', err.message);
      if (host) renderSignedOut(host, A);
      resolveReady(null);
    });

    // Labels built here are JS text; keep them in the current language.
    document.addEventListener('i18n:changed', function () {
      if (host) (global.I18N && global.I18N.apply) && global.I18N.apply(host);
    });
  });
}(window));
