/* calculator.js — household kit checklist. */
(function (global) {
  'use strict';

  var rules = null;
  var lastState = null;
  var lastItems = [];
  var LAST_KEY = 'mrcm_last';

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
    host.appendChild(el('p', null, t('save.body')));
    host.appendChild(el('p', 'small', t('save.code_label')));
    var cd = el('div', 'code-display', code);
    cd.setAttribute('role', 'status');
    host.appendChild(cd);

    var row = el('div', 'row');
    var cb = el('button', 'btn btn-secondary', t('common.copy'));
    cb.type = 'button';
    cb.addEventListener('click', function () { copy(code, cb); });
    var lb = el('button', 'btn btn-secondary', t('save.link_label'));
    lb.type = 'button';
    lb.addEventListener('click', function () { copy(global.SaveCode.link(state), lb); });
    row.appendChild(cb);
    row.appendChild(lb);
    host.appendChild(row);
    host.appendChild(el('p', 'small', t('save.no_account')));
    host.hidden = false;

    global.Track.send('code_generated', { code: code, people: state.people });
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

  function start() {
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
