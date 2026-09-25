/* HYDRAULIC PROFILES — four linked 1-D profiles along the same axial coordinate
 * as the schematic, a geometry strip, synchronized cursor/readout, component
 * bands, engine station markers, station table, head-loss chart and data table. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, G = VJP.geometry;
  VJP.pages = VJP.pages || {};
  var st = null;

  function seriesColors() {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    return light ? { P: '#7C3AED', V: '#D97706', EGL: '#4a3aa7', HGL: '#1baf7a', Re: '#0F766E', HL: '#7C3AED' }
      : { P: '#A78BFA', V: '#F59E0B', EGL: '#9085e9', HGL: '#199e70', Re: '#2DD4BF', HL: '#A78BFA' };
  }
  var STN = ['1', '2', '2s', '3', '4'];

  function build(c) {
    var D = c.D, f = c.f, prof = D.prof, M = D.model, R = D.R, col = seriesColors();
    var X = prof.x.map(function (x) { return f.c(x, 'len_mm'); });
    function pts(arr, dim) { return prof.x.map(function (x, i) { return [X[i], dim ? f.c(arr[i], dim) : arr[i]]; }); }
    var bands = M.components.filter(function (cp) { return !cp.offAxis; }).map(function (cp) {
      return { id: cp.id, no: cp.no, label: cp.id === 'chamber' ? 'Gap' : cp.short, x0: f.c(cp.x0, 'len_mm'), x1: f.c(cp.x1, 'len_mm') };
    });
    var sx = prof.stations.map(function (s) { return f.c(s.x, 'len_mm'); });
    var xd = [0, f.c(M.totalLength, 'len_mm')];
    var xfmt = function (x) { return U.fmt(x, 4) + ' ' + f.u('len_mm'); };
    function yf(dim) { return function (y) { return U.fmt(y, 4) + ' ' + f.u(dim); }; }
    var xAxis = { domain: xd, label: 'Axial position x', unit: f.u('len_mm'), fmt: xfmt };
    return [
      { key: 'P', title: 'Pressure vs Venturi Length', subtitle: 'Static pressure (gauge) · anchored to Bernoulli stations 1–4',
        x: xAxis, y: { label: 'Static pressure', unit: f.u('pressure_g'), zero: true, fmt: yf('pressure_g') },
        series: [{ id: 'P', name: 'Static pressure', color: col.P, points: pts(prof.Pstatic, 'pressure_g') }],
        markers: prof.stations.map(function (s, i) { return { x: sx[i], y: f.c(s.P, 'pressure_g'), color: col.P, label: STN[i] }; }) },
      { key: 'V', title: 'Velocity Distribution', subtitle: 'Mean axial velocity of the through-flow · continuity + jet decay',
        x: xAxis, y: { label: 'Velocity', unit: f.u('vel'), zero: true, fmt: yf('vel') },
        series: [{ id: 'V', name: 'Axial velocity', color: col.V, points: pts(prof.V, 'vel') }],
        markers: prof.stations.filter(function (s, i) { return i !== 2; }).map(function (s) { var i = prof.stations.indexOf(s); return { x: sx[i], y: f.c(s.V, 'vel'), color: col.V, label: STN[i] }; }),
        offMarkers: [{ x: sx[2], y: f.c(prof.stations[2].V, 'vel'), color: col.V, label: '2s suction stream' }] },
      { key: 'H', title: 'Energy & Hydraulic Grade Lines', subtitle: 'EGL = static + velocity head · HGL = static head · motive / mixed stream',
        x: xAxis, y: { label: 'Head', unit: f.u('head_m'), zero: true, fmt: yf('head_m') },
        series: [{ id: 'EGL', name: 'EGL (total head)', short: 'EGL', color: col.EGL, points: pts(prof.EGL, 'head_m') },
          { id: 'HGL', name: 'HGL (static head)', short: 'HGL', color: col.HGL, dash: '7 4', points: pts(prof.HGL, 'head_m') }],
        markers: prof.stations.filter(function (s, i) { return i !== 2; }).map(function (s) { var i = prof.stations.indexOf(s); return { x: sx[i], y: f.c(s.H, 'head_m'), color: col.EGL, label: STN[i] }; }) },
      { key: 'Re', title: 'Reynolds Number Variation', subtitle: 'Re = ρ·V·D/μ along the flow path · slurry viscosity μ_sl',
        x: xAxis, y: { label: 'Re', unit: '', zero: true, fmt: function (y) { return U.sci(y, 3); } },
        series: [{ id: 'Re', name: 'Reynolds number', color: col.Re, points: pts(prof.Re) }],
        offMarkers: [{ x: xd[1] * 0.985, y: R.friction.Re, color: col.Re, label: 'return pipe (engine)' }] }
    ].map(function (d) { d.bands = bands; return d; });
  }

  function readout(c, x) {
    var D = c.D, f = c.f, el = st.readout;
    if (x === null || x === undefined) {
      el.innerHTML = '<span class="ro-hint">' + icon('crosshair', 'sm') + 'Hover any profile or the geometry strip to read every quantity at the same axial position · click to pin</span>';
      return;
    }
    var xmm = U.toSI(x, 'len_mm', c.sys), s = G.sampleAt(D.prof, xmm), cp = D.model.componentAt(xmm);
    el.innerHTML = '<span class="ro-x">' + (st.pinned !== null ? icon('pin', 'xs') : '') + 'x = <b class="num">' + esc(f.q(xmm, 'len_mm')) + '</b></span>' +
      (cp ? '<span class="ro-c">' + esc(cp.name) + '</span>' : '') +
      '<span class="ro-v"><i style="background:' + seriesColors().P + '"></i>P <b class="num">' + esc(f.q(s.P, 'pressure_g')) + '</b></span>' +
      '<span class="ro-v"><i style="background:' + seriesColors().V + '"></i>V <b class="num">' + esc(f.q(s.V, 'vel')) + '</b></span>' +
      '<span class="ro-v"><i style="background:' + seriesColors().EGL + '"></i>EGL <b class="num">' + esc(f.q(s.EGL, 'head_m')) + '</b></span>' +
      '<span class="ro-v"><i style="background:' + seriesColors().HGL + '"></i>HGL <b class="num">' + esc(f.q(s.HGL, 'head_m')) + '</b></span>' +
      '<span class="ro-v"><i style="background:' + seriesColors().Re + '"></i>Re <b class="num">' + esc(U.sci(s.Re, 3)) + '</b></span>' +
      '<span class="ro-v">Ø <b class="num">' + esc(f.q(s.D, 'len_mm')) + '</b></span>';
  }
  function setX(c, x) {
    if (!st) return;
    var show = x === null ? st.pinned : x;
    var xmm = show === null ? null : U.toSI(show, 'len_mm', c.sys);
    var cp = xmm === null ? null : c.D.model.componentAt(xmm);
    st.charts.forEach(function (ch) { ch.setCursor(show, { band: cp ? cp.name : '' }); ch.highlightBand(cp ? cp.id : st.selComp); });
    drawStripCursor(c, xmm, cp ? cp.id : st.selComp);
    readout(c, show);
  }

  /* geometry strip — the parametric model, x aligned to the axial coordinate */
  function buildStrip(c) {
    var D = c.D, M = D.model, box = st.strip;
    box.innerHTML = '';
    var W = Math.max(300, box.clientWidth || 900), H = 118, pl = 64, pr = 18;
    var k = (W - pl - pr) / M.totalLength;
    var svg = VJP.schematic.mini(M, { width: W, height: H - 30, xMap: { k: k, tx: pl }, pad: 8 });
    svg.setAttribute('class', 'strip-svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H); svg.setAttribute('width', '100%');
    var NS = 'http://www.w3.org/2000/svg', P = VJP.schematic.livePalette();
    function e(tag, a, parent) { var n = document.createElementNS(NS, tag); for (var q in a) n.setAttribute(q, a[q]); (parent || svg).appendChild(n); return n; }
    st.stripMap = { k: k, pl: pl, W: W, H: H };
    // component spans + labels
    var gB = e('g', {});
    M.components.filter(function (cp) { return !cp.offAxis; }).forEach(function (cp, i) {
      var x0 = pl + cp.x0 * k, x1 = pl + cp.x1 * k;
      var r = e('rect', { x: x0, y: 0, width: Math.max(1, x1 - x0), height: H - 30, fill: 'transparent', 'data-comp': cp.id, class: 'strip-hit' }, gB);
      if (i) e('line', { x1: x0, y1: 4, x2: x0, y2: H - 22, stroke: P.center, 'stroke-width': 1, 'stroke-dasharray': '2 3' });
      var wpx = x1 - x0, lbl = wpx > cp.short.length * 6.8 + 8 ? cp.short : wpx > 16 ? String(cp.no) : '';
      if (lbl) { var t = e('text', { x: (x0 + x1) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, 'font-family': "Inter, 'Segoe UI', sans-serif", 'font-weight': 600, fill: P.muted }); t.textContent = lbl; }
    });
    st.stripHi = e('rect', { x: 0, y: 0, width: 0, height: H - 30, fill: P.brand, 'fill-opacity': 0.12, stroke: P.brand, 'stroke-opacity': 0.6, 'pointer-events': 'none' });
    st.stripCur = e('line', { x1: 0, y1: 0, x2: 0, y2: H - 26, stroke: P.text, 'stroke-width': 1.2, 'pointer-events': 'none', visibility: 'hidden' });
    svg.addEventListener('pointermove', function (ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width), xmm = (px - pl) / k;
      if (xmm < 0 || xmm > M.totalLength) { setX(c, null); return; }
      setX(c, c.f.c(xmm, 'len_mm'));
    });
    svg.addEventListener('pointerleave', function () { setX(c, null); });
    svg.addEventListener('click', function (ev) {
      var t = ev.target.getAttribute && ev.target.getAttribute('data-comp');
      if (!t) return;
      st.selComp = st.selComp === t ? null : t;
      c.select(st.selComp);
      updateSelLink(c);
      setX(c, null);
    });
    box.appendChild(svg);
  }
  function drawStripCursor(c, xmm, compId) {
    if (!st.stripCur) return;
    var m = st.stripMap, M = c.D.model;
    if (xmm === null) st.stripCur.setAttribute('visibility', 'hidden');
    else { var X = m.pl + xmm * m.k; st.stripCur.setAttribute('x1', X); st.stripCur.setAttribute('x2', X); st.stripCur.setAttribute('visibility', 'visible'); }
    var cp = compId && M.comp[compId];
    if (cp && !cp.offAxis) { var sp = M.components.filter(function (q) { return q.id === compId; })[0]; st.stripHi.setAttribute('x', m.pl + sp.x0 * m.k); st.stripHi.setAttribute('width', Math.max(1, (sp.x1 - sp.x0) * m.k)); }
    else st.stripHi.setAttribute('width', 0);
  }
  function updateSelLink(c) {
    var b = st.selLink;
    if (!st.selComp) { b.classList.add('hidden'); return; }
    var name = G.COMP_BY_ID[st.selComp].name;
    b.classList.remove('hidden');
    b.innerHTML = icon('schematic', 'sm') + 'Open ' + esc(name) + ' in schematic';
  }

  function stationSection(c) {
    var D = c.D, f = c.f, R = D.R, col = seriesColors();
    var wrap = h('div', { class: 'prof-bottom' });
    var t = h('table', { class: 'tbl' });
    var cols = [['P', 'pressure_g'], ['V', 'vel'], ['ρ', 'density'], ['h_s', 'head_m'], ['h_v', 'head_m'], ['H', 'head_m']];
    t.innerHTML = '<thead><tr><th>Station</th><th class="r">x <span class="thu">' + esc(f.u('len_mm')) + '</span></th>' + cols.map(function (x) { return '<th class="r">' + S.symHTML(x[0]) + ' <span class="thu">' + esc(f.u(x[1])) + '</span></th>'; }).join('') + '</tr></thead>';
    var tb = h('tbody');
    R.stations.forEach(function (s, i) {
      var xs = D.prof.stations[i].x;
      var tr = h('tr', { class: 'st-row' }, h('td', { html: '<span class="stn mono">' + esc(String(s.id)) + '</span> ' + esc(s.name) }), h('td', { class: 'val', text: f.v(xs, 'len_mm') }));
      [s.P, s.V, s.rho, s.h_static, s.h_velocity, s.H_total].forEach(function (v, j) { tr.appendChild(h('td', { class: 'val', text: f.v(v, cols[j][1]) })); });
      tr.addEventListener('mouseenter', function () { setX(c, f.c(xs, 'len_mm')); });
      tr.addEventListener('mouseleave', function () { setX(c, null); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(h('section', { class: 'panel' }, h('div', { class: 'panel-h' }, h('h2', { text: 'Bernoulli station values' }), h('span', { class: 'ph-sub', text: 'Engine values · the markers on the profiles' })), h('div', { class: 'tbl-wrap' }, t)));
    var hl = R.headLoss;
    var barBox = h('div', { class: 'chart-card panel' });
    wrap.appendChild(barBox);
    VJP.charts.bars(barBox, { title: 'Head loss by component', subtitle: 'Motive stream · sheet Hydraulic Profile B13–B16', color: col.HL, xLabel: 'Head loss (' + f.u('head_m') + ')',
      items: [
        { label: 'Nozzle (1 → 2)', value: f.c(hl.nozzle, 'head_m'), text: f.q(hl.nozzle, 'head_m') },
        { label: 'Mixing (2, 2s → 3)', value: f.c(hl.mixing, 'head_m'), text: f.q(hl.mixing, 'head_m') },
        { label: 'Diffuser (3 → 4)', value: f.c(hl.diffuser, 'head_m'), text: f.q(hl.diffuser, 'head_m') }
      ] });
    barBox.appendChild(h('div', { class: 'chart-foot', html: 'Total head drop of the motive stream 1 → 4: <b class="num">' + esc(f.q(hl.total, 'head_m')) + '</b> — includes the energy transferred to the entrained flow.' }));
    return wrap;
  }
  function dataTable(c) {
    var D = c.D, f = c.f, M = D.model, prof = D.prof;
    var det = h('details', { class: 'panel data-twin' });
    det.appendChild(h('summary', { html: icon('table', 'sm') + '<b>Data table</b> <span class="muted">— profile values at every component boundary and station (the table view of the four charts)</span>' }));
    var xs = [];
    M.components.forEach(function (cp) { if (!cp.offAxis) { xs.push([cp.x0, cp.name + ' — start']); } });
    xs.push([M.totalLength, 'Discharge — end']);
    prof.stations.forEach(function (s) { xs.push([s.x, 'Station ' + s.id]); });
    xs.sort(function (a, b) { return a[0] - b[0]; });
    var t = h('table', { class: 'tbl' });
    t.innerHTML = '<thead><tr><th>Position</th><th class="r">x <span class="thu">' + esc(f.u('len_mm')) + '</span></th><th class="r">P <span class="thu">' + esc(f.u('pressure_g')) + '</span></th><th class="r">V <span class="thu">' + esc(f.u('vel')) + '</span></th><th class="r">EGL <span class="thu">' + esc(f.u('head_m')) + '</span></th><th class="r">HGL <span class="thu">' + esc(f.u('head_m')) + '</span></th><th class="r">Re</th><th class="r">Ø <span class="thu">' + esc(f.u('len_mm')) + '</span></th></tr></thead>';
    var tb = h('tbody');
    xs.forEach(function (p) {
      var s = G.sampleAt(prof, p[0]);
      tb.appendChild(h('tr', null, h('td', { text: p[1] }), h('td', { class: 'val', text: f.v(p[0], 'len_mm') }), h('td', { class: 'val', text: f.v(s.P, 'pressure_g') }), h('td', { class: 'val', text: f.v(s.V, 'vel') }),
        h('td', { class: 'val', text: f.v(s.EGL, 'head_m') }), h('td', { class: 'val', text: f.v(s.HGL, 'head_m') }), h('td', { class: 'val', text: U.sci(s.Re, 3) }), h('td', { class: 'val', text: f.v(s.D, 'len_mm') })));
    });
    t.appendChild(tb);
    det.appendChild(h('div', { class: 'tbl-wrap' }, t));
    return det;
  }
  function exportCSV(c) {
    var D = c.D, f = c.f, p = D.prof, st2 = c.store;
    var rows = [['Venturi Jet Pump — hydraulic profiles (physics-based reconstruction anchored to the station values; not CFD)'],
      ['Project', st2.project.number + ' ' + st2.project.name, 'Revision', 'Rev ' + st2.activeRev().rev], ['Units', c.sys === 'imp' ? 'Imperial' : 'SI'], [],
      ['x (' + f.u('len_mm') + ')', 'component', 'P (' + f.u('pressure_g') + ')', 'V (' + f.u('vel') + ')', 'EGL (' + f.u('head_m') + ')', 'HGL (' + f.u('head_m') + ')', 'Re', 'D (' + f.u('len_mm') + ')', 'rho (' + f.u('density') + ')']];
    p.x.forEach(function (x, i) {
      var cp = D.model.componentAt(x);
      rows.push([U.plain(x, 'len_mm', c.sys, 6), cp ? cp.name : '', U.plain(p.Pstatic[i], 'pressure_g', c.sys, 6), U.plain(p.V[i], 'vel', c.sys, 6), U.plain(p.EGL[i], 'head_m', c.sys, 6), U.plain(p.HGL[i], 'head_m', c.sys, 6), U.sciPlain(p.Re[i], 5), U.plain(p.D[i], 'len_mm', c.sys, 6), U.plain(p.rho[i], 'density', c.sys, 6)]);
    });
    ui.download(st2.project.number + '_Rev' + st2.activeRev().rev + '_hydraulic_profiles.csv', ui.csv(rows), 'text/csv;charset=utf-8');
    ui.toast('Hydraulic data exported (' + p.x.length + ' points)');
  }

  VJP.pages.profiles = {
    mount: function (el, c) {
      var D = c.D;
      st = { charts: [], pinned: null, selComp: c.params.c || null };
      var page = h('div', { class: 'page page-profiles' });
      var csv = h('button', { class: 'btn sm', type: 'button', html: icon('table') + 'Export CSV' });
      var exp = h('button', { class: 'btn sm', type: 'button', 'aria-haspopup': 'menu', html: icon('download') + 'Export charts' });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>05</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Hydraulic Profiles' }),
          h('p', { class: 'page-desc', html: 'One-dimensional reconstruction along the same axial coordinate as the schematic, anchored to the calculated Bernoulli station values (markers). <b>Physics-based approximation — not CFD.</b>' })),
        h('div', { class: 'ph-r' }, csv, exp)));
      if (D.blocked) { page.appendChild(VJP.pages._blockedPanel(c, 'Hydraulic profiles are not available')); el.appendChild(page); return; }
      // strip + readout
      st.strip = h('div', { class: 'strip' });
      st.readout = h('div', { class: 'readout', 'aria-live': 'off' });
      st.selLink = h('button', { class: 'btn xs hidden', type: 'button' });
      st.selLink.addEventListener('click', function () { c.nav('schematic', { c: st.selComp }); });
      page.appendChild(h('section', { class: 'panel strip-panel' },
        h('div', { class: 'panel-h' }, h('h2', { text: 'Geometry ↔ hydraulics' }), h('span', { class: 'ph-sub', text: 'Same parametric model as the schematic · hover to inspect, click a component to select it' }), h('div', { class: 'ph-actions' }, st.selLink)),
        st.strip, st.readout));
      // 2×2 charts
      var grid = h('div', { class: 'prof-grid' });
      var defs = build(c);
      defs.forEach(function (d) {
        var card = h('div', { class: 'chart-card panel', 'data-chart': d.key });
        grid.appendChild(card);
        d._card = card;
      });
      page.appendChild(grid);
      page.appendChild(h('div', { class: 'prof-key' },
        h('span', { class: 'eyebrow', text: 'Components' }),
        D.model.components.filter(function (cp) { return !cp.offAxis; }).map(function (cp) { return h('span', { class: 'pk', html: '<span class="pk-n">' + cp.no + '</span>' + esc(cp.name) }); }),
        h('span', { class: 'eyebrow', style: { marginLeft: '12px' }, text: 'Stations' }),
        D.prof.stations.map(function (s) { return h('span', { class: 'pk', html: '<span class="stn mono">' + esc(String(s.id)) + '</span>' + esc(s.name) }); })));
      page.appendChild(stationSection(c));
      page.appendChild(dataTable(c));
      el.appendChild(page);
      // render charts after layout so they take the column width
      defs.forEach(function (d) {
        var o = { title: d.title, subtitle: d.subtitle, x: d.x, y: d.y, series: d.series, bands: d.bands, markers: d.markers, offMarkers: d.offMarkers, height: 286,
          onHover: function (x) { setX(c, x); },
          onClick: function (x) { st.pinned = st.pinned === null ? x : null; setX(c, st.pinned); } };
        var ch = VJP.charts.line(d._card, o);
        ch._def = d; st.charts.push(ch);
      });
      buildStrip(c);
      if (st.selComp) { c.select(st.selComp); updateSelLink(c); }
      setX(c, null);
      csv.addEventListener('click', function () { exportCSV(c); });
      exp.addEventListener('click', function () {
        var items = [{ head: 'Charts (print / light)' }];
        st.charts.forEach(function (ch) {
          items.push({ label: ch.o.title + ' — SVG', icon: 'code', onClick: function () { ui.download(slug(ch.o.title) + '.svg', VJP.charts.serialize(ch.exportSVG('light')), 'image/svg+xml'); } });
          items.push({ label: ch.o.title + ' — PNG', icon: 'image', onClick: function () { VJP.charts.toPNG(ch.exportSVG('light'), 2, function (b) { if (b) ui.download(slug(ch.o.title) + '.png', b); }); } });
        });
        ui.menu(exp, items);
      });
      if ('ResizeObserver' in window) {
        st.ro = new ResizeObserver(ui.debounce(function () { if (!st) return; st.charts.forEach(function (ch) { ch.resize(); }); buildStrip(c); setX(c, null); }, 80));
        st.ro.observe(grid);
      }
    },
    onSelect: function (sel) { if (st) { st.selComp = sel.comp; } },
    unmount: function () { if (st && st.ro) st.ro.disconnect(); st = null; }
  };
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  // shared with the report so it prints exactly the same four profiles
  VJP.profileDefs = function (c, light) {
    var prev = document.documentElement.getAttribute('data-theme');
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    try { return build(c); } finally { if (light) document.documentElement.setAttribute('data-theme', prev); }
  };
})(typeof window !== 'undefined' ? window : this);
