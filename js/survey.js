/* survey.js — the 5 + 5 survey at the bottom of the home page.

   WHY IT EXISTS
   A scan count says how many people saw a poster. It says nothing about
   whether anything changed. The MRC Partnership guidelines ask for exactly
   that - "# of people impacted" (page 2, 1c) and evidence that the partnership
   "created positive change" (Round Two rubric A.3). So the same readiness
   question is asked on a first visit and again on a later one, and the two
   answers from the same browser are compared.

   THE TWO HALVES
     first visit  (baseline)  readiness, confidence, household size, age,
                              household makeup
     later visit  (followup)  readiness, confidence, usefulness, what they
                              did, how many people they shared it with

   "Later visit" means a later browser SESSION than the one the first half was
   answered in - not a reload of the same page. The visit counter lives in
   js/track.js (mrcm_seen goes up once per session).

   RULES
   - Five questions per half, maximum. Every question is optional.
   - One Skip button. A skip is remembered and never re-asked for that half.
   - Nothing personal: no name, email, address, phone or location. Answers are
     stored against the same random per-browser id the rest of the site uses.
   - Labels carry data-i18n on an inner <span>, never on the <label> itself:
     I18N.apply() sets textContent, which would delete an <input> nested inside
     the element it lands on. Built this way a language switch rewrites the
     words and leaves every half-filled answer exactly where it was. */
