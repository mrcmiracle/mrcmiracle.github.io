/* wound.js — the wound check.

   The model is deployed separately; /api/wound proxies to it so the browser
   only ever talks to this origin.

   HOW A PHOTO GETS IN
   There are four ways, and which ones are offered depends on the device:

     the file button   the native picker. On a phone this is the OS sheet -
                       Photo Library, Take Photo, and Choose File, which lists
                       Google Drive, Dropbox and iCloud as providers when those
                       apps are installed. On a desktop it is the file dialog,
                       which reaches the same services because they mount as
                       ordinary folders.
     drag and drop     desktop.
     paste             desktop. Cmd/Ctrl+V after a screenshot or a copied image.
     the camera        desktop only, via getUserMedia. A phone does not need it:
                       its native sheet already offers Take Photo, and an
                       in-page camera would be a worse version of the one the
                       OS provides.

   There is deliberately NO `capture` attribute on the input. `capture` tells
   the browser to go straight to the camera, and it is the reason this used to
   be camera-only on iPhone and file-only on Mac at the same time: iOS honours
   it and skips the picker entirely, while macOS has no camera intent and
   silently falls back to the file dialog. One attribute, two opposite
   complaints. Do not add it back.

   `accept` is image/* rather than image/jpeg,image/png because every file is
   re-encoded to JPEG by shrink() below before it is ever sent. Narrowing it
   only hid valid photos - notably iPhone HEIC, which Safari decodes perfectly
   well but which was being filtered out of the picker.

   Three deliberate choices about the medical content, all about the fact that
   the people most likely to use this are the people least able to get seen by
   a clinician:

   1. The "get care now" panel is in the HTML above this script, always
      visible, and repeated with every result. It does not depend on the model
      being right, or on the model working at all.
   2. An answer the model will not stand behind is presented as "not sure"
      rather than a quiet guess, and carries NO confidence number. Until the
      out-of-scope gate shipped, "not sure" always meant confidence under 60%,
      so printing it was informative. The gate can now withhold an answer the
      classifier was 88% sure of, and "Not confident enough to say - 88%
      confidence" reads as a contradiction. A confident answer still shows its
      number, which is what the reader can act on.
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
  var stream = null;          // live camera stream, when one is open

  function isCoarsePointer() {
    return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  }
  function hasCamera() {
    return !!(global.navigator && global.navigator.mediaDevices &&
              global.navigator.mediaDevices.getUserMedia);
  }
  function isMacLike() {
    return /Mac|iPhone|iPad|iPod/.test((global.navigator && global.navigator.platform) || '');
  }

  /* Downscale in the browser. Smaller upload, the full-resolution original
     never leaves the device, and - because this always re-encodes to JPEG -
     any format the browser can decode becomes something the model accepts. */
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
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  function labelText(label) {
    var key = 'wound.label.' + label;
    var got = t(key);
    return got === key ? label.replace(/_/g, ' ') : got;
  }

  /* The published evidence behind each set of first aid steps, by label. Ids
     are defined in js/sources.js; the block is rendered under the steps so a
     reader - or MRC reviewing this page - can check any of it. Guidance shown
     to someone treating a wound should never be unattributable. */
  var TIP_SOURCES = {
    abrasion: ['laceration2017', 'idsa2014', 'tetanus2020'],
    bruise: ['cryo2004'],
    cut: ['ilcor2020', 'laceration2017', 'tetanus2020'],
    burn_1st_degree: ['griffin2020', 'griffin2022', 'isbi2016'],
    burn_2nd_degree: ['griffin2020', 'griffin2022', 'isbi2016'],
    burn_3rd_degree: ['isbi2016', 'ilcor2020'],
    burn_3rd_degree_possible: ['isbi2016', 'ilcor2020'],
    unknown: ['idsa2014', 'isbi2016']
  };

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

  /* The classifier only names a wound at CONFIDENCE_THRESHOLD or above - with
     one exception. A photo that most resembles a third-degree burn comes back
     as burn_3rd_degree even below that bar, because missing one costs far more
     than a false alarm. So a third-degree answer under the bar means "possibly
     severe", and is shown that way rather than as a confident answer. Must
     match CONFIDENCE_THRESHOLD in the classifier's src/model.py (a percentage
     here, because the classifier sends confidence as one). */
  var CONFIDENCE_THRESHOLD_PCT = 60;

  /* Plain words for the confidence number, because "74%" does not tell a
     reader whether to act on it. The 60% line is not ours to choose - the
     server already refuses to name a wound below it and sends "unknown" - so
     these two only split what is left. 85 is a judgement call, set where the
     measured accuracy is clearly better than a coin toss; it is a label on a
     number that is shown anyway, never a reason to hide one. */
  var FAIRLY_SURE_PCT = 85;

  function sureWords(confidence) {
    if (confidence == null) return t('wound.sure.low');
    if (confidence >= FAIRLY_SURE_PCT) return t('wound.sure.high');
    if (confidence >= CONFIDENCE_THRESHOLD_PCT) return t('wound.sure.mid');
    return t('wound.sure.low');
  }

  /* The "Get care now if..." box, rebuilt under every single result.
     It is the one part of this page that does not depend on the model: the
     same list appears whether the answer was confident, unsure, or refused.
     It reuses the wound.red.* strings shown further down the page rather than
     a second copy, so the two can never drift apart in either language. */
  function careBox() {
    var box = el('section', 'care-box');
    box.setAttribute('role', 'note');
    box.appendChild(el('h3', null, t('wound.red.h')));
    var ul = document.createElement('ul');
    for (var i = 1; i <= 8; i++) {
      var line = t('wound.red.' + i);
      if (line !== 'wound.red.' + i) ul.appendChild(el('li', null, line));
    }
    box.appendChild(ul);
    box.appendChild(el('p', 'care-note', t('wound.care.note')));
    if (global.Sources) {
      box.appendChild(global.Sources.block(
        ['medlineplus_wounds', 'medlineplus_burns', 'ilcor2020', 'idsa2014']));
    }
    return box;
  }

  function isPossibleSevereBurn(label, confidence) {
    return label === 'burn_3rd_degree' && confidence != null && confidence < CONFIDENCE_THRESHOLD_PCT;
  }

  function render(host, data) {
    host.textContent = '';

    var isUnknown = data.label === 'unknown' || data.confidence == null;
    var possibleSevere = isPossibleSevereBurn(data.label, data.confidence);
    var box = el('div', 'wound-answer' + (isUnknown || possibleSevere ? ' is-unsure' : ''));

    box.appendChild(el('p', 'wound-eyebrow', isUnknown || possibleSevere ? t('wound.result.unsure_h') : t('wound.result.h')));
    box.appendChild(el('p', 'wound-label', isUnknown ? t('wound.result.unsure')
      : possibleSevere ? t('wound.result.maybe_severe') : labelText(data.label)));

    // How sure, in words, on every result including the refused ones.
    box.appendChild(el('p', 'sure-line', sureWords(isUnknown ? null : data.confidence)));

    if (data.confidence != null && !isUnknown) {
      var c = el('p', 'wound-confidence');
      c.textContent = t('wound.result.confidence', { pct: data.confidence });
      box.appendChild(c);
    }
    /* Below the threshold the server sends no wound type, and none is shown -
       no "closest guess", because the photo is often not a wound this tool
       covers at all and naming one only misleads. What replaces it is an
       instruction the reader can act on. */
    if (isUnknown) box.appendChild(el('p', 'wound-cantell', t('wound.result.cantell')));
    if (possibleSevere) box.appendChild(el('p', 'notice notice-strong', t('wound.result.maybe_severe_911')));
    host.appendChild(box);

    var tips = guidanceFor(isUnknown ? 'unknown' : possibleSevere ? 'burn_3rd_degree_possible' : data.label, data.tips);
    if (tips.length) {
      host.appendChild(el('h3', null, t('wound.result.tips_h')));
      var ul = el('ul', 'wound-tips');
      tips.forEach(function (line) { ul.appendChild(el('li', null, line)); });
      host.appendChild(ul);

      var srcIds = TIP_SOURCES[isUnknown ? 'unknown' : possibleSevere ? 'burn_3rd_degree_possible' : data.label];
      if (srcIds && global.Sources) host.appendChild(global.Sources.block(srcIds));
    }

    host.appendChild(careBox());
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

    var stage = document.getElementById('wound-stage') || input.closest('.wound-stage') || input.parentNode;
    var hint = document.getElementById('wound-hint');
    var camBtn = document.getElementById('wound-camera');
    var camBox = document.getElementById('wound-cam');
    var video = document.getElementById('wound-video');

    function fail(key) {
      err.textContent = t(key);
      err.hidden = false;
      result.hidden = true;
    }

    /* ---------------- the four ways in ---------------- */

    function accept(file, how) {
      if (!file) return;
      if (file.type && file.type.indexOf('image/') !== 0) { fail('wound.err.notimage'); return; }
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

        global.Track.send('wound_check', { method: how || 'upload' });

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
        saveToHistory(res.d);
      }).catch(function (e) {
        var p = preview.querySelector('.small');
        if (p) p.remove();
        console.warn('[wound] ' + e.message);
        fail(e.message === 'decode' ? 'wound.err.decode' : 'wound.err.failed');
      });
    }

    /* ---------------- history (signed in only) ----------------
       Saved automatically while signed in (approved). It is never silent: the
       result says "Saved to your history" every time, and the list below has a
       Clear button. Category and confidence only - never the photo. */
    var histBox = document.getElementById('history');
    var histList = document.getElementById('history-list');
    var histClear = document.getElementById('history-clear');
    var accountReady = (global.Account && global.Account.ready) || Promise.resolve(null);

    function fmtDate(iso) {
      try {
        return new Date(iso).toLocaleString((global.I18N && global.I18N.lang) || undefined,
          { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      } catch (e) { return iso; }
    }

    function paintHistory() {
      if (!histBox || !global.Auth || !global.Auth.user) return;
      global.Auth.listWounds().then(function (rows) {
        histList.textContent = '';
        if (!rows.length) {
          histList.appendChild(el('p', 'small', t('wound.history.empty')));
          histClear.hidden = true;
        } else {
          var ul = el('ul', 'history-list');
          rows.forEach(function (r) {
            var li = el('li');
            li.appendChild(el('span', 'h-label', r.label === 'unknown' ? t('wound.result.unsure')
              : isPossibleSevereBurn(r.label, r.confidence) ? t('wound.result.maybe_severe') : labelText(r.label)));
            li.appendChild(el('span', 'h-conf', (r.confidence == null || r.label === 'unknown') ? ''
              : t('wound.result.confidence', { pct: r.confidence })));
            li.appendChild(el('span', 'h-date', fmtDate(r.created_at)));
            ul.appendChild(li);
          });
          histList.appendChild(ul);
          histClear.hidden = false;
        }
        histBox.hidden = false;
      }).catch(function (e) {
        console.warn('[wound] history unavailable:', e.message);
      });
    }

    function saveToHistory(d) {
      accountReady.then(function (acct) {
        if (!acct || !global.Auth || !global.Auth.user) return;
        global.Auth.saveWound(d.label, d.confidence).then(function (ok) {
          var note = el('p', ok ? 'small saved-note' : 'small', t(ok ? 'wound.saved' : 'wound.save_failed'));
          result.appendChild(note);
          if (ok) paintHistory();
        });
      });
    }

    if (histClear) {
      var armed = false;
      histClear.addEventListener('click', function () {
        // Two taps, not a browser confirm(): deleting a health record is not
        // something one stray tap should do.
        if (!armed) {
          armed = true;
          histClear.textContent = t('wound.history.confirm');
          setTimeout(function () { armed = false; histClear.textContent = t('wound.history.clear'); }, 5000);
          return;
        }
        armed = false;
        global.Auth.clearWounds().then(function (ok) {
          histClear.textContent = t('wound.history.clear');
          if (ok) paintHistory();
        });
      });
    }
    /* Wait for BOTH the account and the dictionary. The account can resolve
       before translations load, and painting then printed raw keys such as
       "wound.result.confidence" into the list. */
    var i18nReady = (global.I18N && global.I18N.ready) || Promise.resolve();
    Promise.all([accountReady, i18nReady]).then(function (r) { if (r[0]) paintHistory(); });
    document.addEventListener('i18n:changed', function () {
      if (histBox && !histBox.hidden) paintHistory();
    });

    // 1. the native picker
    input.addEventListener('change', function () {
      accept(input.files && input.files[0], 'upload');
      // Let the same file be chosen twice in a row - without this, re-picking
      // an identical file fires no change event and nothing appears to happen.
      input.value = '';
    });

    // 2. drag and drop
    if (stage) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        stage.addEventListener(ev, function (e) {
          if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
          e.preventDefault();
          stage.classList.add('is-dropping');
        });
      });
      ['dragleave', 'dragend'].forEach(function (ev) {
        stage.addEventListener(ev, function (e) {
          if (e.target === stage) stage.classList.remove('is-dropping');
        });
      });
      stage.addEventListener('drop', function (e) {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        stage.classList.remove('is-dropping');
        accept(e.dataTransfer.files[0], 'drop');
      });
    }

    // 3. paste. Bound to the document because a pasted screenshot has no
    //    obvious focus target - the reader just hits Cmd+V on the page.
    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) { e.preventDefault(); accept(f, 'paste'); return; }
        }
      }
    });

    // 4. the camera, desktop only
    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        stream = null;
      }
      if (camBox) camBox.hidden = true;
      if (video) video.srcObject = null;
    }

    if (camBtn && camBox && video && hasCamera() && !isCoarsePointer()) {
      camBtn.hidden = false;

      camBtn.addEventListener('click', function () {
        err.hidden = true;
        global.navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false
        }).then(function (s) {
          stream = s;
          video.srcObject = s;
          camBox.hidden = false;
          video.play();
          var shutter = document.getElementById('wound-shutter');
          if (shutter) shutter.focus();
        }).catch(function (e) {
          // A refused permission is a choice, not a fault. Say so plainly and
          // leave every other route open.
          console.warn('[wound] camera: ' + e.name);
          fail('wound.err.camera');
        });
      });

      var shutterBtn = document.getElementById('wound-shutter');
      if (shutterBtn) {
        shutterBtn.addEventListener('click', function () {
          if (!stream) return;
          var cw = video.videoWidth, ch = video.videoHeight;
          if (!cw || !ch) return;
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          canvas.getContext('2d').drawImage(video, 0, 0, cw, ch);
          canvas.toBlob(function (blob) {
            stopCamera();
            if (blob) accept(new File([blob], 'camera.jpg', { type: 'image/jpeg' }), 'camera');
          }, 'image/jpeg', 0.92);
        });
      }
      var cancelBtn = document.getElementById('wound-cam-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { stopCamera(); camBtn.focus(); });

      // Never leave the camera light on because someone navigated away.
      global.addEventListener('pagehide', stopCamera);
    }

    /* The hint has to describe the routes this device actually has, or it is
       telling someone to drag a file onto a phone. */
    function paintHint() {
      if (!hint) return;
      hint.textContent = isCoarsePointer()
        ? t('wound.tool.hint_touch')
        : t('wound.tool.hint_desktop', { key: isMacLike() ? '⌘V' : 'Ctrl+V' });
    }
    paintHint();

    // Results are built here, so redraw them when the language changes.
    document.addEventListener('i18n:changed', function () {
      paintHint();
      if (lastResult && !result.hidden) render(result, lastResult);
    });
  });
}(window));
