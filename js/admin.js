/* admin.js — the coordinator view for activating cleaner air sites.
   Loaded only by admin.html.

   Nothing here is a security boundary. The browser decides what to *show*; the
   server decides what may be *saved*. /api/admin-sites verifies the access
   token with Supabase and checks the resulting email against ADMIN_EMAILS, so
   editing this file, or signing in with any other account, changes nothing. */
(function (global) {
  'use strict';

  var root, A;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear() { root.textContent = ''; }

  function token() {
    return (A.session && A.session.access_token) || '';
  }

  function api(method, body) {
    return fetch('/api/admin-sites', {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token()
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, data: d }; });
    });
  }

  function notice(kind, text) {
    var p = el('p', kind === 'err' ? 'err' : 'notice', text);
    return p;
  }

  // ---- screens ----

  function signedOut() {
    clear();
    root.appendChild(el('h2', null, 'Sign in to continue'));
    root.appendChild(el('p', 'small',
      'This page is for MRC Unit 503 coordinators. Sign in with the account your team gave access to.'));
    var b = el('button', 'btn', 'Continue with Google');
    b.type = 'button';
    b.addEventListener('click', function () {
      A.signIn('google').catch(function (err) {
        root.appendChild(notice('err', 'Sign-in did not start: ' + err.message));
      });
    });
    root.appendChild(b);
  }

  function refused(email, message) {
    clear();
    root.appendChild(el('h2', null, 'Not a site coordinator'));
    root.appendChild(el('p', null,
      'You are signed in as ' + email + ', which is not on the coordinator list.'));
    root.appendChild(el('p', 'small',
      message || 'Ask whoever manages the site to add your address to ADMIN_EMAILS in Vercel.'));
    var b = el('button', 'btn btn-secondary', 'Sign out');
    b.type = 'button';
    b.addEventListener('click', function () { A.signOut(); location.reload(); });
    root.appendChild(b);
  }

  function list(sites, you) {
    clear();

    var head = el('p', 'small', 'Signed in as ' + you);
    root.appendChild(head);

    var msg = el('div');
    root.appendChild(msg);

    var active = sites.filter(function (s) { return s.active; });
    root.appendChild(el('h2', null,
      active.length ? active.length + ' site' + (active.length === 1 ? '' : 's') + ' open now'
                    : 'No sites are open right now'));
    if (!active.length) {
      root.appendChild(el('p', 'small',
        'The finder is showing the 344 libraries on their own, which is the correct resting state.'));
    }

    var ul = el('ul', 'checklist');
    sites.forEach(function (s) {
      var li = el('li');
      var row = el('div', 'admin-row');

      var main = el('div');
      var name = el('span', 'ck-name', s.name);
      main.appendChild(name);
      if (s.active) {
        var badge = el('span', 'site-badge', 'Open now');
        badge.style.marginLeft = '.5rem';
        main.appendChild(badge);
      }
      main.appendChild(el('span', 'ck-note', [s.city, s.county].filter(Boolean).join(' · ') + ' · ' + s.id));
      row.appendChild(main);

      var b = el('button', 'btn ' + (s.active ? 'btn-secondary' : ''), s.active ? 'Switch off' : 'Switch on');
      b.type = 'button';
      b.addEventListener('click', function () {
        b.disabled = true;
        b.textContent = 'Saving…';
        api('POST', { id: s.id, active: !s.active }).then(function (r) {
          if (r.status === 200 && r.data.ok) { load(); return; }
          b.disabled = false;
          b.textContent = s.active ? 'Switch off' : 'Switch on';
          msg.appendChild(notice('err', 'Could not save: ' + (r.data.error || r.status)));
        });
      });
      row.appendChild(b);
      li.appendChild(row);
      ul.appendChild(li);
    });
    if (sites.length) root.appendChild(ul);

    root.appendChild(addForm(msg));
  }

  function addForm(msg) {
    var box = el('section', 'savebox');
    box.appendChild(el('h2', null, 'Add a site'));
    box.appendChild(el('p', 'small',
      'Latitude and longitude are required — the distance sort and the map both depend on them. ' +
      'Get them from openstreetmap.org: right-click the spot, then Show address. Longitude keeps its minus sign.'));

    var fields = [
      ['id', 'Short unique id', 'kent-commons-2026-09', true],
      ['name', 'Name shown to the public', 'Kent Commons', true],
      ['city', 'City', 'Kent', true],
      ['county', 'County (no "County")', 'King', false],
      ['address', 'Address', '525 4th Ave N, Kent, WA 98032', false],
      ['zip', 'Zip', '98032', false],
      ['lat', 'Latitude', '47.3809', true],
      ['lon', 'Longitude', '-122.2348', true],
      ['phone', 'Phone', '(253) 856-5000', false],
      ['hours', 'Hours during this event', 'Open 9am–9pm', false]
    ];
    var inputs = {};
    fields.forEach(function (f) {
      var wrap = el('div', 'field');
      var lab = el('label', null, f[1] + (f[3] ? ' *' : ''));
      lab.htmlFor = 'f-' + f[0];
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'f-' + f[0];
      inp.placeholder = f[2];
      inputs[f[0]] = inp;
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      box.appendChild(wrap);
    });

    var live = el('label', null, ' Switch it on straight away');
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    live.insertBefore(chk, live.firstChild);
    box.appendChild(live);

    var save = el('button', 'btn btn-block', 'Add site');
    save.type = 'button';
    save.style.marginTop = '1rem';
    save.addEventListener('click', function () {
      var payload = { active: chk.checked };
      var missing = [];
      fields.forEach(function (f) {
        var v = inputs[f[0]].value.trim();
        if (f[3] && !v) missing.push(f[1]);
        if (v) payload[f[0]] = v;
      });
      if (missing.length) {
        msg.textContent = '';
        msg.appendChild(notice('err', 'Still needed: ' + missing.join(', ')));
        return;
      }
      save.disabled = true;
      save.textContent = 'Saving…';
      api('POST', payload).then(function (r) {
        save.disabled = false;
        save.textContent = 'Add site';
        if (r.status === 200 && r.data.ok) { load(); return; }
        msg.textContent = '';
        msg.appendChild(notice('err', 'Could not save: ' + (r.data.error || r.status)));
      });
    });
    box.appendChild(save);
    return box;
  }

  // ---- boot ----

  function load() {
    api('GET').then(function (r) {
      if (r.status === 401) { signedOut(); return; }
      if (r.status === 403) { refused((A.user && A.user.email) || 'this account', r.data.error); return; }
      if (r.status === 503) {
        clear();
        root.appendChild(el('h2', null, 'Not set up yet'));
        root.appendChild(notice('err', r.data.error || 'The server is missing its configuration.'));
        return;
      }
      if (!r.data.ok) {
        clear();
        root.appendChild(notice('err', 'Could not load sites: ' + (r.data.error || r.status)));
        return;
      }
      list(r.data.sites || [], r.data.you);
    }).catch(function (err) {
      clear();
      root.appendChild(notice('err', 'Could not reach the server: ' + err.message));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('admin-root');
    A = global.Auth;
    if (!A) { root.textContent = 'Sign-in is unavailable.'; return; }
    A.init().then(function (user) {
      if (!user) { signedOut(); return; }
      load();
    }).catch(function (err) {
      clear();
      root.appendChild(notice('err', 'Sign-in check failed: ' + err.message));
    });
  });
}(window));
