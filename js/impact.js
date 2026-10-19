/* impact.js — the dashboard at /impact.html, rendered from /api/impact.

   WHO THIS IS FOR
   Three readers, in this order: an MRC coordinator deciding where the next
   poster goes, a HOSA judge deciding whether this project did anything, and
   us. All three want the same thing first - the headline numbers - and only
   then the working behind them. So the page opens with a strip of totals and
   then explains itself downward.

   Written to be checked, not admired:
   - Every percentage carries the sample it came from.
   - Anything resting on fewer than MIN_MEANINGFUL people is labelled as too
     small to read anything into, rather than presented as a result.
   - An empty section says it is empty. It never prints a confident zero.
   - Charts never carry a number the text does not also state, because a bar
     cannot be read out by a screen reader or quoted in a report.

   Charts are hand-built SVG on purpose. A charting library would be a
   third-party request on a site that promises none, and this needs five shapes,
   not a framework. */
(function (global) {
  'use strict';

  // Below this many people, a percentage is noise. Say so rather than draw it.
  var MIN_MEANINGFUL = 10;

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function pct(part, whole) {
    if (!whole) return '—';
    return Math.round((part / whole) * 100) + '%';
  }

  function plural(n, one, many) {
    return n === 1 ? one : (many || one + 's');
  }

  // ---------- layout pieces ----------

  function card(title, hint) {
    var c = el('section', 'dash-card');
    if (title) {
      var head = el('div', 'dash-head');
      head.appendChild(el('h2', null, title));
      c.appendChild(head);
    }
    if (hint) c.appendChild(el('p', 'dash-hint', hint));
    return c;
  }

  /* The strip at the top. Each tile is one number a coordinator would quote,
     with the unit spelled out underneath - "12 scans", not "12". */
  function kpiStrip(items) {
    var wrap = el('div', 'kpi-grid');
    items.forEach(function (it) {
      var t = el('div', 'kpi' + (it.muted ? ' is-muted' : ''));
      t.appendChild(el('div', 'kpi-num', String(it.value)));
      t.appendChild(el('div', 'kpi-label', it.label));
      if (it.sub) t.appendChild(el('div', 'kpi-sub', it.sub));
      wrap.appendChild(t);
    });
    return wrap;
  }

  /* Horizontal bars. Rows carry their own number as text beside the bar, so
     the chart is a visual aid to a figure that is already written down. */
  function hbars(rows, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([opts.min || 1]));
    var list = el('div', 'bars');
    rows.forEach(function (r) {
      var row = el('div', 'bar-row' + (r.value ? '' : ' is-zero'));
      row.appendChild(el('div', 'bar-label', r.label));
      var track = el('div', 'bar-track');
      var fill = el('span', 'bar-fill' + (r.tone ? ' tone-' + r.tone : ''));
      /* A row carrying its own denominator is drawn as a share of that
         denominator, not against the biggest count in the set. Questions are
         optional, so "3 of 5" and "4 of 7" have different bases, and scaling
         both against 4 would draw the larger share as the shorter bar. */
      fill.style.width = (r.of ? (r.value / r.of) * 100
                               : (max ? (r.value / max) * 100 : 0)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'bar-value', opts.fmt ? opts.fmt(r) : String(r.value)));
      list.appendChild(row);
    });
    return list;
  }

  /* Before/after pairs, drawn as two bars per question. The table underneath
     carries the same numbers - this is the picture, not the record. */
  function pairChart(rows) {
    var W = 320, rowH = 46, pad = 4;
    var H = rows.length * rowH + pad;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.before, r.after); }).concat([1]));
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart chart-pair',
      preserveAspectRatio: 'none', role: 'img',
      'aria-label': rows.map(function (r) {
        return r.label + ': ' + r.before + ' before, ' + r.after + ' after';
      }).join('. ')
    });
    rows.forEach(function (r, i) {
      var y = i * rowH + pad;
      [['before', r.before, 0], ['after', r.after, 15]].forEach(function (p) {
        var w = max ? (p[1] / max) * (W - 4) : 0;
        svg.appendChild(svgEl('rect', {
          x: 0, y: y + p[2], width: Math.max(w, p[1] ? 2 : 0), height: 11, rx: 3,
          class: 'pair-' + p[0]
        }));
      });
    });
    return svg;
  }

  /* 24 bars, one per hour. Answers "when do people actually scan the poster",
     which decides when a table is worth staffing. */
  function hourChart(byHour) {
    var counts = [];
    var max = 0;
    for (var h = 0; h < 24; h++) {
      var v = byHour[h] || byHour[String(h)] || 0;
      counts.push(v);
      if (v > max) max = v;
    }
    var wrap = el('div', 'hours');
    var chart = el('div', 'hours-bars');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', counts.map(function (v, i) {
      return v ? v + ' at ' + i + ':00' : null;
    }).filter(Boolean).join(', ') || 'No scans yet');
    counts.forEach(function (v, i) {
      var b = el('div', 'hour' + (v ? '' : ' is-zero'));
      b.style.height = max ? Math.max((v / max) * 100, 6) + '%' : '6%';
      b.title = i + ':00 — ' + v + ' ' + plural(v, 'scan');
      chart.appendChild(b);
    });
    wrap.appendChild(chart);
    var ax = el('div', 'hours-axis');
    ['12am', '6am', '12pm', '6pm', '11pm'].forEach(function (l) { ax.appendChild(el('span', null, l)); });
    wrap.appendChild(ax);
    return wrap;
  }

  function tableOf(headers, rows) {
    var table = el('table', 'impact-table');
    var thead = el('thead'), hr = el('tr');
    headers.forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (c, i) {
        var cell = el(i === 0 ? 'th' : 'td', null, String(c));
        if (i === 0) cell.setAttribute('scope', 'row');
        tr.appendChild(cell);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return table;
  }

  function smallSampleNote(n, what) {
    return el('p', 'notice',
      'Only ' + n + ' ' + plural(n, 'person', 'people') + ' ' + what +
      ' so far. That is too few to draw a conclusion from — treat these as early figures, not a result.');
  }

  // ---------- the sections ----------

  /* Posters first. Since the flyers went out this is the number that decides
     what the team does next, and it is the one thing on the page that can be
     acted on the same week. */
  function postersCard(reach) {
    var c = card('Which posters reach people',
      'Every scan is counted on the server as it happens, so a scan still counts when the page then fails to load.');
    var codes = (reach && reach.codes) || [];
    var totals = (reach && reach.totals) || { scans: 0, people: 0, acted: 0 };

    if (!totals.scans) {
      c.appendChild(el('p', 'notice',
        'No scans recorded yet. ' + codes.filter(function (k) { return k.active; }).length +
        ' codes are live and waiting; a scan appears here within seconds of the first one.'));
      return c;
    }

    c.appendChild(kpiStrip([
      { value: totals.scans, label: plural(totals.scans, 'scan') },
      { value: totals.people, label: 'different browsers', sub: 'our best proxy for people' },
      { value: totals.acted, label: 'went on to use a tool' }
    ]));

    var scanned = codes.filter(function (k) { return k.scans > 0; })
      .sort(function (a, b) { return b.scans - a.scans; });
    var unscanned = codes.filter(function (k) { return !k.scans; });

    if (scanned.length) {
      c.appendChild(hbars(scanned.map(function (k) {
        return { label: k.label, value: k.scans };
      }), { fmt: function (r) { return r.value + ' ' + plural(r.value, 'scan'); } }));
    }
    if (unscanned.length) {
      c.appendChild(el('p', 'dash-note',
        'No scans yet from: ' + unscanned.map(function (k) { return k.label; }).join(', ') + '.'));
    }

    var hours = (reach && reach.by_hour) || {};
    if (Object.keys(hours).length) {
      c.appendChild(el('h3', 'dash-sub', 'When people scan'));
      c.appendChild(hourChart(hours));
    }

    var wd = (reach && reach.by_weekday) || {};
    var wdRows = Object.keys(wd).map(function (k) {
      return { label: WEEKDAYS[Number(k)] || ('Day ' + k), value: wd[k] };
    }).sort(function (a, b) { return b.value - a.value; });
    if (wdRows.length) {
      c.appendChild(el('h3', 'dash-sub', 'Which days'));
      c.appendChild(hbars(wdRows));
    }

    c.appendChild(el('p', 'dash-note',
      '"Different browsers" is not the same as different people: one person using a phone and a ' +
      'laptop counts twice, and a shared computer counts once. It is the closest honest count we have ' +
      'without tracking anybody.'));
    return c;
  }

  /* The survey is asked once, so this is a snapshot of how households were
     found - not a before/after comparison. Each item carries its OWN
     denominator: people may answer the confidence question and skip the
     checklist, and "4 of 7" is the honest way to say that. */
  function readinessCard(p) {
    var total = p.responses || 0;
    var c = card('How ready people are',
      'From the one survey on the home page, answered once per browser. It describes households ' +
      'as people reported them, not change over time.');

    if (!total) {
      c.appendChild(el('p', 'notice', 'No survey answers yet.'));
      return c;
    }

    var have = p.have || {};
    var rows = [
      { label: 'Two weeks of water stored', d: have.water },
      { label: 'A plan for cleaner air in smoke', d: have.air },
      { label: 'An earthquake plan everyone knows', d: have.plan },
      { label: 'A first aid kit', d: have.firstaid }
    ].filter(function (r) { return r.d && r.d.n; });

    if (rows.length) {
      c.appendChild(hbars(rows.map(function (r) {
        return { label: r.label, value: r.d.yes || 0, of: r.d.n };
      }), { fmt: function (x) { return x.value + ' of ' + x.of; } }));
    }

    var sc = p.score || {};
    if (sc.n) {
      var d = el('p', 'dash-figure');
      d.appendChild(el('b', null, String(sc.avg)));
      d.appendChild(document.createTextNode(
        ' of ' + sc.out_of + ' items in place on average, across ' + sc.n + ' ' +
        plural(sc.n, 'answer', 'answers') + '. ' + sc.none + ' had none of the four, ' +
        sc.all + ' had all four.'));
      c.appendChild(d);
    }

    var conf = p.confidence || {};
    if (conf.n) {
      var cf = el('p', 'dash-figure');
      cf.appendChild(el('b', null, String(conf.avg)));
      cf.appendChild(document.createTextNode(
        ' average on the 1-to-5 "how prepared do you feel" question, from ' + conf.n + ' ' +
        plural(conf.n, 'person', 'people') + '. ' + conf.low + ' rated themselves 2 or below, ' +
        conf.high + ' rated 4 or above.'));
      c.appendChild(cf);
    }

    if (total < MIN_MEANINGFUL) c.appendChild(smallSampleNote(total, 'answered the survey'));
    return c;
  }

  function reachCard(r) {
    var c = card('Who the survey reached',
      'Every question is optional, so each figure counts only the people who answered that one.');
    if (!r || !r.respondents) {
      c.appendChild(el('p', 'notice', 'Nobody has answered the survey yet.'));
      return c;
    }
    c.appendChild(kpiStrip([
      { value: r.respondents, label: 'answered the first survey' },
      { value: r.people_in_households, label: 'people in those households', sub: r.household_n + ' gave a size' },
      { value: r.any_vulnerable, label: 'households with someone at higher risk' }
    ]));

    c.appendChild(el('h3', 'dash-sub', 'Households including someone at higher risk'));
    c.appendChild(hbars([
      { label: 'Someone 65 or older', value: r.older || 0 },
      { label: 'A child under 5', value: r.child || 0 },
      { label: 'A disability or chronic illness', value: r.disability || 0 },
      { label: 'A language other than English at home', value: r.language || 0 }
    ], { fmt: function (x) { return x.value + ' of ' + r.respondents; } }));
    c.appendChild(el('p', 'dash-note',
      'A household is counted once here however many of these apply, which is why the four rows do not ' +
      'add up to ' + r.any_vulnerable + '.'));

    var ages = r.age || {};
    var ageRows = ['under18', '18-39', '40-64', '65plus', 'na'].map(function (k) {
      return { label: { under18: 'Under 18', '18-39': '18 to 39', '40-64': '40 to 64', '65plus': '65 or older', na: 'Preferred not to say' }[k], value: ages[k] || 0 };
    }).filter(function (x) { return x.value; });
    if (ageRows.length) {
      c.appendChild(el('h3', 'dash-sub', 'Age of the person answering'));
      c.appendChild(hbars(ageRows));
    }
    return c;
  }


  function woundCard(w) {
    if (!w || !w.checks) return null;
    var c = card('Wound check',
      'The classifier answers "not sure" rather than guessing when it is not confident, so a high ' +
      '"not sure" count is the tool working as designed.');
    c.appendChild(kpiStrip([
      { value: w.checks, label: 'photos checked' },
      { value: w.declined, label: 'times it said "not sure"' },
      { value: w.avg_confidence ? w.avg_confidence + '%' : '—', label: 'average confidence when it answered' },
      { value: w.failed || 0, label: 'failed to process', muted: true }
    ]));

    var labels = (w.by_label || []).filter(function (x) { return x.n; });
    if (labels.length) {
      c.appendChild(el('h3', 'dash-sub', 'What it reported'));
      c.appendChild(hbars(labels.map(function (x) {
        return {
          label: x.label === 'unknown' ? 'Not sure' : x.label.replace(/_/g, ' '),
          value: x.n,
          tone: x.label === 'unknown' ? 'flat' : ''
        };
      }), { fmt: function (r) { return r.value + ' of ' + w.results; } }));
    }

    var sites = (w.by_site || []).filter(function (s) { return s.checks; });
    if (sites.length > 1) {
      c.appendChild(el('h3', 'dash-sub', 'Where it was used'));
      c.appendChild(tableOf(['Front end', 'Checks', 'Answered', 'Not sure'], sites.map(function (s) {
        return [s.site === 'wound-analyzer' ? 'Standalone analyzer' : 'MRC Miracle', s.checks, s.results, s.declined];
      })));
    }
    if (w.checks < MIN_MEANINGFUL) c.appendChild(smallSampleNote(w.checks, 'have used the wound check'));
    return c;
  }

  /* Which parts of the site people actually open, and how many of those
     arrivals carried a poster code. Pages that no longer exist still appear
     while they have history - the checklist and the old split smoke and
     earthquake pages - so the totals stay honest rather than quietly dropping
     traffic that really happened. */
  var SECTION_NAMES = {
    'index.html': 'Home',
    'wound.html': 'Wound first aid guide',
    'clean-air.html': 'Clean air',
    'emergencies.html': 'Emergencies',
    'impact.html': 'Impact',
    'privacy.html': 'Privacy',
    '404.html': 'Page not found',
    'standalone': 'Standalone wound analyzer',
    'kit.html': 'Checklist (retired)',
    'smoke.html': 'Smoke page (retired)',
    'earthquake.html': 'Earthquake page (retired)'
  };

  function sectionsCard(rows) {
    if (!rows || !rows.length) return null;
    var c = card('Which parts of the site get used',
      'Every page view, counted anonymously. "From a poster" means the visit arrived carrying a QR code.');
    var total = rows.reduce(function (n, r) { return n + (r.views || 0); }, 0);
    var fromQr = rows.reduce(function (n, r) { return n + (r.from_qr || 0); }, 0);
    c.appendChild(kpiStrip([
      { value: total, label: 'page views' },
      { value: fromQr, label: 'arrived from a poster' }
    ]));
    c.appendChild(hbars(rows.map(function (r) {
      return {
        label: SECTION_NAMES[r.page] || r.page,
        value: r.views || 0,
        tone: /retired/.test(SECTION_NAMES[r.page] || '') ? 'flat' : ''
      };
    }), { fmt: function (x) { return x.value + ' views'; } }));
    c.appendChild(el('p', 'dash-note',
      'Counted by this site itself, with no third party involved. Vercel Web Analytics counts page ' +
      'views separately in the Vercel dashboard; the two will not match exactly, because they start ' +
      'counting at different moments and this one ignores the coordinator page.'));
    return c;
  }

  function usageCard(u) {
    var rows = [
      { label: 'Clean air searches', value: u.lookups || 0 },
      { label: 'Preparedness plans started', value: u.kits || 0 },
      { label: 'Actions committed to', value: u.commits || 0 }
    ].filter(function (r) { return r.value; });
    if (!rows.length) return null;
    var c = card('Everything else the site was used for');
    c.appendChild(hbars(rows));
    return c;
  }

  // ---------- assembly ----------

  function render(root, d) {
    root.textContent = '';

    var reach = d.reach || {};
    var totals = reach.totals || {};
    var p = d.preparedness || {};
    var w = d.wound || {};

    root.appendChild(kpiStrip([
      { value: totals.scans || 0, label: 'poster scans' },
      { value: p.responses || 0, label: 'survey responses' },
      { value: w.checks || 0, label: 'wound photos checked' },
      { value: (d.use && d.use.lookups) || 0, label: 'clean air searches' },
      { value: (reach.codes || []).filter(function (k) { return k.active; }).length, label: 'codes in circulation' }
    ]));

    [postersCard(reach), readinessCard(p), reachCard(p.reach), woundCard(w),
     sectionsCard(d.sections), usageCard(d.use || {})]
      .filter(Boolean)
      .forEach(function (section) { root.appendChild(section); });
  }

  function stamp(d) {
    var out = document.getElementById('impact-generated');
    if (!out) return;
    var since = d.first_event ? new Date(d.first_event) : null;
    var made = d.generated_at ? new Date(d.generated_at) : new Date();
    var opts = { year: 'numeric', month: 'long', day: 'numeric' };
    out.textContent = 'Counting everything since ' +
      (since ? since.toLocaleDateString(undefined, opts) : 'the site went live') +
      '. Figures read at ' + made.toLocaleString() + '.';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('impact-root');
    if (!root) return;
    fetch('/api/impact', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) throw new Error('bad payload');
        render(root, d);
        stamp(d);
      })
      .catch(function (err) {
        // Say what happened. A dashboard that silently shows nothing reads as
        // "no impact", which is a different and much worse claim.
        console.warn('[impact] ' + err.message);
        root.textContent = '';
        root.appendChild(el('p', 'notice',
          'The live numbers could not be loaded just now. This is a problem with fetching them, ' +
          'not a report of zero. Refresh in a moment.'));
      });
  });

  global.Impact = { render: render };
}(window));
