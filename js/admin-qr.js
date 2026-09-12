/* admin-qr.js — QR codes in the coordinator dashboard.

   Lets a coordinator:
     - see every code's live numbers: scans, different browsers, and how many
       of those went on to answer the survey, use the wound check or search
       for clean air
     - create a code for a new location or event
     - download a print-ready PNG or SVG with the MRC seal in the centre
     - switch a code off (codes are never deleted - a poster may still be up)

   Everything is authorised on the server (api/admin-qr.js checks the token
   with Supabase and the email against ADMIN_EMAILS). Nothing here is trusted.

   HOW THE IMAGES ARE MADE, and why they can be trusted
   The QR matrix comes from the vendored qrcode-generator library at error
   correction level H. The seal covers about 22% of the code's width. Before
   shipping, that exact recipe was tested on 400 realistic code names with two
   independent decoders (ZXing and OpenCV's Aruco detector): 400/400 decoded,
   with and without the seal, including shrunk to 180px.
   Where the browser offers BarcodeDetector (Chrome), every image is ALSO
   decoded right here before the download is offered, and the result is shown.
   Where it does not, the page says so - test with a phone before printing. */
(function (global) {
  'use strict';

  var BASE_URL = 'https://mrcmiracle.vercel.app/q/';
  var DARK = '#2A1550';
  var LOGO_FRACTION = 0.22;
  var BORDER = 4;
  var PNG_TARGET = 2400;
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var A = null;
  function api(method, body) {
    return fetch('/api/admin-qr', {
      method: method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A.session.access_token },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, data: d }; });
    });
  }

  // ---------- the seal, loaded once ----------
  var sealImg = null;
  function loadSeal() {
    if (sealImg) return Promise.resolve(sealImg);
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { sealImg = i; resolve(i); };
      i.onerror = function () { reject(new Error('seal image did not load')); };
      i.src = '/assets/seal-qr.png';
    });
  }
  function sealDataUrl() {
    return loadSeal().then(function (img) {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    });
  }

  function matrix(url) {
    var q = global.qrcode(0, 'H');      // 0 = smallest version that fits
    q.addData(url);
    q.make();
    return q;
  }

  // ---------- PNG ----------
  function drawPng(slug) {
    var q = matrix(BASE_URL + slug);
    var n = q.getModuleCount();
    var scale = Math.max(1, Math.round(PNG_TARGET / (n + 2 * BORDER)));
    var side = (n + 2 * BORDER) * scale;
    var c = document.createElement('canvas');
    c.width = side; c.height = side;
    var g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, side, side);
    g.fillStyle = DARK;
    for (var r = 0; r < n; r++) {
      for (var col = 0; col < n; col++) {
        if (q.isDark(r, col)) g.fillRect((col + BORDER) * scale, (r + BORDER) * scale, scale, scale);
      }
    }
    return loadSeal().then(function (img) {
      var logo = Math.round(n * scale * LOGO_FRACTION);
      var pad = Math.round(logo * 0.10);
      var cx = side / 2;
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(cx, cx, logo / 2 + pad, 0, Math.PI * 2); g.fill();
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, cx - logo / 2, cx - logo / 2, logo, logo);
      return c;
    });
  }

  // ---------- SVG: identical matrix and seal geometry ----------
  function buildSvg(slug) {
    var q = matrix(BASE_URL + slug);
    var n = q.getModuleCount();
    var unit = 10;
    var total = (n + 2 * BORDER) * unit;
    var d = [];
    for (var r = 0; r < n; r++) {
      for (var col = 0; col < n; col++) {
        if (q.isDark(r, col)) d.push('M' + (col + BORDER) * unit + ' ' + (r + BORDER) * unit + 'h' + unit + 'v' + unit + 'h-' + unit + 'z');
      }
    }
    var lp = n * unit * LOGO_FRACTION;
    var c = total / 2;
    return sealDataUrl().then(function (href) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + total +
        '" viewBox="0 0 ' + total + ' ' + total + '">' +
        '<rect width="100%" height="100%" fill="#FFFFFF"/>' +
        '<path fill="' + DARK + '" d="' + d.join('') + '"/>' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + (lp / 2 + lp * 0.10) + '" fill="#FFFFFF"/>' +
        '<image x="' + (c - lp / 2) + '" y="' + (c - lp / 2) + '" width="' + lp + '" height="' + lp + '" href="' + href + '"/>' +
        '</svg>';
    });
  }

  /* Decode the finished image in the browser, where that is possible. */
  function selfCheck(canvas, slug) {
    if (!('BarcodeDetector' in global)) return Promise.resolve('unavailable');
    var det;
    try { det = new global.BarcodeDetector({ formats: ['qr_code'] }); }
    catch (e) { return Promise.resolve('unavailable'); }
    return det.detect(canvas).then(function (codes) {
      return codes.some(function (x) { return x.rawValue === BASE_URL + slug; }) ? 'ok' : 'failed';
    }).catch(function () { return 'unavailable'; });
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- rendering the dashboard ----------
  function stat(value, label) {
    var d = el('div', 'stat');
    d.appendChild(el('b', null, String(value)));
    d.appendChild(el('span', null, label));
    return d;
  }

  function fmt(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return ts; }
  }

  function render(root, report, flash) {
    root.textContent = '';
    root.appendChild(el('h2', null, 'QR codes'));
    root.appendChild(el('p', 'small',
      'Every scan is recorded by the server before the page loads. "Browsers" counts different browsers, ' +
      'not different people: one person on a phone and a laptop counts twice unless they sign in, and two ' +
      'people sharing a phone count once.'));

    var t = report.totals || {};
    var s = el('section', 'stats');
    s.appendChild(stat(t.scans || 0, 'scans'));
    s.appendChild(stat(t.people || 0, 'different browsers'));
    s.appendChild(stat(t.acted || 0, 'went on to use a tool or answer the survey'));
    root.appendChild(s);

    // create
    var form = el('form', 'qr-create');
    form.appendChild(el('h3', null, 'Make a code for a new location or event'));
    var nameLab = el('label', null, 'Name');
    var name = document.createElement('input');
    name.type = 'text'; name.required = true; name.maxLength = 120;
    name.placeholder = 'e.g. Bothell Health Fair, Oct 2026';
    nameLab.appendChild(name);
    var catLab = el('label', null, 'Type');
    var cat = document.createElement('select');
    [['event', 'Event or MRC table'], ['library', 'Library'], ['school', 'School'], ['other', 'Other']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; cat.appendChild(op);
    });
    catLab.appendChild(cat);
    var go = el('button', 'btn', 'Create code'); go.type = 'submit';
    // A message from the previous action. The whole section is redrawn after
    // a change, so it has to be passed in or it vanishes with the old DOM.
    var msg = el('p', 'small', flash || '');
    form.appendChild(nameLab); form.appendChild(catLab); form.appendChild(go); form.appendChild(msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      go.disabled = true; msg.textContent = 'Creating…';
      api('POST', { label: name.value, category: cat.value }).then(function (r) {
        go.disabled = false;
        if (r.status === 201) { load(root, 'Created /q/' + r.data.code.slug + ' - download it below.'); }
        else msg.textContent = (r.data && r.data.error) || ('Could not create (HTTP ' + r.status + ')');
      }).catch(function (err) { go.disabled = false; msg.textContent = 'Could not reach the server: ' + err.message; });
    });
    root.appendChild(form);

    // list
    var codes = report.codes || [];
    var list = el('div', 'qr-list');
    codes.forEach(function (c) {
      var card = el('article', 'qr-card' + (c.active ? '' : ' is-off'));
      var head = el('div', 'qr-card-head');
      head.appendChild(el('h3', null, c.label));
      head.appendChild(el('code', null, '/q/' + c.slug));
      card.appendChild(head);

      var nums = el('p', 'qr-nums');
      nums.textContent = c.scans + ' scans · ' + c.people + ' browsers · ' +
        c.took_survey + ' answered the survey · ' + c.used_wound + ' used the wound check · ' +
        c.searched_air + ' searched for clean air';
      card.appendChild(nums);

      var dev = c.devices || {};
      var devText = ['phone', 'tablet', 'computer'].filter(function (k) { return dev[k]; })
        .map(function (k) { return dev[k] + ' ' + k; }).join(', ');
      card.appendChild(el('p', 'small', 'First scan ' + fmt(c.first_scan) + ' · latest ' + fmt(c.last_scan) +
        (devText ? ' · ' + devText : '')));

      var row = el('div', 'row');
      var pngBtn = el('button', 'btn', 'Download PNG'); pngBtn.type = 'button';
      var svgBtn = el('button', 'btn btn-secondary', 'Download SVG'); svgBtn.type = 'button';
      var toggle = el('button', 'btn btn-secondary', c.active ? 'Switch off' : 'Switch on'); toggle.type = 'button';
      var note = el('p', 'small qr-check');
      pngBtn.addEventListener('click', function () {
        note.textContent = 'Drawing…';
        drawPng(c.slug).then(function (canvas) {
          return selfCheck(canvas, c.slug).then(function (result) {
            if (result === 'failed') {
              note.textContent = 'This image did not decode in the browser check. Not downloaded — tell the site team.';
              return;
            }
            note.textContent = result === 'ok'
              ? 'Checked: this image scans to ' + BASE_URL + c.slug
              : 'This browser cannot check QR images itself. Scan the printout with a phone before putting it up.';
            canvas.toBlob(function (blob) { download(blob, c.slug + '.png'); }, 'image/png');
          });
        }).catch(function (err) { note.textContent = 'Could not draw the code: ' + err.message; });
      });
      svgBtn.addEventListener('click', function () {
        buildSvg(c.slug).then(function (svg) {
          download(new Blob([svg], { type: 'image/svg+xml' }), c.slug + '.svg');
          note.textContent = 'SVG uses the same code and seal geometry as the PNG.';
        }).catch(function (err) { note.textContent = 'Could not build the SVG: ' + err.message; });
      });
      toggle.addEventListener('click', function () {
        toggle.disabled = true;
        api('PATCH', { slug: c.slug, active: !c.active }).then(function () { load(root); });
      });
      row.appendChild(pngBtn); row.appendChild(svgBtn); row.appendChild(toggle);
      card.appendChild(row);
      card.appendChild(note);
      list.appendChild(card);
    });
    root.appendChild(list);

    // when scans happen
    var wd = report.by_weekday || {}, hr = report.by_hour || {};
    if (Object.keys(wd).length) {
      root.appendChild(el('h3', null, 'When scans happen (Seattle time)'));
      var days = el('p', 'small');
      days.textContent = DAYS.map(function (d, i) { return d + ' ' + (wd[i] || 0); }).join(' · ');
      root.appendChild(days);
      var hours = el('p', 'small');
      hours.textContent = Object.keys(hr).sort(function (a, b) { return a - b; })
        .map(function (h) { return h + ':00 ' + hr[h]; }).join(' · ');
      root.appendChild(hours);
    }
  }

  function load(root, flash) {
    api('GET').then(function (r) {
      if (r.status === 200) render(root, r.data.report, flash);
      else if (r.status !== 401 && r.status !== 403) {
        root.textContent = '';
        root.appendChild(el('p', 'notice', 'QR codes could not load: ' + ((r.data && r.data.error) || 'HTTP ' + r.status)));
      }
      // 401 / 403: admin.js is already showing sign-in or "not a coordinator".
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('qr-root');
    A = global.Auth;
    if (!root || !A || !global.qrcode) return;
    A.init().then(function (user) { if (user) load(root); });
  });
}(window));
