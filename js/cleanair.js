/* cleanair.js — zip/city lookup for clean air locations.
   Distance is computed in the browser from Census zip-code centroids, so no
   geolocation permission is requested and no location ever leaves the device.
   The map is Leaflet + OpenStreetMap, loaded only on demand. */
(function (global) {
  'use strict';

  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
  var MAX_RESULTS = 6;

  var sites = [], zips = {}, shown = [], map = null;

  var $ = function (s) { return document.querySelector(s); };
  var t = function (k, v) { return global.I18N ? global.I18N.t(k, v) : k; };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* Great-circle distance in miles. */
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 3958.8, toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearest(lat, lon) {
    return sites.map(function (s) {
      return { site: s, dist: haversine(lat, lon, s.lat, s.lon) };
    }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, MAX_RESULTS);
  }

  function localized(site, field) {
    var lang = (global.I18N && global.I18N.lang) || 'en';
    if (lang !== 'en' && site[field + '_' + lang]) return site[field + '_' + lang];
    return site[field] || '';
  }

  function card(entry) {
    var s = entry.site;
    var c = el('article', 'site-card');

    var head = el('h3', null, s.name);
    c.appendChild(head);

    var meta = el('p', 'site-dist');
    meta.textContent = t('air.kind.' + (s.kind || 'library')) + ' · ' + s.city +
      ' · ' + entry.dist.toFixed(1) + ' ' + t('common.miles');
    c.appendChild(meta);

    var dl = el('dl');
    function row(labelKey, value) {
      if (!value) return;
      dl.appendChild(el('dt', null, t(labelKey)));
      dl.appendChild(el('dd', null, value));
    }
    row('air.f.address', s.address);
    row('air.f.county', s.county);
    row('air.f.hours', localized(s, 'hours'));
    row('air.f.transit', localized(s, 'transit'));
    row('air.f.pets', t('air.pets.' + (s.pets || 'unknown')));
    row('air.f.phone', s.phone);
    var accNote = localized(s, 'access_notes');
    if (accNote) row('air.f.access', accNote);
    c.appendChild(dl);

    if (!localized(s, 'hours')) c.appendChild(el('p', 'small', t('air.f.callahead')));

    if (s.access && s.access.length) {
      var ul = el('ul', 'tags');
      s.access.forEach(function (a) { ul.appendChild(el('li', null, t('air.acc.' + a))); });
      c.appendChild(ul);
    }

    // Directions open in the user's own map app; only the destination is passed.
    {
      var a = el('a', 'btn btn-secondary', t('air.f.directions'));
      a.href = 'https://www.openstreetmap.org/directions?to=' + s.lat + '%2C' + s.lon;
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      a.style.marginTop = '.6rem';
      a.addEventListener('click', function () {
        global.Track.send('directions_click', { site: s.id });
      });
      c.appendChild(a);
    }
    return c;
  }

  function render(entries, originLabel, origin) {
    shown = entries;
    var host = $('#air-results');
    host.textContent = '';

    var h = el('h2', null, entries.length + ' ' + t('air.results.count') + ' ' + originLabel);
    h.id = 'air-results-h';
    h.tabIndex = -1;
    host.appendChild(h);

    entries.forEach(function (e) { host.appendChild(card(e)); });

    var btn = el('button', 'btn btn-secondary btn-block', t('air.map.show'));
    btn.type = 'button';
    btn.id = 'map-toggle';
    btn.addEventListener('click', function () { toggleMap(btn, origin); });
    host.appendChild(btn);
    host.appendChild(el('p', 'small', t('air.map.note')));

    host.hidden = false;
    $('#air-results-h').focus();
  }

  function showNone(msgKey) {
    var host = $('#air-results');
    host.textContent = '';
    var p = el('p', 'notice', t(msgKey));
    p.setAttribute('role', 'status');
    host.appendChild(p);
    host.hidden = false;
  }

  // ---- map (lazy) ----
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = res;
      s.onerror = function () { rej(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    return new Promise(function (res) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.crossOrigin = 'anonymous';
      l.onload = res;
      l.onerror = function () { res(); }; // markers still work unstyled
      document.head.appendChild(l);
    });
  }

  function toggleMap(btn, origin) {
    var box = $('#map');
    if (map && !box.hidden) {
      box.hidden = true;
      btn.textContent = t('air.map.show');
      return;
    }
    if (map) {
      box.hidden = false;
      btn.textContent = t('air.map.hide');
      map.invalidateSize();
      return;
    }
    btn.disabled = true;
    btn.textContent = t('air.map.loading');
    global.Track.send('map_open', { results: shown.length });

    Promise.all([loadCss(LEAFLET_CSS), loadScript(LEAFLET_JS)])
      .then(function () {
        box.hidden = false;
        map = global.L.map('map');
        global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        var group = [];
        shown.forEach(function (e) {
          var m = global.L.marker([e.site.lat, e.site.lon]).addTo(map);
          m.bindPopup('<strong>' + e.site.name + '</strong><br>' + e.site.address);
          group.push([e.site.lat, e.site.lon]);
        });
        if (origin) group.push([origin.lat, origin.lon]);
        map.fitBounds(group, { padding: [30, 30], maxZoom: 13 });

        btn.disabled = false;
        btn.textContent = t('air.map.hide');
      })
      .catch(function (err) {
        console.warn('[map] ' + err.message);
        btn.disabled = false;
        btn.textContent = t('air.map.show');
        var p = el('p', 'notice', t('common.error'));
        box.parentNode.insertBefore(p, box);
      });
  }

  // ---- lookups ----
  function byZip() {
    var raw = $('#zip').value.trim();
    var zip = raw.replace(/[^0-9]/g, '').slice(0, 5);
    if (zip.length !== 5 || !zips[zip]) {
      // A well-formed zip we don't hold is an out-of-state zip, not an empty result.
      showNone('air.results.badzip');
      global.Track.send('cleanair_lookup', { zip: zip || 'invalid', results: 0, method: 'zip' });
      return;
    }
    var pt = zips[zip];
    var found = nearest(pt.lat, pt.lon);
    render(found, zip, pt);
    global.Track.send('cleanair_lookup', {
      zip: zip,
      results: found.length,
      nearest_mi: found.length ? Number(found[0].dist.toFixed(1)) : '',
      method: 'zip'
    });
  }

  function byCity() {
    var city = $('#city').value;
    if (!city) return;
    var inCity = sites.filter(function (s) { return s.city === city; });
    if (!inCity.length) { showNone('air.results.none'); return; }
    var origin = { lat: inCity[0].lat, lon: inCity[0].lon };
    var found = nearest(origin.lat, origin.lon);
    render(found, city, origin);
    global.Track.send('cleanair_lookup', { city: city, results: found.length, method: 'city' });
  }

  function fillCities() {
    var sel = $('#city');
    var seen = {}, names = [];
    sites.forEach(function (s) { if (s.city && !seen[s.city]) { seen[s.city] = 1; names.push(s.city); } });
    names.sort();
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      sel.appendChild(o);
    });
  }

  function start(data) {
    sites = data.sites || [];
    fillCities();
    $('#zip-form').addEventListener('submit', function (e) { e.preventDefault(); byZip(); });
    $('#city').addEventListener('change', byCity);

    // Deep link from the "there's smoke today" panel.
    var q = new URLSearchParams(location.search).get('zip');
    if (q) { $('#zip').value = q; byZip(); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    Promise.all([
      fetch('data/clean-air-sites.json').then(function (r) {
        if (!r.ok) throw new Error('clean-air-sites.json HTTP ' + r.status);
        return r.json();
      }),
      fetch('data/zips.json').then(function (r) {
        if (!r.ok) throw new Error('zips.json HTTP ' + r.status);
        return r.json();
      })
    ]).then(function (res) {
      res[1].forEach(function (z) { zips[z.z] = { lat: z.lat, lon: z.lon }; });
      var go = function () { start(res[0]); };
      if (global.I18N && global.I18N.ready) { global.I18N.ready.then(go, go); } else { go(); }
    }).catch(function (err) {
      console.error('[cleanair] could not load data:', err);
      var e = document.getElementById('air-load-err');
      if (e) e.hidden = false;
    });
  });
}(window));
