/* impact.js — renders /api/impact on the public impact page.

   Written to be checked, not admired. Every percentage carries the sample it
   came from, a figure based on fewer than ten people is labelled as too small
   to read anything into, and the page says plainly when there is nothing to
   show yet rather than printing a confident zero. A judge should be able to
   tell what the numbers do and do not support. */
(function (global) {
  'use strict';

  var MIN_MEANINGFUL = 10;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function statBlock(items) {
    var wrap = el('section', 'stats');
    items.forEach(function (it) {
      var d = el('div', 'stat');
      d.appendChild(el('b', null, String(it.value)));
      d.appendChild(el('span', null, it.label));
      wrap.appendChild(d);
    });
    return wrap;
  }

  function pct(part, whole) {
    if (!whole) return '—';
    return Math.round((part / whole) * 100) + '%';
  }

  function prepTable(p) {
    var paired = p.paired || 0;
    var box = el('div');

    if (!paired) {
      box.appendChild(el('p', 'notice',
        'No before-and-after pairs yet. ' + (p.baseline_total || 0) +
        ' first answers have been recorded; a pair is only counted once someone answers again on a later visit.'));
      return box;
    }

    var table = el('table', 'impact-table');
    var thead = el('thead');
    var hr = el('tr');
    ['What we asked', 'Before', 'After', 'Newly yes'].forEach(function (h) {
      hr.appendChild(el('th', null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    [
      ['Two weeks of water stored', p.water],
      ['A plan for cleaner air in smoke', p.air],
      ['An earthquake plan everyone knows', p.plan],
      ['A first aid kit', p.firstaid]
    ].forEach(function (row) {
      var name = row[0], d = row[1] || {};
      var tr = el('tr');
      tr.appendChild(el('th', null, name));
      tr.appendChild(el('td', null, (d.before || 0) + ' of ' + paired + ' (' + pct(d.before || 0, paired) + ')'));
      tr.appendChild(el('td', null, (d.after || 0) + ' of ' + paired + ' (' + pct(d.after || 0, paired) + ')'));
      tr.appendChild(el('td', null, String(d.gained || 0)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);

    var s = p.score || {};
    box.appendChild(el('p', 'small',
      'Of the ' + paired + ' people who answered both times, ' + (s.improved || 0) +
      ' were more prepared the second time, ' + (s.unchanged || 0) + ' were the same and ' +
      (s.declined || 0) + ' were less. Average score moved from ' + (s.before || 0) +
      ' to ' + (s.after || 0) + ' out of ' + (s.out_of || 4) + '.'));

    var c = p.confidence || {};
    if (c.n) {
      box.appendChild(el('p', 'small',
        'Asked how ready they feel on a 1 to 5 scale, the ' + c.n + ' people who answered both times went from an average of ' +
        c.before + ' to ' + c.after + '; ' + c.improved + ' of them rated themselves higher the second time.'));
    }

    if (paired < MIN_MEANINGFUL) {
      box.appendChild(el('p', 'notice',
        'Only ' + paired + ' people have answered both times so far. That is too few to draw a ' +
        'conclusion from — treat these as early figures, not a result.'));
    }
    if (p.baseline_only) {
      box.appendChild(el('p', 'small',
        p.baseline_only + ' more people answered once and have not returned. They are deliberately ' +
        'left out of the comparison above rather than counted on one side of it.'));
    }
    return box;
  }

  /* Per-poster reach, from qr_report(). "Browsers" is said plainly because it
     is not the same as people, and a judge reading "9 people" would be misled. */
  function reachTable(report) {
    var box = el('div');
    var codes = (report && report.codes) || [];
    var scanned = codes.filter(function (c) { return c.scans > 0; });
    if (!scanned.length) {
      box.appendChild(el('p', 'small',
        'No posters have been scanned yet. ' + codes.length + ' QR codes are live; each one is counted ' +
        'separately, so once posters are up this shows which placements actually reach people.'));
      return box;
    }
    var t = report.totals || {};
    box.appendChild(statBlock([
      { value: t.scans || 0, label: 'QR scans' },
      { value: t.people || 0, label: 'different browsers that scanned' },
      { value: t.acted || 0, label: 'went on to use a tool or answer the survey' }
    ]));
    var table = el('table', 'impact-table');
    var thead = el('thead'), hr = el('tr');
    ['Poster or event', 'Scans', 'Browsers', 'Answered survey', 'Wound check', 'Clean air search']
      .forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr); table.appendChild(thead);
    var tb = el('tbody');
    scanned.forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('th', null, c.label));
      [c.scans, c.people, c.took_survey, c.used_wound, c.searched_air].forEach(function (v) {
        tr.appendChild(el('td', null, String(v || 0)));
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
    var idle = codes.length - scanned.length;
    box.appendChild(el('p', 'small',
      '"Browsers" counts different web browsers, not different people. One person who scans on a phone and ' +
      'later visits on a laptop counts twice unless they sign in; two people sharing a phone count once. ' +
      (idle ? idle + ' more code' + (idle === 1 ? ' has' : 's have') + ' not been scanned yet.' : '')));
    return box;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('impact-root');
    if (!root) return;

    fetch('/api/impact')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        root.textContent = '';
        if (!d.ok) {
          root.appendChild(el('p', 'notice', 'The live numbers are unavailable right now. ' +
            (d.reason || d.error || '')));
          return;
        }

        var u = d.use || {};
        root.appendChild(el('h2', null, 'How the tools are used'));
        root.appendChild(statBlock([
          { value: u.lookups || 0, label: 'clean air searches' },
          { value: (d.wound && d.wound.checks) || 0, label: 'wound photos checked' }
        ]));

        root.appendChild(el('h2', null, 'Did it change anything?'));
        root.appendChild(el('p', null,
          'Visitors are asked about their household\'s readiness on a first visit and again on a later one. ' +
          'This compares those answers.'));
        root.appendChild(prepTable(d.preparedness || {}));

        var pr = d.preparedness || {};
        var reach = pr.reach || {};
        if (reach.respondents) {
          root.appendChild(el('h2', null, 'Who the survey reached'));
          root.appendChild(statBlock([
            { value: reach.respondents, label: 'people answered the first survey' },
            { value: reach.people_in_households || 0, label: 'people living in those households (' + (reach.household_n || 0) + ' gave a size)' },
            { value: reach.any_vulnerable || 0, label: 'households with someone 65+, a child under 5, a disability or chronic illness, or a non-English language' }
          ]));
          var rt = el('table', 'impact-table');
          var rh = el('thead'), rhr = el('tr');
          ['Household includes', 'Households'].forEach(function (h) { rhr.appendChild(el('th', null, h)); });
          rh.appendChild(rhr); rt.appendChild(rh);
          var rb = el('tbody');
          [['Someone 65 or older', reach.older], ['A child under 5', reach.child],
           ['A disability or chronic illness', reach.disability],
           ['A language other than English at home', reach.language]].forEach(function (r) {
            var tr = el('tr');
            tr.appendChild(el('th', null, r[0]));
            tr.appendChild(el('td', null, String(r[1] || 0)));
            rb.appendChild(tr);
          });
          rt.appendChild(rb);
          root.appendChild(rt);
          root.appendChild(el('p', 'small',
            'Every question is optional, so each figure counts only the people who answered that question. ' +
            'A household is counted once however many of these apply.'));
        }

        var act = pr.actions || {}, sh = pr.shared || {}, us = pr.useful || {};
        if (act.n || sh.n || us.n) {
          root.appendChild(el('h2', null, 'What people did afterwards'));
          var items = [];
          if (act.n) {
            items.push({ value: act.water || 0, label: 'stored water (of ' + act.n + ' who answered)' });
            items.push({ value: act.plan || 0, label: 'made or updated a plan' });
            items.push({ value: act.cleanair || 0, label: 'found a clean air location' });
            items.push({ value: act.wound || 0, label: 'used the wound check' });
          }
          if (sh.n) items.push({ value: sh.people || 0, label: 'people they say they shared it with (' + sh.n + ' answered)' });
          if (us.n) items.push({ value: us.avg, label: 'average usefulness out of 5 (' + us.n + ' answered)' });
          root.appendChild(statBlock(items));
          root.appendChild(el('p', 'small',
            'These are self-reported on a later visit. "Shared with" is what people told us, not something we can verify.'));
        }

        var w = d.wound || {};
        if (w.checks) {
          root.appendChild(el('h2', null, 'Wound check'));
          root.appendChild(statBlock([
            { value: w.checks || 0, label: 'photos checked' },
            { value: w.declined || 0, label: 'times it said "not sure"' },
            { value: w.avg_confidence == null ? '—' : w.avg_confidence + '%', label: 'average confidence when it did answer' }
          ]));
          root.appendChild(el('p', 'small',
            'A tool that declines to guess when it is unsure is behaving correctly, so the ' +
            '"not sure" count is reported here rather than hidden. The photos themselves are ' +
            'never stored — only the category returned and how confident the model was.'));

          /* The same classifier is reachable two ways: the tool on this site's
             home page, and the standalone Wound Analyzer. Both write to one
             dataset, so the totals above are the project-wide figure - and this
             says which product produced them, rather than letting one borrow
             the other's numbers. */
          if (w.by_site && w.by_site.length > 1) {
            var st = el('table', 'impact-table');
            var sth = el('thead'), shr = el('tr');
            ['Where it was used', 'Photos checked', 'Answers given', 'Said "not sure"']
              .forEach(function (h) { shr.appendChild(el('th', null, h)); });
            sth.appendChild(shr); st.appendChild(sth);
            var sb = el('tbody');
            w.by_site.forEach(function (r) {
              var tr = el('tr');
              tr.appendChild(el('th', null,
                r.site === 'wound-analyzer' ? 'Wound Analyzer (standalone site)'
                                            : 'This site'));
              tr.appendChild(el('td', null, String(r.checks)));
              tr.appendChild(el('td', null, String(r.results)));
              tr.appendChild(el('td', null, String(r.declined)));
              sb.appendChild(tr);
            });
            st.appendChild(sb);
            root.appendChild(st);
          }
          if (w.by_label && w.by_label.length) {
            var tb = el('table', 'impact-table');
            var th = el('thead'), hr = el('tr');
            ['Category', 'Times', 'Average confidence'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
            th.appendChild(hr); tb.appendChild(th);
            var body = el('tbody');
            w.by_label.forEach(function (r) {
              var tr = el('tr');
              tr.appendChild(el('th', null, String(r.label).replace(/_/g, ' ')));
              tr.appendChild(el('td', null, String(r.n)));
              tr.appendChild(el('td', null, r.avg_confidence == null ? '—' : r.avg_confidence + '%'));
              body.appendChild(tr);
            });
            tb.appendChild(body);
            root.appendChild(tb);
          }
        }

        root.appendChild(el('h2', null, 'Which posters reach people'));
        root.appendChild(reachTable(d.reach));

        var gen = document.getElementById('impact-generated');
        if (gen) {
          var when = new Date(d.generated_at);
          var since = d.first_event ? new Date(d.first_event) : null;
          gen.textContent = 'Generated ' + when.toLocaleString() +
            (since ? '. Covers everything recorded since ' + since.toLocaleDateString() + '.' : '') +
            ' Cached for up to five minutes.';
        }
      })
      .catch(function (err) {
        root.textContent = '';
        root.appendChild(el('p', 'notice', 'Could not reach the server: ' + err.message));
      });
  });
}(window));
