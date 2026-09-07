/* calculator.js — household kit checklist. */
(function (global) {
  'use strict';

  var rules = null;
  var lastState = null;
  var lastItems = [];
  var lastBoxes = [];
  var repaintProgress = null;
  var LAST_KEY = 'mrcm_last';
  var TICK_PREFIX = 'mrcm_ticks_';

  /* Ticked items are stored per household code on this device only.
     Nothing is sent anywhere. Codes are not unique between households, but
     that is harmless here: this never leaves the browser it was set in. */
  function tickKey(state) { return TICK_PREFIX + global.SaveCode.encode(state); }

  function loadTicks(state) {
    try {
      var raw = localStorage.getItem(tickKey(state));
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveTicks(state, ids) {
    try { localStorage.setItem(tickKey(state), JSON.stringify(ids)); }
    catch (e) { console.warn('[progress] could not save:', e.message); }
  }

  var $ = function (s) { return document.querySelector(s); };
  var t = function (k, v) { return global.I18N ? global.I18N.t(k, v) : k; };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* Which items apply to this household. */
  function selectItems(state) {
    return rules.items.filter(function (it) {
      return it.when.every(function (c) {
        if (c === 'always') return true;
        if (c === 'pets') return state.pets;
        if (c === 'meds') return state.meds;
        if (c === 'apartment') return state.housing === 'apartment';
        if (c === 'house') return state.housing === 'house';
        return false;
      });
    });
  }

  function waterGallons(state) {
    var w = rules.water;
    return state.people * w.gallons_per_person_per_day * w.days;
  }

  function quantityLabel(it, state) {
    switch (it.qty) {
      case 'water':    return t('kit.qty.gallons', { n: waterGallons(state) });
      case 'petwater': return t('kit.qty.gallons', { n: rules.water.pet_gallons_per_day * rules.water.days });
      case 'meddays':  return t('kit.qty.days', { n: rules.medication_buffer_days });
      case 'perPerson':
        return t(it.unit === 'days' ? 'kit.qty.days' : 'kit.qty.each', { n: it.n * state.people });
      case 'fixed':
        return t(it.unit === 'days' ? 'kit.qty.days' : 'kit.qty.each', { n: it.n });
      default: return '';
    }
  }

  function renderChecklist(state, items) {
    var host = $('#kit-result');
    host.textContent = '';

    var h = el('h2', null, t('kit.result.h'));
    h.id = 'kit-result-h';
    h.tabIndex = -1;
    host.appendChild(h);

    var bits = [state.people === 1 ? t('kit.result.people_one') : t('kit.result.people_other', { n: state.people })];
    if (state.pets) bits.push(t('kit.result.with_pets'));
    if (state.meds) bits.push(t('kit.result.with_meds'));
    bits.push(t('kit.housing.' + state.housing).toLowerCase());
    host.appendChild(el('p', 'lede', t('kit.result.for') + ': ' + bits.join(', ')));

    // Water, shown with its arithmetic so the number is checkable.
    var gal = waterGallons(state);
    var box = el('div', 'water-box');
    box.appendChild(el('h3', null, t('kit.result.water_h')));
    box.appendChild(el('div', 'water-n', t('kit.result.water_n', { n: gal })));
    box.appendChild(el('p', 'water-math', t('kit.result.water_math', { people: state.people, n: gal })));
    box.appendChild(el('p', 'small', t('kit.result.water_note')));
    host.appendChild(box);

    rules.categories.forEach(function (cat) {
      var inCat = items.filter(function (i) { return i.cat === cat; });
      if (!inCat.length) return;
      host.appendChild(el('h3', null, t('kit.cat.' + cat)));
      var ul = el('ul', 'checklist');
      inCat.forEach(function (it) {
        var li = el('li');
        var label = el('label');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.value = it.id;
        var span = el('span');
        var name = el('span', 'ck-name', t('item.' + it.id + '.name'));
        var q = quantityLabel(it, state);
        if (q) {
          name.appendChild(document.createTextNode(' — '));
          name.appendChild(el('span', 'ck-qty', q));
        }
        span.appendChild(name);
        span.appendChild(el('span', 'ck-note', t('item.' + it.id + '.note')));
        label.appendChild(cb);
        label.appendChild(span);
        li.appendChild(label);
        ul.appendChild(li);
      });
      host.appendChild(ul);
    });

    // Progress meter, wired to the checkboxes above.
    var saved = loadTicks(state);
    var boxes = Array.prototype.slice.call(host.querySelectorAll('.checklist input[type=checkbox]'));
    var prog = el('div', 'progress no-print');
    var bar = el('div', 'progress-bar');
    var fill = el('span');
    bar.appendChild(fill);
    var ptext = el('p', 'progress-text');
    var clear = el('button', 'progress-clear', t('kit.progress_clear'));
    clear.type = 'button';

    function paint() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      fill.style.width = boxes.length ? Math.round((done / boxes.length) * 100) + '%' : '0%';
      ptext.textContent = done ? t('kit.progress', { done: done, total: boxes.length })
                               : t('kit.progress_none');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuenow', String(done));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(boxes.length));
      clear.hidden = done === 0;
    }

    lastBoxes = boxes;
    repaintProgress = paint;

    function currentTicks() {
      return boxes.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
    }

    boxes.forEach(function (b) {
      if (saved.indexOf(b.value) !== -1) b.checked = true;
      b.addEventListener('change', function () {
        var ids = currentTicks();
        saveTicks(state, ids);
        paint();
        // Signed in? Mirror it so other devices see the same progress.
        if (global.Auth && global.Auth.user) {
          global.Auth.saveProgress(global.SaveCode.encode(state), ids);
        }
      });
    });
    clear.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      saveTicks(state, []);
      paint();
      global.Track.send('progress_cleared', { people: state.people });
    });
    prog.appendChild(ptext);
    prog.appendChild(bar);
    prog.appendChild(clear);
    host.insertBefore(prog, host.querySelector('.water-box').nextSibling);
    paint();
    if (saved.length) global.Track.send('progress_restored', { done: saved.length, total: boxes.length });

    var foot = el('p', 'print-foot', t('footer.org') + ' — ' + t('footer.disclaimer'));
    host.appendChild(foot);

    var row = el('div', 'row no-print');
    var pb = el('button', 'btn btn-secondary', t('common.print'));
    pb.type = 'button';
    pb.addEventListener('click', function () {
      global.Track.send('checklist_print', { people: state.people });
      global.print();
    });
    var sb = el('button', 'btn btn-secondary', t('common.share'));
    sb.type = 'button';
    sb.addEventListener('click', function () { shareChecklist(state, sb); });
    row.appendChild(pb);
    row.appendChild(sb);
    host.appendChild(row);

    host.hidden = false;
  }

  function shareChecklist(state, btn) {
    var url = global.SaveCode.link(state);
    global.Track.send('checklist_share', { people: state.people });
    if (navigator.share) {
      navigator.share({ title: t('site.name'), text: t('kit.result.h'), url: url })
        .catch(function (e) { if (e.name !== 'AbortError') console.warn('[share]', e.message); });
      return;
    }
    copy(url, btn);
  }

  function copy(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = t('common.copied');
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function (e) {
        console.warn('[copy] clipboard refused:', e.message);
        global.prompt(t('common.copy'), text);
      });
    } else {
      global.prompt(t('common.copy'), text);
    }
  }

  function renderSave(state) {
    var host = $('#kit-save');
    host.textContent = '';
    var code = global.SaveCode.encode(state);
    try { localStorage.setItem(LAST_KEY, code); } catch (e) { /* private mode */ }

    host.appendChild(el('h3', null, t('save.h')));
    host.appendChild(el('p', null, t('save.auto')));

    var share = el('button', 'btn btn-secondary btn-block', t('save.share_link'));
    share.type = 'button';
    share.addEventListener('click', function () { shareChecklist(state, share); });
    host.appendChild(share);

    renderAuth(host, state);
    host.hidden = false;
    global.Track.send('plan_saved', { people: state.people });
  }

  /* Optional Google sign-in. Only ever additive: if it is not configured, or
     the visitor declines, or anything fails, the page behaves exactly as it
     does for an anonymous visitor. */
  function renderAuth(host, state) {
    var A = global.Auth;
    if (!A) return;

    var box = el('div', 'authbox');
    host.appendChild(box);

    function draw() {
      box.textContent = '';
      if (!A.available) { box.hidden = true; return; }
      box.hidden = false;

      if (A.user) {
        var who = el('p', 'auth-who', t('auth.signed_in', { email: A.user.email }));
        var out = el('button', 'btn btn-secondary', t('auth.signout'));
        out.type = 'button';
        out.addEventListener('click', function () {
          A.signOut();
          global.Track.send('signout', {});
          draw();
        });
        box.appendChild(who);
        box.appendChild(out);
        return;
      }

      box.appendChild(el('h3', null, t('auth.h')));
      box.appendChild(el('p', 'small', t('auth.b')));

      var go = el('button', 'btn btn-block', t('auth.signin'));
      go.type = 'button';
      go.addEventListener('click', function () {
        if (A.ageConfirmed()) { start(); return; }
        ageGate();
      });
      box.appendChild(go);

      var note = el('p', 'small');
      note.appendChild(document.createTextNode(t('auth.privacy_note') + ' '));
      var pl = el('a', null, t('priv.h1'));
      pl.href = 'privacy.html';
      note.appendChild(pl);
      box.appendChild(note);

      function start() {
        global.Track.send('signin_start', {});
        A.signIn().catch(function (err) {
          console.warn('[auth] ' + err.message);
          box.appendChild(el('p', 'err', t('auth.error')));
        });
      }

      /* 13+ check. COPPA applies to collecting personal information from
         under-13s, and signing in shares an email address. Anonymous use of
         every tool stays open to everyone. */
      function ageGate() {
        box.textContent = '';
        box.appendChild(el('h3', null, t('auth.age_h')));
        box.appendChild(el('p', 'small', t('auth.age_b')));
        var row = el('div', 'row');
        var yes = el('button', 'btn', t('auth.age_yes'));
        var no = el('button', 'btn btn-secondary', t('auth.age_no'));
        yes.type = no.type = 'button';
        yes.addEventListener('click', function () { A.confirmAge(true); start(); });
        no.addEventListener('click', function () {
          A.confirmAge(false);
          global.Track.send('age_gate_blocked', {});
          box.textContent = '';
          box.appendChild(el('p', 'auth-who', t('auth.age_denied')));
        });
        row.appendChild(yes); row.appendChild(no);
        box.appendChild(row);
      }
    }

    draw();
    document.addEventListener('auth:changed', draw);
  }

  /* The one question — only ever shown after the checklist exists. */
  function renderAsk(state, items) {
    var host = $('#kit-ask');
    host.textContent = '';
    host.appendChild(el('h3', null, t('ask.h')));
    var q = el('p', null, t('ask.q'));
    q.style.fontWeight = '600';
    host.appendChild(q);
    host.appendChild(el('p', 'small', t('ask.hint')));

    var ul = el('ul', 'checklist');
    items.forEach(function (it) {
      var li = el('li');
      var label = el('label');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.value = it.id;
      cb.name = 'commit';
      label.appendChild(cb);
      label.appendChild(el('span', 'ck-name', t('item.' + it.id + '.name')));
      li.appendChild(label);
      ul.appendChild(li);
    });
    host.appendChild(ul);

    var err = el('p', 'err', t('ask.none'));
    err.hidden = true;
    host.appendChild(err);

    var row = el('div', 'row');
    var submit = el('button', 'btn', t('ask.submit'));
    submit.type = 'button';
    var skip = el('button', 'btn btn-secondary', t('ask.skip'));
    skip.type = 'button';

    submit.addEventListener('click', function () {
      var picked = Array.prototype.slice.call(host.querySelectorAll('input[name=commit]:checked'))
        .map(function (c) { return c.value; });
      if (!picked.length) { err.hidden = false; return; }
      global.Track.send('plan_selected', {
        selections: picked.join('|'),
        selection_count: picked.length,
        offered_count: items.length,
        people: state.people
      });
      thanks(host);
    });
    skip.addEventListener('click', function () {
      global.Track.send('plan_skipped', { offered_count: items.length });
      thanks(host);
    });

    row.appendChild(submit);
    row.appendChild(skip);
    host.appendChild(row);
    host.hidden = false;
  }

  function thanks(host) {
    host.textContent = '';
    var p = el('p', 'ask-done', t('ask.thanks'));
    p.setAttribute('role', 'status');
    host.appendChild(p);
  }

  function readForm() {
    var people = parseInt($('#people').value, 10);
    var errEl = $('#people-err');
    if (!people || people < 1 || people > global.SaveCode.MAX_PEOPLE) {
      errEl.hidden = false;
      $('#people').focus();
      return null;
    }
    errEl.hidden = true;
    return {
      people: people,
      pets: $('input[name=pets]:checked').value === 'yes',
      meds: $('input[name=meds]:checked').value === 'yes',
      housing: $('input[name=housing]:checked').value
    };
  }

  function build(state, source) {
    lastState = state;
    lastItems = selectItems(state);
    renderChecklist(state, lastItems);
    renderSave(state);
    renderAsk(state, lastItems);
    global.Track.send('kit_complete', {
      people: state.people,
      pets: state.pets ? 1 : 0,
      meds: state.meds ? 1 : 0,
      housing: state.housing,
      water_gallons: waterGallons(state),
      item_count: lastItems.length,
      source: source
    });
    $('#kit-result-h').focus();
    $('#kit-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    syncSignedInProgress();
  }

  function fillForm(state) {
    $('#people').value = state.people;
    $('input[name=pets][value=' + (state.pets ? 'yes' : 'no') + ']').checked = true;
    $('input[name=meds][value=' + (state.meds ? 'yes' : 'no') + ']').checked = true;
    $('input[name=housing][value=' + state.housing + ']').checked = true;
  }

  function wireRestore() {
    var btn = $('#restore-btn');
    var input = $('#restore-input');
    var err = $('#restore-err');
    if (!btn || !input) return;   // the code box was removed from the page
    btn.addEventListener('click', function () {
      var state = global.SaveCode.decode(input.value);
      if (!state) {
        err.hidden = false;
        global.Track.send('code_restore_failed', {});
        return;
      }
      err.hidden = true;
      fillForm(state);
      build(state, 'code_manual');
      global.Track.send('code_restore', { code: global.SaveCode.encode(state), people: state.people });
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
    });
  }

  /* If the visitor is signed in, merge the progress stored against their
     account with whatever this device already has. Union, never overwrite:
     ticking something on your phone must not un-tick it on your laptop. */
  function syncSignedInProgress() {
    var A = global.Auth;
    if (!A || !A.user || !lastState || !lastBoxes.length) return;
    A.getProgress().then(function (row) {
      var remote = (row && Array.isArray(row.ticked)) ? row.ticked : [];
      var localIds = lastBoxes.filter(function (b) { return b.checked; })
                              .map(function (b) { return b.value; });
      var merged = localIds.slice();
      remote.forEach(function (id) { if (merged.indexOf(id) === -1) merged.push(id); });

      lastBoxes.forEach(function (b) { b.checked = merged.indexOf(b.value) !== -1; });
      saveTicks(lastState, merged);
      if (repaintProgress) repaintProgress();

      var grew = merged.length !== remote.length || merged.length !== localIds.length;
      if (grew) A.saveProgress(global.SaveCode.encode(lastState), merged);
      global.Track.send('progress_synced', { done: merged.length, total: lastBoxes.length });
    });
  }

  function start() {
    // Optional sign-in. Never blocks the page: if it is not configured or the
    // network fails, everything below still runs for an anonymous visitor.
    if (global.Auth) {
      global.Auth.init().then(function (user) {
        document.dispatchEvent(new CustomEvent('auth:changed'));
        if (user) {
          global.Track.send('signin_success', {});
          syncSignedInProgress();
        }
      }).catch(function (err) { console.warn('[auth] init failed:', err.message); });
    }

    $('#kit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var state = readForm();
      if (state) build(state, 'form');
    });
    wireRestore();

    var restart = $('#kit-restart');
    if (restart) restart.addEventListener('click', function () {
      $('#kit-result').hidden = true;
      $('#kit-save').hidden = true;
      $('#kit-ask').hidden = true;
      $('#kit-form').scrollIntoView({ behavior: 'smooth' });
    });

    // A shared link beats a remembered device.
    var fromLink = global.SaveCode.fromUrl();
    if (fromLink) {
      fillForm(fromLink);
      build(fromLink, 'link');
      global.Track.send('code_restore', { code: global.SaveCode.encode(fromLink), people: fromLink.people, via: 'link' });
      return;
    }
    try {
      var saved = global.SaveCode.decode(localStorage.getItem(LAST_KEY));
      if (saved) {
        fillForm(saved);
        build(saved, 'device_memory');
      }
    } catch (e) { /* private mode — the form simply starts empty */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('data/kit-rules.json')
      .then(function (r) {
        if (!r.ok) throw new Error('kit-rules.json HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        rules = d;
        if (global.I18N && global.I18N.ready) return global.I18N.ready.then(start);
        start();
      })
      .catch(function (err) {
        console.error('[calculator] could not load rules:', err);
        var e = document.getElementById('kit-load-err');
        if (e) e.hidden = false;
      });
  });
}(window));
