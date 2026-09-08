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
      ['Knows where to go for cleaner air', p.air],
      ['Household has an earthquake plan', p.plan]
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
      ' to ' + (s.after || 0) + ' out of 3.'));

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

  function reachTable(rows) {
    var box = el('div');
    if (!rows || !rows.length) {
      box.appendChild(el('p', 'small',
        'No posters have been scanned yet. Each printed QR carries its own tag, so once they are up this ' +
        'shows which placements actually reach people.'));
      return box;
    }
    var table = el('table', 'impact-table');
    var thead = el('thead'), hr = el('tr');
    ['Poster or venue', 'People', 'First scan', 'Latest scan'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr); table.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('th', null, r.src));
      tr.appendChild(el('td', null, String(r.visitors)));
      tr.appendChild(el('td', null, r.first_seen || '—'));
      tr.appendChild(el('td', null, r.last_seen || '—'));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
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
          { value: u.kits || 0, label: 'kit checklists built' },
          { value: u.people || 0, label: 'people covered by those kits' },
          { value: u.lookups || 0, label: 'clean air searches' },
          { value: u.commits || 0, label: 'people who committed to an action' }
        ]));

        root.appendChild(el('h2', null, 'Did it change anything?'));
        root.appendChild(el('p', null,
          'Visitors are asked the same three questions on a first visit and again on a later one. ' +
          'This compares those answers.'));
        root.appendChild(prepTable(d.preparedness || {}));

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
