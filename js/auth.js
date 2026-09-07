/* auth.js — optional Google sign-in, used only to sync checklist progress
   between a person's own devices.

   Deliberately written without the Supabase JavaScript library. Supabase's
   auth and REST endpoints are plain HTTP, so doing it with fetch keeps this
   site's property of making no third-party runtime requests at all, and adds
   no ~50KB dependency to a page people may open in an emergency.

   Anonymous use is the default everywhere. Nothing here runs unless the
   visitor actively presses "Continue with Google". */
(function (global) {
  'use strict';

  var SESSION_KEY = 'mrcm_session';
  var AGE_KEY = 'mrcm_age_ok';
  var cfg = null;

  function store(k, v) {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }
    catch (e) { /* private mode */ }
  }
  function read(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }

  var Auth = {
    user: null,          // { id, email } once signed in
    session: null,       // { access_token, refresh_token, expires_at }
    available: false,    // false until /api/config confirms it is set up

    /* Load the public config. The anon key it returns is public by design. */
    config: function () {
      if (cfg) return Promise.resolve(cfg);
      return fetch('/api/config')
        .then(function (r) { return r.ok ? r.json() : { ok: false }; })
        .then(function (d) {
          cfg = d && d.ok ? d : null;
          this.available = !!cfg;
          return cfg;
        }.bind(this))
        .catch(function (err) {
          console.warn('[auth] config unavailable:', err.message);
          cfg = null;
          return null;
        });
    },

    ageConfirmed: function () { return read(AGE_KEY) === '1'; },
    confirmAge: function (ok) { store(AGE_KEY, ok ? '1' : '0'); },

    /* Send the visitor to Google. Supabase handles the provider handshake and
       returns them to this page with tokens in the URL fragment. */
    signIn: function () {
      return this.config().then(function (c) {
        if (!c) throw new Error('sign-in is not configured');
        var back = location.origin + location.pathname;
        location.href = c.url.replace(/\/$/, '') +
          '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(back);
      });
    },

    signOut: function () {
      var s = this.session;
      this.session = null;
      this.user = null;
      store(SESSION_KEY, null);
      if (s && cfg) {
        // Best effort: tell Supabase to revoke it. Local state is already gone.
        fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + s.access_token }
        }).catch(function (e) { console.warn('[auth] logout call failed:', e.message); });
      }
    },

    /* Pull tokens out of the fragment after the redirect back, then clean the
       URL so the access token is not left sitting in the address bar. */
    captureRedirect: function () {
      if (!location.hash || location.hash.indexOf('access_token') === -1) return false;
      var p = new URLSearchParams(location.hash.slice(1));
      var at = p.get('access_token');
      if (!at) return false;
      var sess = {
        access_token: at,
        refresh_token: p.get('refresh_token') || '',
        expires_at: Date.now() + (parseInt(p.get('expires_in') || '3600', 10) * 1000)
      };
      this.session = sess;
      store(SESSION_KEY, JSON.stringify(sess));
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    },

    restore: function () {
      var raw = read(SESSION_KEY);
      if (!raw) return false;
      try { this.session = JSON.parse(raw); return !!this.session.access_token; }
      catch (e) { store(SESSION_KEY, null); return false; }
    },

    refreshIfNeeded: function () {
      var s = this.session;
      if (!s) return Promise.resolve(false);
      if (Date.now() < s.expires_at - 60000) return Promise.resolve(true);
      if (!s.refresh_token || !cfg) return Promise.resolve(false);
      return fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      }).then(function (r) {
        if (!r.ok) throw new Error('refresh HTTP ' + r.status);
        return r.json();
      }).then(function (d) {
        this.session = {
          access_token: d.access_token,
          refresh_token: d.refresh_token,
          expires_at: Date.now() + (d.expires_in * 1000)
        };
        store(SESSION_KEY, JSON.stringify(this.session));
        return true;
      }.bind(this)).catch(function (err) {
        console.warn('[auth] could not refresh session:', err.message);
        this.signOut();
        return false;
      }.bind(this));
    },

    loadUser: function () {
      if (!this.session || !cfg) return Promise.resolve(null);
      return fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/user', {
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + this.session.access_token }
      }).then(function (r) {
        if (!r.ok) throw new Error('user HTTP ' + r.status);
        return r.json();
      }).then(function (u) {
        this.user = { id: u.id, email: u.email };
        return this.user;
      }.bind(this)).catch(function (err) {
        console.warn('[auth] could not load user:', err.message);
        this.signOut();
        return null;
      }.bind(this));
    },

    /* Bring an existing session back on page load. Resolves with the user or null. */
    init: function () {
      var self = this;
      return this.config().then(function (c) {
        if (!c) return null;
        var fresh = self.captureRedirect();
        if (!fresh && !self.restore()) return null;
        return self.refreshIfNeeded().then(function (ok) {
          return ok ? self.loadUser() : null;
        });
      });
    },

    // ---- progress, guarded by row level security to this user's own row ----

    rest: function (path, opts) {
      opts = opts || {};
      opts.headers = Object.assign({
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + this.session.access_token,
        'Content-Type': 'application/json'
      }, opts.headers || {});
      return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1' + path, opts);
    },

    getProgress: function () {
      if (!this.user) return Promise.resolve(null);
      return this.rest('/progress?select=code,ticked&user_id=eq.' + this.user.id)
        .then(function (r) {
          if (!r.ok) throw new Error('progress HTTP ' + r.status);
          return r.json();
        })
        .then(function (rows) { return rows && rows.length ? rows[0] : null; })
        .catch(function (err) {
          console.warn('[auth] could not read progress:', err.message);
          return null;
        });
    },

    saveProgress: function (code, ticked) {
      if (!this.user) return Promise.resolve(false);
      return this.rest('/progress', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: this.user.id,
          code: code,
          ticked: ticked,
          updated_at: new Date().toISOString()
        })
      }).then(function (r) {
        if (!r.ok) console.warn('[auth] could not save progress: HTTP ' + r.status);
        return r.ok;
      }).catch(function (err) {
        console.warn('[auth] could not save progress:', err.message);
        return false;
      });
    }
  };

  global.Auth = Auth;
}(window));
