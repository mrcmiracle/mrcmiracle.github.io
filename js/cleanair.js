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
    }).sort(function (a, b) {
      // Sites Unit 503 has activated for the current smoke event come first;
      // within each group, nearest wins. During an event an activated site is
      // the answer to the question being asked, even if a library is closer.
      var aa = a.site.activated ? 1 : 0, ba = b.site.activated ? 1 : 0;
      if (aa !== ba) return ba - aa;
      return a.dist - b.dist;
    }).slice(0, MAX_RESULTS);
  }

  function localized(site, field) {
    var lang = (global.I18N && global.I18N.lang) || 'en';
    if (lang !== 'en' && site[field + '_' + lang]) return site[field + '_' + lang];
    return site[field] || '';
  }

  function card(entry) {
    var s = entry.site;
    var c = el('article', 'site-card');

    if (s.activated) c.className += ' site-card-active';
    var head = el('h3', null, s.name);
    c.appendChild(head);
    if (s.activated) c.appendChild(el('p', 'site-badge', t('air.activated')));

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

    /* Directions. The visitor picks the map app they already use rather than
       being forced into one. Only the destination's coordinates and name are
       put in the URL - never the visitor's own location, which the page does
       not have. Nothing is requested until the link is tapped. */
    {
      var dirs = el('div', 'dirs');
      dirs.appendChild(el('span', 'dirs-label', t('air.f.directions')));
      var ll = s.lat + ',' + s.lon;
      var named = encodeURIComponent(s.name);
      [
        ['apple',  'https://maps.apple.com/?ll=' + ll + '&q=' + named],
        ['google', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ll)],
        ['osm',    'https://www.openstreetmap.org/directions?to=' + encodeURIComponent(ll)]
      ].forEach(function (opt) {
        var a = el('a', 'dirs-link', t('air.f.dir.' + opt[0]));
        a.href = opt[1];
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        a.addEventListener('click', function () {
          global.Track.send('directions_click', { site: s.id, via: opt[0] });
        });
        dirs.appendChild(a);
      });
      c.appendChild(dirs);
    }
    return c;
  }

  /* Live air quality for whatever the visitor just searched. Loads after the
     results are already on screen, so a slow feed never delays the list. */
  function showAqi(origin) {
    var host = $('#aqi');
    if (!host || !global.AQI || !origin) return;
    host.hidden = false;
    host.className = 'aqi';
    host.textContent = '';
    var p = el('p', 'aqi-none small', t('aqi.loading'));
    host.appendChild(p);
    global.AQI.nearest(origin.lat, origin.lon).then(function (reading) {
      global.AQI.render(host, reading, t);
      if (reading) {
        global.Track.send('aqi_lookup', {
          results: reading.area.aqi,
          city: reading.area.name,
          method: 'cleanair'
        });
      }
    });
  }

  function render(entries, originLabel, origin) {
    shown = entries;
    showAqi(origin);
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

  /* "Use my location". The coordinates are used to sort the list in this
     browser and are never transmitted: the whole distance calculation already
     happens client-side, and the analytics call below deliberately carries no
     zip, no city and no coordinates - only how many results came back and how
     far the nearest one was. Low accuracy is requested on purpose: a rough fix
     is plenty for ranking buildings miles apart, and it is faster and more
     private than a precise one. */
  function byGeo() {
    var btn = $('#geo-btn');
    if (!navigator.geolocation) { showNone('air.geo.unsupported'); return; }
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = t('air.geo.finding');

    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      btn.textContent = original;
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var found = nearest(lat, lon);
      if (!found.length) { showNone('air.results.none'); return; }
      render(found, t('air.geo.yourlocation'), { lat: lat, lon: lon });
      global.Track.send('cleanair_lookup', {
        results: found.length,
        nearest_mi: Number(found[0].dist.toFixed(1)),
        method: 'geolocation'
      });
    }, function (err) {
      btn.disabled = false;
      btn.textContent = original;
      // 1 = permission denied, 2 = position unavailable, 3 = timeout
      if (err.code === 1) {
        $('#geo-btn').hidden = true;
        $('#geo-note').hidden = true;
        $('#geo-blocked').hidden = false;
      }
      showNone(err.code === 1 ? 'air.geo.denied' : 'air.geo.failed');
      global.Track.send('cleanair_lookup', { results: 0, method: 'geolocation_failed' });
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
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

  function start(data, activated) {
    sites = data.sites || [];

    /* Merge the activated list over the baseline. An activated row sharing an
       id with a library replaces it, so a branch can be switched on in place
       rather than duplicated. */
    if (activated && activated.length) {
      var byId = {};
      sites.forEach(function (s, i) { byId[s.id] = i; });
      activated.forEach(function (a) {
        a.activated = true;
        if (a.access && typeof a.access === 'string') {
          try { a.access = JSON.parse(a.access); } catch (e) { a.access = []; }
        }
        if (byId[a.id] !== undefined) sites[byId[a.id]] = a;
        else sites.push(a);
      });
    }

    fillCities();
    $('#zip-form').addEventListener('submit', function (e) { e.preventDefault(); byZip(); });
    $('#city').addEventListener('change', byCity);

    /* Only offer the button if the browser can actually do it, so it is never
       shown as a control that does nothing. Secure contexts only - geolocation
       is unavailable over plain http.

       If the permission is ALREADY denied - because it was declined once and
       the browser remembered, or location is switched off for the browser at
       the operating system level - then tapping the button can never open a
       prompt. Showing a live button in that state is the bug: it looks broken
       rather than blocked. Say what is actually wrong and how to undo it. */
    if (navigator.geolocation && window.isSecureContext) {
      var field = $('#geo-field');
      field.hidden = false;
      $('#geo-btn').addEventListener('click', byGeo);

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function (status) {
          function reflect() {
            var blocked = status.state === 'denied';
            $('#geo-btn').hidden = blocked;
            $('#geo-blocked').hidden = !blocked;
            $('#geo-note').hidden = blocked;
          }
          reflect();
          status.onchange = reflect;
        }).catch(function () { /* older browsers: leave the button as it is */ });
      }
    }

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
      }),
      /* Sites activated for a live smoke event. Deliberately cannot break the
         page: any failure resolves to an empty list and the JSON baseline is
         shown on its own. The 344 libraries are the offline fallback. */
      fetch('/api/sites')
        .then(function (r) { return r.ok ? r.json() : { sites: [] }; })
        .then(function (d) { return (d && d.sites) || []; })
        .catch(function (err) {
          console.warn('[cleanair] activated sites unavailable:', err.message);
          return [];
        })
    ]).then(function (res) {
      res[1].forEach(function (z) { zips[z.z] = { lat: z.lat, lon: z.lon }; });
      var go = function () { start(res[0], res[2]); };
      if (global.I18N && global.I18N.ready) { global.I18N.ready.then(go, go); } else { go(); }
    }).catch(function (err) {
      console.error('[cleanair] could not load data:', err);
      var e = document.getElementById('air-load-err');
      if (e) e.hidden = false;
    });
  });
}(window));
