/* aqi.js — live air quality.

   /api/aqi returns every Washington reporting area in one small cached
   response; this picks the nearest one using the same zip centroids the clean
   air finder already uses. That way one cache entry serves every visitor and
   no location ever leaves the device. */
(function (global) {
  'use strict';

  var loaded = null;   // promise, so concurrent callers share one request

  // EPA's published AQI breakpoints.
  var BANDS = [
    { max: 50,  key: 'good' },
    { max: 100, key: 'moderate' },
    { max: 150, key: 'usg' },
    { max: 200, key: 'unhealthy' },
    { max: 300, key: 'very' },
    { max: Infinity, key: 'hazardous' }
  ];

  function band(aqi) {
    for (var i = 0; i < BANDS.length; i++) if (aqi <= BANDS[i].max) return BANDS[i].key;
    return 'hazardous';
  }

  function haversine(lat1, lon1, lat2, lon2) {
    var R = 3958.8, r = Math.PI / 180;
    var dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  var AQI = {
    band: band,

    load: function () {
      if (loaded) return loaded;
      loaded = fetch('/api/aqi')
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (d) {
          if (!d.ok || !d.areas || !d.areas.length) throw new Error('no areas in response');
          return d;
        })
        .catch(function (err) {
          console.warn('[aqi] ' + err.message);
          loaded = null;          // let a later attempt retry
          return null;
        });
      return loaded;
    },

    /* Nearest reporting area to a point, with the distance in miles. */
    nearest: function (lat, lon) {
      return this.load().then(function (d) {
        if (!d) return null;
        var best = null, bestD = Infinity;
        d.areas.forEach(function (a) {
          var dist = haversine(lat, lon, a.lat, a.lon);
          if (dist < bestD) { bestD = dist; best = a; }
        });
        if (!best) return null;
        return {
          area: best, distance: bestD,
          band: band(best.aqi), stale: !!d.stale, fetched: d.fetched
        };
      });
    },

    /* Render into a host element. Returns the reading, or null. */
    render: function (host, reading, t) {
      host.textContent = '';
      if (!reading) {
        var p = document.createElement('p');
        p.className = 'aqi-none small';
        p.textContent = t('aqi.unavailable');
        host.appendChild(p);
        return null;
      }
      var a = reading.area;
      host.className = 'aqi aqi-' + reading.band;

      var head = document.createElement('p');
      head.className = 'aqi-head';
      head.textContent = t('aqi.h') + ' ' + t('aqi.in', { area: a.name });
      host.appendChild(head);

      var row = document.createElement('div');
      row.className = 'aqi-row';
      var num = document.createElement('span');
      num.className = 'aqi-num';
      num.textContent = a.aqi;
      var cat = document.createElement('span');
      cat.className = 'aqi-cat';
      cat.textContent = t('aqi.cat.' + reading.band);
      row.appendChild(num);
      row.appendChild(cat);
      host.appendChild(row);

      var advice = document.createElement('p');
      advice.className = 'aqi-do';
      advice.textContent = t('aqi.do.' + reading.band);
      host.appendChild(advice);

      if (a.action) {
        var act = document.createElement('p');
        act.className = 'aqi-action';
        act.textContent = t('aqi.actionday');
        host.appendChild(act);
      }

      var meta = document.createElement('p');
      meta.className = 'aqi-meta small';
      var bits = [];
      if (a.time) bits.push(t('aqi.updated', { time: a.time + ' ' + (a.tz || '') }));
      bits.push(t('aqi.source', { agency: a.agency || 'AirNow' }));
      if (reading.stale) bits.push(t('aqi.stale'));
      meta.textContent = bits.join(' · ');
      host.appendChild(meta);

      host.hidden = false;
      return reading;
    }
  };

  global.AQI = AQI;
}(window));
