/* prep.js — the three-question preparedness check on the landing page.

   Why it exists: a scan count says how many people saw a poster. It does not
   say whether anything changed. Asking the same three questions on a first
   visit and again on a later one turns "500 scans" into "this many households
   that had no water stored now do", which is the only honest way to describe
   impact.

   Two rules shape everything here:

   1. It is never in the way. Emergency content is above it and opens with no
      network request; this is below that, skippable, and never shown twice in
      a session. A skip is remembered and respected.

   2. It is not just measurement. Every "Not yet" answer is followed by a link
      to the tool that fixes exactly that gap, so answering is useful to the
      person answering, not only to us.

   Nothing personal is stored: three zeros and ones against the same random
   local id the rest of the site already uses. */
(function (global) {
  'use strict';

  var KEY = 'mrcm_prep';
  // A follow-up only makes sense once someone has had time to act on it.
  var MIN_HOURS_BEFORE_FOLLOWUP = 20;

  var QUESTIONS = [
    { name: 'water', fixKey: 'prep.fix.water', href: 'kit.html' },
    { name: 'air',   fixKey: 'prep.fix.air',   href: 'clean-air.html' },
    { name: 'plan',  fixKey: 'prep.fix.plan',  href: 'earthquake.html' }
  ];

  function t(k, v) { return (global.I18N && global.I18N.t) ? global.I18N.t(k, v) : k; }

  function readState() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeState(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  /* Which phase, if any, to ask for. Returns '' to stay hidden. */
  function phaseToAsk(state) {
    if (state.skipped && !state.baselineAt) return '';       // asked once, declined
    if (!state.baselineAt) return 'baseline';
    if (state.followupAt) return '';                          // both halves collected
    var visits = 1;
    try { visits = parseInt(global.localStorage.getItem('mrcm_seen') || '1', 10); } catch (e) {}
    if (visits < 2) return '';
    var hours = (Date.now() - state.baselineAt) / 36e5;
    if (hours < MIN_HOURS_BEFORE_FOLLOWUP) return '';
    return 'followup';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('prep');
    if (!box) return;

    var state = readState();
    var phase = phaseToAsk(state);
    if (!phase) return;

    var form = document.getElementById('prep-form');
    var done = document.getElementById('prep-done');
    var err = document.getElementById('prep-err');

    if (phase === 'followup') {
      /* Swap the translation KEYS, not the text. I18N.apply reads data-i18n
         attributes, so setting textContent here would be overwritten the moment
         translations load or the visitor switches language. */
      document.getElementById('prep-h').setAttribute('data-i18n', 'prep.h_again');
      document.getElementById('prep-sub').setAttribute('data-i18n', 'prep.sub_again');
      var relabel = function () {
        if (global.I18N && global.I18N.apply) global.I18N.apply(box);
      };
      if (global.I18N && global.I18N.ready) global.I18N.ready.then(relabel, relabel);
      else relabel();
    }
    box.hidden = false;

    function finish(answers) {
      var score = answers.water + answers.air + answers.plan;
      global.Track.send('prep_check', {
        prep_phase: phase,
        prep_water: answers.water,
        prep_air: answers.air,
        prep_plan: answers.plan,
        prep_score: score
      });

      var next = readState();
      next[phase === 'baseline' ? 'baselineAt' : 'followupAt'] = Date.now();
      writeState(next);

      /* The useful half: point each gap at the tool that closes it. */
      form.hidden = true;
      done.textContent = '';
      done.appendChild(el('p', 'prep-thanks', t('prep.thanks')));

      var gaps = QUESTIONS.filter(function (q) { return answers[q.name] === 0; });
      if (gaps.length) {
        done.appendChild(el('p', 'small', t('prep.next')));
        var ul = el('ul', 'prep-fixes');
        gaps.forEach(function (q) {
          var li = el('li');
          var a = el('a', null, t(q.fixKey));
          a.href = q.href;
          li.appendChild(a);
          ul.appendChild(li);
        });
        done.appendChild(ul);
      } else {
        done.appendChild(el('p', 'prep-allset', t('prep.allset')));
      }
      done.hidden = false;
      document.getElementById('prep-h').focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var answers = {};
      var missing = false;
      QUESTIONS.forEach(function (q) {
        var picked = form.querySelector('input[name="' + q.name + '"]:checked');
        if (!picked) { missing = true; return; }
        answers[q.name] = parseInt(picked.value, 10);
      });
      if (missing) { err.hidden = false; return; }
      err.hidden = true;
      finish(answers);
    });

    document.getElementById('prep-skip').addEventListener('click', function () {
      var next = readState();
      next.skipped = true;
      writeState(next);
      global.Track.send('prep_skipped', { prep_phase: phase });
      box.hidden = true;
    });
  });
}(window));
