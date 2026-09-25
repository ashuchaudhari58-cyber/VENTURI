/* RESULTS — engineering decision summary. Every value comes from design.METRICS
 * (the single registry) over the authoritative design state. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, DS = VJP.design;
  VJP.pages = VJP.pages || {};
  var filterQ = '';

  // compact criterion statement, always naming the checked quantity (e.g. "d_th/d_p,max ≥ 5")
  function reqShort(k, f) {
    if (!k) return '';
    var q = k.req; if (!q) return '';
    function v(x) { return k.sci ? U.sci(x, 2) : f.v(x, q.dim, 3); }
    var u = f.u(q.dim), s = k.sym;   // markup — rendered with S.symHTML
    if (q.min !== undefined && q.max !== undefined) return s + ' ' + v(q.min) + '–' + v(q.max) + (u ? ' ' + u : '');
    if (q.min !== undefined) return s + ' ' + (q.op || '≥') + ' ' + (q.sym ? q.sym + ' ' : '') + v(q.min) + (u ? ' ' + u : '');
    if (q.max !== undefined) return s + ' ≤ ' + (q.sym ? q.sym + ' ' : '') + v(q.max) + (u ? ' ' + u : '');
    return '';
  }
  function contextLine(id, D, f) {
    var R = D.R;
    switch (id) {
      case 'd_th': return R.throat.d_th_p >= R.throat.d_th_h ? 'Governed by particle passage (d_th,p)' : 'Governed by hydraulic sizing (d_n,sel / r)';
      case 'L_th': return 'k_th × d_th = ' + U.fmt(R.inputs.k_th, 3) + ' × ' + f.q(R.throat.d_th, 'len_mm');
      case 'd_n_sel': return 'd_n × ' + U.fmt(R.inputs.nozzleExitFactor, 3) + ' (empirical bore factor)';
      case 'd_diff': return 'Return pipe bore ' + f.q(R.inputs.dischargeID, 'len_mm');
      case 'P_hyd': return 'Q_m · ΔP at ' + f.q(R.motive.dP_nozzle / 1e5, 'pressure_bar');
      case 'Re': return R.friction.regime + ' flow, return pipe';
      case 'Qd': return 'Q_m + Q_s = ' + f.q(R.inputs.Qm_Lmin, 'flow_Lmin') + ' + ' + f.q(R.operating.Qs_Lmin, 'flow_Lmin');
      case 'Cr': return 'Ideal estimate; typical 0.70–0.90';
      default: return '';
    }
  }

  function banner(c) {
    var D = c.D, s = D.status, store = c.store, integ = VJP.test ? VJP.test.run() : null;
    var el = h('div', { class: 'banner big ' + s.tone, role: 'status' });
    el.appendChild(h('div', { class: 'bn-ic', html: icon(s.state === 'blocked' ? 'blocked' : s.tone === 'pass' ? 'check' : s.tone === 'fail' ? 'x' : 'alert') }));
    el.appendChild(h('div', null,
      h('div', { class: 'bn-t', text: s.title }),
      h('div', { class: 'bn-l', text: s.line }),
      h('div', { class: 'bn-m', text: store.project.number + ' · Rev ' + store.activeRev().rev + (store.saveState === 'saved' ? '' : ' (working copy, unsaved)') + ' · calculated ' + ui.timeStr(new Date(D.t).toISOString()) + (integ ? ' · engine parity ' + integ.pass + '/' + integ.total : '') })));
    var r = h('div', { class: 'bn-r' });
    if (!D.blocked) {
      var cn = s.counts;
      r.appendChild(h('div', { class: 'counts' },
        h('span', { class: 'count pass', html: icon('check') + cn.pass + ' passed' }),
        h('span', { class: 'count review', html: icon('alert') + cn.review + ' review' }),
        h('span', { class: 'count fail', html: icon('x') + cn.fail + ' failed' })));
    }
    r.appendChild(h('button', { class: 'btn sm', type: 'button', html: (D.blocked ? icon('inputs') + 'Review inputs' : icon('validation') + 'Open validation') + icon('arrow-right', 'sm'), onClick: function () { c.nav(D.blocked ? 'inputs' : 'validation'); } }));
    el.appendChild(r);
    return el;
  }

  function cards(c) {
    var D = c.D, f = c.f, grid = h('div', { class: 'rcards' });
    DS.KEY_RESULTS.forEach(function (k) {
      var m = DS.METRIC[k.id], v = m.get(D.R), chk = k.check && D.check[k.check];
      var card = h('div', { class: 'rcard' + (m.comp ? ' linkable' : ''), 'data-metric': k.id, tabindex: m.comp ? '0' : null, role: m.comp ? 'button' : null, 'aria-label': m.comp ? k.label + ' — show in schematic' : null });
      card.appendChild(h('div', { class: 'rc-top' }, h('span', { class: 'rc-l', text: k.label }), h('span', { class: 'rc-sym', html: S.symHTML(m.sym) })));
      var val = h('div', { class: 'rc-v' }, h('span', { class: 'num', text: ui.metricText(f, m, v) }), m.text ? null : h('span', { class: 'rc-u', text: f.u(m.dim) }));
      card.appendChild(val);
      var ctx = contextLine(k.id, D, f);
      card.appendChild(h('div', { class: 'rc-ctx', text: ctx || ' ' }));
      var foot = h('div', { class: 'rc-f' }, ui.vt(m.type));
      if (chk) foot.appendChild(h('span', { class: 'si ' + chk.status, 'data-tip': chk.name, 'data-tip-s': (chk.kind === 'advisory' ? 'Advisory · ' : 'Criterion · ') + chk.basis, html: icon(ui.statusIcon(chk.status), 'sm') + '<span class="rc-req">' + (S.symHTML(reqShort(chk, f)) || esc(chk.status)) + '</span>' }));
      if (m.comp) foot.appendChild(h('span', { class: 'rc-loc', 'data-tip': 'Show in schematic', html: icon('crosshair', 'sm') }));
      card.appendChild(foot);
      if (m.comp) {
        var go = function () { c.nav('schematic', { c: m.comp, dim: dimFor(k.id) }); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      grid.appendChild(card);
    });
    return grid;
  }
  function dimFor(id) { return { d_th: 'd_th', L_th: 'L_th', d_n_sel: 'd_n', d_diff: 'd_diff', L_n: 'L_n', gap_s: 's', L_d: 'L_d', D_n_in: 'D_in' }[id] || ''; }

  function metricTable(c, g, extraRows) {
    var D = c.D, f = c.f, rows = DS.METRICS.filter(function (m) { return m.g === g.id; });
    var panel = h('section', { class: 'panel rtable', 'data-group': g.id });
    var head = h('div', { class: 'panel-h' }, h('h2', { text: g.title }), h('span', { class: 'ph-sub', text: rows.length + ' values' }));
    var copyB = h('button', { class: 'btn xs ghost', type: 'button', html: icon('copy', 'xs') + 'Copy', 'data-tip': 'Copy this table (tab-separated)' });
    copyB.addEventListener('click', function () { ui.copy(ui.tsv(tableRows(c, rows))).then(function () { ui.toast(g.title + ' copied'); }); });
    head.appendChild(h('div', { class: 'ph-actions' }, copyB));
    panel.appendChild(head);
    var t = h('table', { class: 'tbl' });
    t.innerHTML = '<thead><tr><th>Parameter</th><th class="r">Value</th><th>Unit</th><th>Type</th><th>Ref</th><th class="r"><span class="sr-only">Links</span></th></tr></thead>';
    var tb = h('tbody');
    rows.forEach(function (m) {
      var v = m.get(D.R);
      var tr = h('tr', { 'data-metric': m.id, 'data-comp': m.comp || '' },
        h('td', { html: esc(m.label) + (m.sym ? ' <span class="sym">' + S.symHTML(m.sym) + '</span>' : '') }),
        h('td', { class: 'val', text: ui.metricText(f, m, v) }),
        h('td', { class: 'unit', text: m.text ? '' : f.u(m.dim) }),
        h('td', null, ui.vt(m.type)),
        h('td', { class: 'ref', text: m.ref }));
      var links = h('td', { class: 'r lnk' });
      if (m.step && VJP.calcsteps.BYID[m.step]) links.appendChild(h('button', { class: 'btn xs ghost icon', type: 'button', 'aria-label': 'Open calculation step', 'data-tip': 'Calculation step ' + VJP.calcsteps.BYID[m.step].no, html: icon('steps', 'xs'), onClick: function () { c.nav('steps', { s: m.step }); } }));
      if (m.comp) links.appendChild(h('button', { class: 'btn xs ghost icon', type: 'button', 'aria-label': 'Show in schematic', 'data-tip': 'Show in schematic', html: icon('crosshair', 'xs'), onClick: function () { c.nav('schematic', { c: m.comp, dim: dimFor(m.id) }); } }));
      tr.appendChild(links);
      tr._search = (m.label + ' ' + S.symText(m.sym) + ' ' + m.ref + ' ' + m.id).toLowerCase();
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    panel.appendChild(h('div', { class: 'tbl-wrap' }, t));
    if (extraRows) panel.appendChild(extraRows);
    return panel;
  }
  function tableRows(c, rows) {
    var f = c.f, out = [['Parameter', 'Symbol', 'Value', 'Unit', 'Type', 'Ref']];
    rows.forEach(function (m) { var v = m.get(c.D.R); out.push([m.label, S.symText(m.sym), m.text ? v : ui.metricText(f, m, v).replace('−', '-'), m.text ? '' : f.u(m.dim), S.TYPES[m.type].label, m.ref]); });
    return out;
  }
  function pbackBlock(c) {
    var D = c.D, f = c.f, R = D.R, k = D.check.pback, d = R.inputs.Pback - R.returnLine.dP_req;
    var box = h('div', { class: 'pback' });
    box.appendChild(h('div', { class: 'pb-t', html: '<span class="si ' + k.status + '">' + icon(ui.statusIcon(k.status), 'sm') + '</span><b>Back-pressure cross-check</b> <span class="muted">(advisory)</span>' }));
    box.appendChild(h('div', { class: 'pb-row', html: 'Manual <span class="sym">P<sub>back</sub></span> <b class="num">' + esc(f.q(R.inputs.Pback, 'pressure_g')) + '</b> vs computed demand <span class="sym">ΔP<sub>req</sub></span> <b class="num">' + esc(f.q(R.returnLine.dP_req, 'pressure_bar')) + '</b> — input ' + (d >= 0 ? 'exceeds' : 'is below') + ' the demand by <b class="num">' + esc(f.q(Math.abs(d), 'pressure_bar', 3)) + '</b>.' }));
    box.appendChild(h('div', { class: 'pb-note', text: 'P_back is a manual input (sheet B18) and is not iterated. Adopting the computed value changes H, M and every dependent result.' }));
    var b = h('button', { class: 'btn sm', type: 'button', html: icon('target', 'sm') + 'Set P_back = computed (' + esc(f.q(R.returnLine.dP_req, 'pressure_bar')) + ')' });
    b.addEventListener('click', function () { c.actions.usePback(); });
    box.appendChild(b);
    return box;
  }
  function stationTable(c) {
    var D = c.D, f = c.f, R = D.R;
    var panel = h('section', { class: 'panel rtable wide', 'data-group': 'stations' });
    var head = h('div', { class: 'panel-h' }, h('h2', { text: 'Bernoulli station profile' }), h('span', { class: 'ph-sub', text: 'Gauge basis · z = 0 datum · sheet rows 70–74' }));
    var cols = [['P', 'pressure_g'], ['V', 'vel'], ['ρ', 'density'], ['h_s', 'head_m'], ['h_v', 'head_m'], ['H', 'head_m']];
    var copyB = h('button', { class: 'btn xs ghost', type: 'button', html: icon('copy', 'xs') + 'Copy' });
    copyB.addEventListener('click', function () {
      var rows = [['Station'].concat(cols.map(function (x) { return x[0] + ' (' + f.u(x[1]) + ')'; }))];
      R.stations.forEach(function (s) { rows.push([s.id + ' — ' + s.name, f.v(s.P, 'pressure_g'), f.v(s.V, 'vel'), f.v(s.rho, 'density'), f.v(s.h_static, 'head_m'), f.v(s.h_velocity, 'head_m'), f.v(s.H_total, 'head_m')]); });
      ui.copy(ui.tsv(rows)).then(function () { ui.toast('Station table copied'); });
    });
    head.appendChild(h('div', { class: 'ph-actions' }, copyB));
    panel.appendChild(head);
    var t = h('table', { class: 'tbl' });
    t.innerHTML = '<thead><tr><th>Station</th>' + cols.map(function (x) { return '<th class="r">' + S.symHTML(x[0]) + ' <span class="thu">' + esc(f.u(x[1])) + '</span></th>'; }).join('') + '</tr></thead>';
    var tb = h('tbody');
    var comp = ['motive', 'nozzle', 'suction', 'throat', 'diffuser'];
    R.stations.forEach(function (s, i) {
      var tr = h('tr', { 'data-comp': comp[i] }, h('td', { html: '<span class="stn mono">' + esc(String(s.id)) + '</span> ' + esc(s.name) }));
      [s.P, s.V, s.rho, s.h_static, s.h_velocity, s.H_total].forEach(function (v, j) { tr.appendChild(h('td', { class: 'val', text: f.v(v, cols[j][1]) })); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    panel.appendChild(h('div', { class: 'tbl-wrap' }, t));
    return panel;
  }

  VJP.pages.results = {
    mount: function (el, c) {
      var D = c.D;
      var page = h('div', { class: 'page page-results' });
      var copyAll = h('button', { class: 'btn sm', type: 'button', html: icon('copy') + 'Copy all tables' });
      var csv = h('button', { class: 'btn sm', type: 'button', html: icon('table') + 'Export CSV', onClick: c.actions.exportCSV });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>03</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Results' }),
          h('p', { class: 'page-desc', text: 'Engineering decision summary for the current design. Status is decided by the design criteria in Validation; every value below comes from the same calculation that drives the schematic and profiles.' })),
        h('div', { class: 'ph-r' }, copyAll, csv)));
      page.appendChild(banner(c));
      if (D.blocked) {
        page.appendChild(h('div', { class: 'panel', style: { marginTop: '14px' } }, h('div', { class: 'panel-h' }, h('h2', { text: 'Calculation cannot proceed' })), h('div', { class: 'panel-b' }, VJP.pages._blockerList(c))));
        el.appendChild(page); return;
      }
      page.appendChild(h('div', { class: 'sec-t' }, h('h2', { text: 'Key results' }), h('span', { class: 'muted', text: 'Click a geometry value to locate it in the schematic' })));
      page.appendChild(cards(c));
      var filt = h('input', { class: 'txt-input', type: 'search', placeholder: 'Filter parameters…', value: filterQ, 'aria-label': 'Filter detailed results', style: { width: '260px' } });
      page.appendChild(h('div', { class: 'sec-t' }, h('h2', { text: 'Detailed results' }), h('span', { class: 'muted', text: DS.METRICS.length + ' values · type tags show input, calculated, derived and empirical values' }), h('span', { class: 'sp' }), filt));
      var grid = h('div', { class: 'rgrid' });
      DS.GROUPS.forEach(function (g) { grid.appendChild(metricTable(c, g, g.id === 'return' ? pbackBlock(c) : null)); });
      grid.appendChild(stationTable(c));
      page.appendChild(grid);
      el.appendChild(page);
      function applyFilter() {
        filterQ = filt.value.trim().toLowerCase();
        grid.querySelectorAll('tbody tr[data-metric]').forEach(function (tr) { tr.classList.toggle('hidden', !!filterQ && tr._search.indexOf(filterQ) < 0); });
        grid.querySelectorAll('.rtable').forEach(function (p) { if (p.getAttribute('data-group') === 'stations') return; p.classList.toggle('hidden', !!filterQ && !p.querySelector('tbody tr:not(.hidden)')); });
      }
      filt.addEventListener('input', applyFilter); applyFilter();
      copyAll.addEventListener('click', function () {
        var all = [];
        DS.GROUPS.forEach(function (g) { all.push([g.title.toUpperCase()]); all = all.concat(tableRows(c, DS.METRICS.filter(function (m) { return m.g === g.id; }))); all.push([]); });
        ui.copy(ui.tsv(all)).then(function () { ui.toast('All result tables copied'); });
      });
      // links from the schematic / other pages
      var comp = c.params.c, focus = c.params.focus;
      if (comp || focus) setTimeout(function () {
        var sel = focus ? '[data-metric="' + focus + '"]' : 'tr[data-comp="' + comp + '"]';
        var rows = page.querySelectorAll(sel);
        rows.forEach(function (r) { r.classList.add('linked'); });
        if (rows[0]) rows[0].scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' });
      }, 60);
    }
  };
})(typeof window !== 'undefined' ? window : this);