(function (global) {
  'use strict';

  var KEY = 'mrcm_survey';

  function t(k, v) { return (global.I18N && global.I18N.t) ? global.I18N.t(k, v) : k; }

  function readState() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeState(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function currentVisit() {
    try { return parseInt(global.localStorage.getItem('mrcm_seen') || '1', 10) || 1; }
    catch (e) { return 1; }
  }

  /* Which half to ask, or '' to stay hidden. */
  function phaseToAsk(s) {
    if (!s.baselineDone) return s.baselineSkipped ? '' : 'baseline';
    if (s.followupDone || s.followupSkipped) return '';
    return currentVisit() > (s.baselineVisit || 1) ? 'followup' : '';
  }

  // ---------- tiny DOM helpers ----------
  function el(tag, cls, key, fallback) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (key) { e.setAttribute('data-i18n', key); e.textContent = t(key) === key ? (fallback || '') : t(key); }
    return e;
  }
  function span(key) { return el('span', null, key); }

  function fieldset(legendKey, hintKey) {
    var fs = el('fieldset', 'sv-q');
    var lg = document.createElement('legend');
    lg.appendChild(span(legendKey));
    fs.appendChild(lg);
    if (hintKey) fs.appendChild(el('p', 'sv-hint small', hintKey));
    return fs;
  }

  function checks(name, items) {
    var wrap = el('div', 'sv-checks');
    items.forEach(function (it) {
      var lab = document.createElement('label');
      var inp = document.createElement('input');
      inp.type = 'checkbox'; inp.name = name; inp.value = it.value;
      lab.appendChild(inp);
      lab.appendChild(span(it.key));
      wrap.appendChild(lab);
    });
    return wrap;
  }

  function radios(name, items, cls) {
    var wrap = el('div', cls || 'sv-radios');
    items.forEach(function (it) {
      var lab = document.createElement('label');
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = name; inp.value = it.value;
      lab.appendChild(inp);
      if (it.key) lab.appendChild(span(it.key));
      else { var s = document.createElement('span'); s.textContent = it.text; lab.appendChild(s); }
      wrap.appendChild(lab);
    });
    return wrap;
  }

  function scale(name, lowKey, highKey) {
    var wrap = el('div', 'sv-scale');
    wrap.appendChild(radios(name, [1, 2, 3, 4, 5].map(function (n) {
      return { value: String(n), text: String(n) };
    }), 'sv-scale-row'));
    var ends = el('div', 'sv-scale-ends small');
    ends.appendChild(span(lowKey));
    ends.appendChild(span(highKey));
    wrap.appendChild(ends);
    return wrap;
  }

  function stepper(name, min, max, start) {
    var wrap = el('div', 'sv-stepper');
    var minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.className = 'sv-step';
    minus.setAttribute('data-i18n-aria', 'survey.step.less');
    var inp = document.createElement('input');
    inp.type = 'number'; inp.name = name; inp.min = min; inp.max = max;
    inp.inputMode = 'numeric'; inp.className = 'sv-num';
    inp.value = '';
    inp.placeholder = String(start);
    var plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.className = 'sv-step';
    plus.setAttribute('data-i18n-aria', 'survey.step.more');
    /* The field starts EMPTY with the typical value as a grey placeholder, so
       someone who never touches the question is recorded as "not answered"
       rather than silently as a household of 3. The first tap counts from the
       placeholder, so + on a grey 3 gives 4, as a stepper should. */
    function bump(d) {
      var v = parseInt(inp.value, 10);
      if (!Number.isFinite(v)) v = start;
      inp.value = String(Math.min(max, Math.max(min, v + d)));
    }
    minus.addEventListener('click', function () { bump(-1); });
    plus.addEventListener('click', function () { bump(1); });
    wrap.appendChild(minus); wrap.appendChild(inp); wrap.appendChild(plus);
    return wrap;
  }

  var READINESS = [
    { value: 'water',    key: 'survey.have.water' },
    { value: 'air',      key: 'survey.have.air' },
    { value: 'plan',     key: 'survey.have.plan' },
    { value: 'firstaid', key: 'survey.have.firstaid' }
  ];

  function buildBaseline(form) {
    var q1 = fieldset('survey.b.q1', 'survey.tickall');
    q1.appendChild(checks('have', READINESS));
    form.appendChild(q1);

    var q2 = fieldset('survey.b.q2');
    q2.appendChild(scale('confidence', 'survey.scale.not', 'survey.scale.very'));
    form.appendChild(q2);

    var q3 = fieldset('survey.b.q3');
    q3.appendChild(stepper('household', 1, 20, 3));
    form.appendChild(q3);

    var q4 = fieldset('survey.b.q4');
    q4.appendChild(radios('age', [
      { value: 'under18', key: 'survey.age.under18' },
      { value: '18-39',   key: 'survey.age.18' },
      { value: '40-64',   key: 'survey.age.40' },
      { value: '65plus',  key: 'survey.age.65' },
      { value: 'na',      key: 'survey.age.na' }
    ], 'sv-radios sv-chips'));
    form.appendChild(q4);

    var q5 = fieldset('survey.b.q5', 'survey.tickall');
    q5.appendChild(checks('hh', [
      { value: 'older',      key: 'survey.hh.older' },
      { value: 'child',      key: 'survey.hh.child' },
      { value: 'disability', key: 'survey.hh.disability' },
      { value: 'language',   key: 'survey.hh.language' }
    ]));
    form.appendChild(q5);
  }

  function buildFollowup(form) {
    var q1 = fieldset('survey.f.q1', 'survey.tickall');
    q1.appendChild(checks('have', READINESS));
    form.appendChild(q1);

    var q2 = fieldset('survey.f.q2');
    q2.appendChild(scale('confidence', 'survey.scale.not', 'survey.scale.very'));
    form.appendChild(q2);

    var q3 = fieldset('survey.f.q3');
    q3.appendChild(scale('useful', 'survey.scale.notuseful', 'survey.scale.veryuseful'));
    form.appendChild(q3);

    var q4 = fieldset('survey.f.q4', 'survey.tickall');
    q4.appendChild(checks('did', [
      { value: 'water',    key: 'survey.did.water' },
      { value: 'plan',     key: 'survey.did.plan' },
      { value: 'cleanair', key: 'survey.did.cleanair' },
      { value: 'wound',    key: 'survey.did.wound' },
      { value: 'nothing',  key: 'survey.did.nothing' }
    ]));
    form.appendChild(q4);

    var q5 = fieldset('survey.f.q5');
    q5.appendChild(stepper('shared', 0, 500, 0));
    form.appendChild(q5);
  }

  // ---------- reading answers ----------
  function ticked(form, name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      function (i) { return i.value; });
  }
  function picked(form, name) {
    var i = form.querySelector('input[name="' + name + '"]:checked');
    return i ? i.value : '';
  }
  function num(form, name) {
    var i = form.querySelector('input[name="' + name + '"]');
    return i && i.value !== '' ? i.value : '';
  }

  /* A readiness box left unticked is ambiguous - "no" or "skipped the
     question"? It is recorded as 0 only if the person engaged with that
     question at all (ticked at least one box). An untouched question stays
     empty, so a skipped question never reads as "has nothing". */
  function readinessFields(form) {
    var have = ticked(form, 'have');
    if (!have.length) return {};
    function b(v) { return have.indexOf(v) !== -1 ? 1 : 0; }
    return { prep_water: b('water'), prep_air: b('air'), prep_plan: b('plan'), prep_firstaid: b('firstaid') };
  }

  function collect(form, phase) {
    var out = { prep_phase: phase };
    var r = readinessFields(form);
    Object.keys(r).forEach(function (k) { out[k] = r[k]; });
    var c = picked(form, 'confidence'); if (c) out.prep_confidence = c;

    if (phase === 'baseline') {
      var h = num(form, 'household'); if (h) out.household_size = h;
      var a = picked(form, 'age'); if (a) out.age_band = a;
      var hh = ticked(form, 'hh');
      if (hh.length) {
        ['older', 'child', 'disability', 'language'].forEach(function (k) {
          out['hh_' + k] = hh.indexOf(k) !== -1 ? 1 : 0;
        });
      }
    } else {
      var u = picked(form, 'useful'); if (u) out.useful = u;
      var did = ticked(form, 'did');
      if (did.length) {
        ['water', 'plan', 'cleanair', 'wound', 'nothing'].forEach(function (k) {
          out['did_' + k] = did.indexOf(k) !== -1 ? 1 : 0;
        });
      }
      var sh = num(form, 'shared'); if (sh !== '') out.shared_count = sh;
    }
    return out;
  }

  function answeredSomething(fields) {
    return Object.keys(fields).some(function (k) { return k !== 'prep_phase'; });
  }

  // ---------- after submitting ----------
  function thanks(host, phase, fields) {
    host.textContent = '';
    var h = el('h2', null, 'survey.thanks.h');
    h.id = 'survey-done-h';
    h.tabIndex = -1;
    host.appendChild(h);
    host.appendChild(el('p', null, phase === 'baseline' ? 'survey.thanks.b' : 'survey.thanks.f'));

    /* Answering should be useful to the person answering, not only to us: a
       gap they just admitted to gets a link to the page that closes it. */
    if (phase === 'baseline') {
      var gaps = [];
      if (fields.prep_air === 0) gaps.push({ href: 'clean-air.html', key: 'survey.fix.air' });
      if (fields.prep_plan === 0 || fields.prep_water === 0) gaps.push({ href: 'emergencies.html', key: 'survey.fix.plan' });
      if (fields.prep_firstaid === 0) gaps.push({ href: 'wound.html', key: 'survey.fix.firstaid' });
      if (gaps.length) {
        host.appendChild(el('p', 'sv-next', 'survey.next'));
        var ul = el('ul', 'sv-links');
        gaps.forEach(function (g) {
          var li = document.createElement('li');
          var a = el('a', null, g.key);
          a.href = g.href;
          li.appendChild(a); ul.appendChild(li);
        });
        host.appendChild(ul);
      }
    }
    host.hidden = false;
    h.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('survey');
    if (!box) return;

    var state = readState();
    var phase = phaseToAsk(state);
    if (!phase) return;                    // nothing to ask: stays hidden, no empty box

    var form = document.getElementById('survey-form');
    var qs = document.getElementById('survey-qs');
    var done = document.getElementById('survey-done');
    var err = document.getElementById('survey-err');

    document.getElementById('survey-h').setAttribute('data-i18n', phase === 'baseline' ? 'survey.b.h' : 'survey.f.h');
    document.getElementById('survey-sub').setAttribute('data-i18n', phase === 'baseline' ? 'survey.b.sub' : 'survey.f.sub');

    if (phase === 'baseline') buildBaseline(qs); else buildFollowup(qs);

    /* Shown only once the dictionary has loaded. I18N.init() fetches it
       asynchronously; revealing the box before then would flash a survey of
       blank labels. app.js exposes the load as I18N.ready for exactly this. */
    var ready = (global.I18N && global.I18N.ready) || Promise.resolve();
    ready.then(function () {
      if (global.I18N && global.I18N.apply) global.I18N.apply(box);
      box.hidden = false;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = collect(form, phase);
      if (!answeredSomething(fields)) {
        err.hidden = false;                // "answer at least one, or skip"
        return;
      }
      err.hidden = true;
      global.Track.send('prep_check', fields);

      var s = readState();
      if (phase === 'baseline') { s.baselineDone = Date.now(); s.baselineVisit = currentVisit(); }
      else { s.followupDone = Date.now(); }
      writeState(s);

      form.hidden = true;
      thanks(done, phase, fields);
    });

    document.getElementById('survey-skip').addEventListener('click', function () {
      var s = readState();
      if (phase === 'baseline') s.baselineSkipped = Date.now(); else s.followupSkipped = Date.now();
      writeState(s);
      global.Track.send('prep_skipped', { prep_phase: phase });
      box.hidden = true;
    });
  });
}(window));
