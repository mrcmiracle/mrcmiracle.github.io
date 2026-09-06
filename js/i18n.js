/* i18n.js — language switching.
   English text is written directly into the HTML, so if this file fails to load
   English speakers still see a complete page. Only other languages need the fetch. */
(function (global) {
  'use strict';

  var SUPPORTED = ['en', 'es'];
  var STORE_KEY = 'mrcm_lang';

  var I18N = {
    lang: 'en',
    dict: {},

    detect: function () {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && SUPPORTED.indexOf(q) !== -1) return q;
      try {
        var saved = localStorage.getItem(STORE_KEY);
        if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
      } catch (e) { /* private browsing: fall through to browser language */ }
      var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
      return SUPPORTED.indexOf(nav) !== -1 ? nav : 'en';
    },

    load: function (lang) {
      return fetch('i18n/' + lang + '.json', { cache: 'default' })
        .then(function (r) {
          if (!r.ok) throw new Error('i18n ' + lang + ' HTTP ' + r.status);
          return r.json();
        });
    },

    /* t('kit.result.water_n', {n: 28}) */
    t: function (key, vars) {
      var s = this.dict[key];
      if (s === undefined) return key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          s = s.split('{' + k + '}').join(vars[k]);
        });
      }
      return s;
    },

    apply: function (root) {
      var scope = root || document;
      var self = this;
      scope.querySelectorAll('[data-i18n]').forEach(function (el) {
        var v = self.dict[el.getAttribute('data-i18n')];
        if (v !== undefined) el.textContent = v;
      });
      scope.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
        var v = self.dict[el.getAttribute('data-i18n-ph')];
        if (v !== undefined) el.setAttribute('placeholder', v);
      });
      scope.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        var v = self.dict[el.getAttribute('data-i18n-aria')];
        if (v !== undefined) el.setAttribute('aria-label', v);
      });
      document.documentElement.lang = this.lang;
    },

    set: function (lang) {
      if (SUPPORTED.indexOf(lang) === -1) return Promise.resolve();
      var self = this;
      return this.load(lang).then(function (d) {
        self.lang = lang;
        self.dict = d;
        try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* not fatal */ }
        self.apply();
        self.markButtons();
        document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
      });
    },

    markButtons: function () {
      var self = this;
      document.querySelectorAll('[data-lang]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === self.lang));
      });
    },

    init: function () {
      var self = this;
      var lang = this.detect();
      document.querySelectorAll('[data-lang]').forEach(function (b) {
        b.addEventListener('click', function () {
          var target = b.getAttribute('data-lang');
          self.set(target);
          if (global.Track) global.Track.send('lang_switch', { to: target });
        });
      });
      // Always load the dictionary, English included, so t() works for JS-built text.
      return this.set(lang).catch(function (err) {
        console.warn('[i18n] could not load translations:', err.message);
        self.markButtons();
      });
    }
  };

  global.I18N = I18N;
}(window));
