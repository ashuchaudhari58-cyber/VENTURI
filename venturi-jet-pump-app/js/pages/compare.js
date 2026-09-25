/* COMPARE — design variants (revisions + unsaved working copy). Every column is
 * a full design-state evaluation of that revision's stored inputs. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, DS = VJP.design, G = VJP.geometry;
  VJP.pages = VJP.pages || {};
  var sel = null, baseId = null, showAllInputs = false, profQ = 'P';

  // categorical palette — validated (adjacent pairs, both modes) with the dataviz method
  function palette() {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    return light ? ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] : ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
  }
  function designs(c) {
    var store = c.store, list = [];
    store.revisions.forEach(function (r) {
      var saved = r.id === store.activeRevId ? store._savedRev() : r;
      if (r.id === store.activeRevId && !saved && store.saveState !== 'saved') return; // active revision never stored — only the working copy exists
      list.push({ id: r.id, label: 'Rev ' + r.rev, meta: r.status + (r.savedAt ? ' · ' + ui.dateStr(r.savedAt) : ''), inputs: (saved || r).inputs, rev: r });
    });
    if (store.isDirty()) list.push({ id: 'working', label: 'Working copy', meta: 'unsaved · Rev ' + store.activeRev().rev, inputs: store.inputs, working: true });
    list.forEach(function (d) { d.D = DS.evaluate(d.inputs, d.working ? store.invalid : {}); });
    return list;
  }
  var ROWS = [
    { g: 'Geometry', ids: ['d_th', 'L_th', 'd_n_sel', 'L_n', 'gap_s', 'd_diff', 'L_d', 'AR_d', 'R_ratio', 'r_act', 'L_total'] },
    { g: 'Hydraulic performance', ids: ['H', 'M', 'Qs', 'Qd', 'v_n', 'V_th', 'v_d', 'Cr', 'h_s4', 'dH_margin'] },
    { g: 'Power & flow', ids: ['P_hyd', 'dP_nozzle', 'Q_min'] },
    { g: 'Cavitation, settling & ratios', ids: ['sigma', 'V_over_Vc', 'Re', 'dP_req'] }
  ];

  function table(c, list, base) {
    var f = c.f, pal = palette();
    var t = h('table', { class: 'tbl cmp' });
    var head = '<thead><tr><th>Parameter</th>' + list.map(function (d, i) { return '<th class="dcol"><span class="sw" style="background:' + pal[i % pal.length] + '"></span>' + esc(d.label) + (d.id === base.id ? ' <span class="thu">baseline</span>' : '') + '</th>'; }).join('') + '<th>Unit</th></tr></thead>';
    t.innerHTML = head;
    var tb = h('tbody');
    function group(title) { tb.appendChild(h('tr', { class: 'tbl-grouphead' }, h('td', { colspan: String(list.length + 2), text: title }))); }
    function row(label, sym, vals, unit, fmt, cmp) {
      var tr = h('tr', null, h('td', { html: esc(label) + (sym ? ' <span class="sym">' + S.symHTML(sym) + '</span>' : '') }));
      var bv = vals[list.indexOf(base)];
      vals.forEach(function (v, i) {
        var d = list[i], td = h('td', { class: 'dval' + (d.id === base.id ? ' base' : '') });
        var diff = cmp ? cmp(v, bv) : (typeof v === 'number' && typeof bv === 'number' ? Math.abs(v - bv) > 1e-9 * Math.max(1, Math.abs(bv)) : String(v) !== String(bv));
        td.innerHTML = (d.id !== base.id && diff ? '<span class="chg" title="Differs from baseline"></span>' : '') + '<span class="num">' + esc(fmt(v)) + '</span>' +
          (d.id !== base.id && diff && typeof v === 'number' && typeof bv === 'number' ? '<span class="dl">' + esc(U.pct(v, bv)) + '</span>' : '');
        tr.appendChild(td);
      });
      tr.appendChild(h('td', { class: 'unit', text: unit || '' }));
      tb.appendChild(tr);
    }
    // key inputs
    group('Key inputs' + (showAllInputs ? '' : ' — differing only'));
    var anyInput = false;
    S.FIELDS.forEach(function (fl) {
      var vals = list.map(function (d) { return d.inputs[fl.key]; });
      var differs = vals.some(function (v) { return String(v) !== String(vals[0]) && !(typeof v === 'number' && Math.abs(v - vals[0]) <= 1e-9 * Math.max(1, Math.abs(vals[0]))); });
      if (!showAllInputs && !differs) return;
      anyInput = true;
      row(fl.name, fl.sym, vals, fl.select ? '' : f.u(fl.dim), function (v) { return fl.select ? v : f.v(Number(v), fl.dim); });
    });
    if (!anyInput) tb.appendChild(h('tr', null, h('td', { colspan: String(list.length + 2), class: 'muted', text: 'All inputs are identical across the selected designs.' })));
    ROWS.forEach(function (grp) {
      group(grp.g);
      grp.ids.forEach(function (id) {
        var m = DS.METRIC[id];
        var vals = list.map(function (d) { return d.D.blocked ? NaN : m.get(d.D.R); });
        row(m.label, m.sym, vals, m.text ? '' : f.u(m.dim), function (v) { return ui.metricText(f, m, v); });
      });
    });
    group('Validation');
    row('Design status', '', list.map(function (d) { return d.D.status.title; }), '', function (v) { return v; });
    row('Criteria met', '', list.map(function (d) { var cn = d.D.status.counts; return d.D.blocked ? '—' : cn.critPass + ' / ' + cn.critTotal; }), '', function (v) { return v; });
    row('Advisory items to review', '', list.map(function (d) { return d.D.blocked ? '—' : d.D.status.counts.advReview; }), '', function (v) { return String(v); });
    t.appendChild(tb);
    return t;
  }
  function checksMatrix(c, list) {
    var t = h('table', { class: 'tbl cmp' });
    t.innerHTML = '<thead><tr><th>Check</th>' + list.map(function (d) { return '<th class="dcol">' + esc(d.label) + '</th>'; }).join('') + '</tr></thead>';
    var tb = h('tbody'), first = list.filter(function (d) { return !d.D.blocked; })[0];
    if (first) first.D.checks.filter(function (k) { return k.kind !== 'note'; }).forEach(function (k) {
      var tr = h('tr', null, h('td', { html: esc(k.name) + ' <span class="thu">' + esc(VJP.validation.KINDS[k.kind].label) + '</span>' }));
      list.forEach(function (d) {
        var x = d.D.blocked ? null : d.D.check[k.id];
        tr.appendChild(h('td', { class: 'dval', html: x ? '<span class="si ' + x.status + '">' + icon(ui.statusIcon(x.status), 'sm') + esc(x.status.toUpperCase()) + '</span>' : '<span class="si na">' + icon('blocked', 'sm') + 'n/e</span>' }));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }
  // geometry + hydraulic overlays, x measured from each design's nozzle inlet (common datum)
  function overlays(c, list, wrap) {
    var f = c.f, pal = palette(), ok = list.filter(function (d) { return !d.D.blocked; });
    wrap.innerHTML = '';
    var g1 = h('div', { class: 'chart-card panel' }), g2 = h('div', { class: 'chart-card panel' });
    wrap.append(g1, g2);
    function xs(d, x) { return f.c(x - d.D.model.x.n0, 'len_mm'); }
    var geoSeries = ok.map(function (d) {
      var M = d.D.model, i = list.indexOf(d), pts = [];
      d.D.prof.x.forEach(function (x) { if (x >= M.x.n0 - 1e-6) pts.push([xs(d, x), f.c(M.pathRadius(x), 'len_mm')]); });
      return { id: d.id, name: d.label, color: pal[i % pal.length], dash: i % 2 ? '7 4' : null, points: pts };
    });
    VJP.charts.line(g1, { title: 'Flow-path bore radius', subtitle: 'Nozzle → throat → diffuser → outlet · x from each design’s nozzle inlet', height: 270,
      x: { domain: [0, Math.max.apply(null, geoSeries.map(function (s) { return s.points[s.points.length - 1][0]; }))], label: 'Distance from nozzle inlet', unit: f.u('len_mm'), fmt: function (x) { return U.fmt(x, 4) + ' ' + f.u('len_mm'); } },
      y: { label: 'Bore radius', unit: f.u('len_mm'), zero: true, fmt: function (y) { return U.fmt(y, 4) + ' ' + f.u('len_mm'); } }, series: geoSeries, endLabels: false });
    var Q = { P: ['Static pressure', 'Pstatic', 'pressure_g'], V: ['Axial velocity', 'V', 'vel'], EGL: ['Total head (EGL)', 'EGL', 'head_m'], Re: ['Reynolds number', 'Re', null] }[profQ];
    var hs = ok.map(function (d) {
      var i = list.indexOf(d), p = d.D.prof, M = d.D.model, pts = [];
      p.x.forEach(function (x, k) { if (x >= M.x.n0 - 1e-6) pts.push([xs(d, x), Q[2] ? f.c(p[Q[1]][k], Q[2]) : p[Q[1]][k]]); });
      return { id: d.id, name: d.label, color: pal[i % pal.length], dash: i % 2 ? '7 4' : null, points: pts };
    });
    var qsel = h('div', { class: 'seg cmp-q', role: 'radiogroup', 'aria-label': 'Profile quantity' });
    [['P', 'Pressure'], ['V', 'Velocity'], ['EGL', 'EGL'], ['Re', 'Re']].forEach(function (x) {
      var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(profQ === x[0]), text: x[1] });
      b.addEventListener('click', function () { profQ = x[0]; overlays(c, list, wrap); });
      qsel.appendChild(b);
    });
    VJP.charts.line(g2, { title: 'Hydraulic profile comparison', subtitle: Q[0] + ' along the flow path', height: 270, actions: qsel,
      x: { domain: [0, Math.max.apply(null, hs.map(function (s) { return s.points[s.points.length - 1][0]; }))], label: 'Distance from nozzle inlet', unit: f.u('len_mm'), fmt: function (x) { return U.fmt(x, 4) + ' ' + f.u('len_mm'); } },
      y: { label: Q[0], unit: Q[2] ? f.u(Q[2]) : '', zero: true, fmt: function (y) { return Q[2] ? U.fmt(y, 4) + ' ' + f.u(Q[2]) : U.sci(y, 3); } }, series: hs, endLabels: false });
  }

  VJP.pages.compare = {
    mount: function (el, c) {
      var page = h('div', { class: 'page page-compare' });
      var list = designs(c);
      var exp = h('button', { class: 'btn sm', type: 'button', html: icon('table') + 'Export comparison' });
      var newRev = h('button', { class: 'btn sm', type: 'button', html: icon('stack') + 'Save as new revision…', onClick: c.actions.saveAsRevision });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>08</b> · Reference & review' }),
          h('h1', { class: 'page-title', text: 'Compare' }),
          h('p', { class: 'page-desc', text: 'Design variants of ' + c.store.project.number + ' side by side. Each column is a full recalculation of that revision’s stored inputs; values that differ from the baseline are marked with a dot and the relative change.' })),
        h('div', { class: 'ph-r' }, newRev, exp)));
      if (list.length < 2) {
        page.appendChild(h('div', { class: 'panel' }, h('div', { class: 'empty' },
          h('img', { src: ui.asset('brand/venturi-jet-pump-mark.png'), alt: '' }),
          h('h3', { text: 'No design variants to compare yet' }),
          h('p', { text: 'Save the current design (Ctrl+S), change inputs and save them as a new revision — or simply edit the inputs: an unsaved working copy is compared against the stored revision automatically.' }),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
            h('button', { class: 'btn primary', type: 'button', html: icon('save') + 'Save Rev ' + esc(c.store.activeRev().rev), onClick: c.actions.save }),
            h('button', { class: 'btn', type: 'button', html: icon('stack') + 'Save as new revision…', onClick: c.actions.saveAsRevision })))));
        el.appendChild(page); return;
      }
      if (!sel || !sel.every(function (id) { return list.some(function (d) { return d.id === id; }); })) sel = list.slice(-5).map(function (d) { return d.id; });
      if (!baseId || !list.some(function (d) { return d.id === baseId; })) baseId = sel[0];
      var pick = h('div', { class: 'cmp-pick', role: 'group', 'aria-label': 'Designs to compare' });
      var pal = palette();
      list.forEach(function (d) {
        var on = sel.indexOf(d.id) >= 0;
        var cb = h('input', { type: 'checkbox' }); cb.checked = on;
        var lab = h('label', { class: 'cmp-design' + (on ? ' on' : '') }, cb, h('span', { class: 'sw', style: { background: on ? pal[sel.indexOf(d.id) % pal.length] : 'transparent' } }),
          h('span', null, h('b', { text: d.label }), ' ', h('span', { class: 'cd-meta', text: d.meta })),
          d.D.blocked ? h('span', { class: 'si fail', html: icon('blocked', 'sm') }) : null,
          d.id === baseId ? h('span', { class: 'base', text: 'Baseline' }) : h('button', { class: 'btn xs ghost', type: 'button', text: 'Set baseline', onClick: function (e) { e.preventDefault(); baseId = d.id; if (sel.indexOf(d.id) < 0) sel.unshift(d.id); rerender(); } }));
        cb.addEventListener('change', function () {
          if (cb.checked) { if (sel.length >= 5) { cb.checked = false; ui.toast('Compare up to 5 designs at a time', 'info'); return; } sel.push(d.id); }
          else { if (sel.length <= 2) { cb.checked = true; ui.toast('Select at least two designs', 'info'); return; } sel.splice(sel.indexOf(d.id), 1); if (baseId === d.id) baseId = sel[0]; }
          rerender();
        });
        pick.appendChild(lab);
      });
      var chosen = list.filter(function (d) { return sel.indexOf(d.id) >= 0; });
      chosen.sort(function (a, b) { return sel.indexOf(a.id) - sel.indexOf(b.id); });
      var base = chosen.filter(function (d) { return d.id === baseId; })[0] || chosen[0];
      page.appendChild(h('section', { class: 'panel' }, h('div', { class: 'panel-h' }, h('h2', { text: 'Designs' }), h('span', { class: 'ph-sub', text: 'Select 2–5 · colours identify each design in the charts' })), h('div', { class: 'panel-b' }, pick)));
      var allT = h('label', { class: 'switch' }, (function () { var i = h('input', { type: 'checkbox' }); i.checked = showAllInputs; i.addEventListener('change', function () { showAllInputs = i.checked; rerender(); }); return i; })(), h('span', { class: 'tr' }), h('span', { text: 'Show all inputs' }));
      page.appendChild(h('section', { class: 'panel', style: { marginTop: '14px' } },
        h('div', { class: 'panel-h' }, h('h2', { text: 'Comparison table' }), h('span', { class: 'ph-sub', text: 'Baseline: ' + base.label }), h('div', { class: 'ph-actions' }, allT)),
        h('div', { class: 'tbl-wrap' }, table(c, chosen, base))));
      var ov = h('div', { class: 'cmp-charts' });
      page.appendChild(ov);
      page.appendChild(h('section', { class: 'panel', style: { marginTop: '14px' } }, h('div', { class: 'panel-h' }, h('h2', { text: 'Validation comparison' }), h('span', { class: 'ph-sub', text: 'Criteria and advisory checks per design' })),
        h('div', { class: 'tbl-wrap' }, checksMatrix(c, chosen))));
      el.appendChild(page);
      overlays(c, chosen, ov);
      exp.addEventListener('click', function () {
        var f = c.f, rows = [['Venturi Jet Pump — design comparison'], ['Project', c.store.project.number + ' ' + c.store.project.name], ['Units', c.sys === 'imp' ? 'Imperial' : 'SI'], ['Baseline', base.label], [], ['Parameter', 'Symbol'].concat(chosen.map(function (d) { return d.label; }), ['Unit'])];
        S.FIELDS.forEach(function (fl) { rows.push([fl.name, S.symText(fl.sym)].concat(chosen.map(function (d) { var v = d.inputs[fl.key]; return fl.select ? v : U.plain(Number(v), fl.dim, c.sys, 6); }), [fl.select ? '' : f.u(fl.dim)])); });
        ROWS.forEach(function (g) { g.ids.forEach(function (id) { var m = DS.METRIC[id]; rows.push([m.label, S.symText(m.sym)].concat(chosen.map(function (d) { return d.D.blocked ? '' : m.text ? m.get(d.D.R) : U.plain(m.get(d.D.R), m.dim, c.sys, 6); }), [m.text ? '' : f.u(m.dim)])); }); });
        rows.push(['Design status', ''].concat(chosen.map(function (d) { return d.D.status.title; }), ['']));
        ui.download(c.store.project.number + '_comparison.csv', ui.csv(rows), 'text/csv;charset=utf-8');
        ui.toast('Comparison exported (CSV)');
      });
      function rerender() { el.innerHTML = ''; VJP.pages.compare.mount(el, c); }
    }
  };
})(typeof window !== 'undefined' ? window : this);
