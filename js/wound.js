/* wound.js — the wound check page.

   The model is deployed separately; /api/wound proxies to it so the browser
   only ever talks to this origin.

   Three deliberate choices, all about the fact that the people most likely to
   use this are the people least able to get seen by a clinician:

   1. The "get care now" panel is in the HTML above this script, always
      visible, and repeated with every result. It does not depend on the model
      being right, or on the model working at all.
   2. Confidence is shown as a plain number every time, and a low-confidence
      answer is presented as "not sure" rather than a quiet guess.
   3. The guidance shown for each result lives HERE rather than being whatever
      the model's server returns, for one reason: that server answers in
      English only, and this site is fully bilingual. Passing its text straight
      through would hand a Spanish-speaking reader English medical guidance at
      the exact moment they are least able to work around it. The classifier's
      own `tips` are still accepted and used as a fallback for any label this
      file does not have wording for. */
(function (global) {
  'use strict';

  // Longest edge, in pixels, before upload. Plenty for a 224x224 classifier
  // and it keeps the request small.
  var MAX_EDGE = 1024;
  var JPEG_QUALITY = 0.82;

  function t(k, v) { return (global.I18N && global.I18N.t) ? global.I18N.t(k, v) : k; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var lastResult = null;

  /* Downscale in the browser. Smaller upload, and the full-resolution original
     never leaves the device. */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), w: cw, h: ch });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
      img.src = url;
    });
  }

  function labelText(label) {
    var key = 'wound.label.' + label;
    var got = t(key);
    return got === key ? label.replace(/_/g, ' ') : got;
  }

  /* Localised guidance for a label. Falls back to whatever the classifier sent
     if this file has no wording for that label - better English guidance than
     none, and it means a new class added upstream still says something. */
  function guidanceFor(label, apiTips) {
    var out = [];
    for (var i = 1; i <= 4; i++) {
      var key = 'wound.tips.' + label + '.' + i;
      var line = t(key);
      if (line !== key) out.push(line);
    }
    if (!out.length && apiTips && apiTips.length) return apiTips.slice(0, 6);
    return out;
  }

  function render(host, data) {
    host.textContent = '';

    var isUnknown = data.label === 'unknown' || data.confidence == null;
    var box = el('div', 'wound-answer' + (isUnknown ? ' is-unsure' : ''));

    box.appendChild(el('p', 'wound-eyebrow', isUnknown ? t('wound.result.unsure_h') : t('wound.result.h')));
    box.appendChild(el('p', 'wound-label', isUnknown ? t('wound.result.unsure') : labelText(data.label)));

    if (data.confidence != null) {
      var c = el('p', 'wound-confidence');
      c.textContent = t('wound.result.confidence', { pct: data.confidence });
      box.appendChild(c);
      if (isUnknown && data.best_guess) {
        box.appendChild(el('p', 'small', t('wound.result.bestguess', { guess: labelText(data.best_guess) })));
      }
    }
    host.appendChild(box);

    var tips = guidanceFor(isUnknown ? 'unknown' : data.label, data.tips);
    if (tips.length) {
      host.appendChild(el('h3', null, t('wound.result.tips_h')));
      var ul = el('ul', 'wound-tips');
      tips.forEach(function (line) { ul.appendChild(el('li', null, line)); });
      host.appendChild(ul);
    }

    host.appendChild(el('p', 'notice notice-strong', t('wound.result.repeat')));
    host.hidden = false;
    host.querySelector('.wound-eyebrow').setAttribute('tabindex', '-1');
    host.querySelector('.wound-eyebrow').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('wound-file');
    var preview = document.getElementById('wound-preview');
    var result = document.getElementById('wound-result');
    var err = document.getElementById('wound-err');
    if (!input) return;

    function fail(key) {
      err.textContent = t(key);
      err.hidden = false;
      result.hidden = true;
    }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      err.hidden = true;
      result.hidden = true;

      shrink(file).then(function (shrunk) {
        preview.textContent = '';
        var img = new Image();
        img.src = shrunk.dataUrl;
        img.alt = t('wound.preview.alt');
        img.className = 'wound-preview-img';
        preview.appendChild(img);
        preview.appendChild(el('p', 'small', t('wound.tool.working')));
        preview.hidden = false;

        global.Track.send('wound_check', { method: 'upload' });

        return fetch('/api/wound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: shrunk.dataUrl })
        }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); });
      }).then(function (res) {
        var p = preview.querySelector('.small');
        if (p) p.remove();
        if (!res) return;
        if (!res.d.ok) {
          fail(res.d.reason === 'not configured' ? 'wound.err.notready' : 'wound.err.failed');
          global.Track.send('wound_check_failed', { via: res.d.reason || res.d.error || String(res.status) });
          return;
        }
        lastResult = res.d;
        render(result, res.d);
        global.Track.send('wound_result', {
          wound_label: res.d.label,
          wound_confidence: res.d.confidence == null ? '' : res.d.confidence
        });
      }).catch(function (e) {
        var p = preview.querySelector('.small');
        if (p) p.remove();
        console.warn('[wound] ' + e.message);
        fail('wound.err.failed');
      });
    });

    // Results are built here, so redraw them when the language changes.
    document.addEventListener('i18n:changed', function () {
      if (lastResult && !result.hidden) render(result, lastResult);
    });
  });
}(window));
