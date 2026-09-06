/* savecode.js — the code IS the checklist.
   Four answers fit in 9 bits, so instead of storing a plan on a server and
   handing out a lookup key, we encode the answers into the code itself.
   Consequences: it never expires, needs no backend, works on any device, and
   keeps working if the spreadsheet or this site's hosting changes.
   Format: KC-XXXX, using Crockford base32 (no I, L, O, or U) so the characters
   cannot be misread when someone copies the code off a screen by hand. */
(function (global) {
  'use strict';

  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
  var VERSION = 1;
  var MAX_PEOPLE = 12;

  function encodeBase32(n, chars) {
    var out = '';
    for (var i = chars - 1; i >= 0; i--) out += ALPHABET[(n >> (5 * i)) & 31];
    return out;
  }

  function decodeBase32(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var v = ALPHABET.indexOf(s[i]);
      if (v === -1) return null;
      n = (n * 32) + v;
    }
    return n;
  }

  /* 8-bit check value. Not security — it only needs to reject typos. */
  function checksum(payload) {
    var h = 0x9e;
    for (var i = 0; i < 3; i++) {
      h ^= (payload >> (i * 8)) & 0xff;
      h = ((h * 31) + 7) & 0xff;
    }
    return h;
  }

  var SaveCode = {
    MAX_PEOPLE: MAX_PEOPLE,

    /* state: {people:1-12, pets:bool, meds:bool, housing:'apartment'|'house'} */
    encode: function (state) {
      var people = Math.max(1, Math.min(MAX_PEOPLE, parseInt(state.people, 10) || 1));
      var payload = (people - 1) & 15;
      if (state.pets) payload |= 1 << 4;
      if (state.meds) payload |= 1 << 5;
      if (state.housing === 'house') payload |= 1 << 6;
      payload |= (VERSION & 3) << 7;
      var n = (payload << 8) | checksum(payload);
      return 'KC-' + encodeBase32(n, 4);
    },

    decode: function (raw) {
      if (!raw) return null;
      var s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
      s = s.replace(/[IL]/g, '1').replace(/O/g, '0'); // Crockford's standard confusable mapping
      if (s.length === 6 && s.slice(0, 2) === 'KC') s = s.slice(2);
      if (s.length !== 4) return null;

      var n = decodeBase32(s);
      if (n === null) return null;

      var payload = n >> 8;
      if ((n & 0xff) !== checksum(payload)) return null;
      if (((payload >> 7) & 3) !== VERSION) return null;

      var people = (payload & 15) + 1;
      if (people < 1 || people > MAX_PEOPLE) return null;

      return {
        people: people,
        pets: !!(payload & (1 << 4)),
        meds: !!(payload & (1 << 5)),
        housing: (payload & (1 << 6)) ? 'house' : 'apartment'
      };
    },

    link: function (state) {
      var code = this.encode(state);
      return location.origin + location.pathname + '?c=' + code;
    },

    fromUrl: function () {
      return this.decode(new URLSearchParams(location.search).get('c'));
    }
  };

  global.SaveCode = SaveCode;
  if (typeof module !== 'undefined' && module.exports) module.exports = SaveCode;
}(typeof window !== 'undefined' ? window : globalThis));
