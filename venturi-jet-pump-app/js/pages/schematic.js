/* SCHEMATIC — Engineering Schematic / Flow Visualization of the parametric model,
 * with zoom/pan, dimension & label toggles, exports and component inspection.
 * The inspector lists engine results only (via design.METRICS) — no
 * calculation is repeated here. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, DS = VJP.design;
  VJP.pages = VJP.pages || {};

  // Component inspector content: ids into METRICS (single source), plus station & checks
  var INSPECT = {
    motive:    { title: 'Motive inlet', desc: 'Supply connection and straight run upstream of the nozzle.', metrics: ['D_n_in', 'v_m', 'P_hyd', 'hf_inlet', 'dPf_inlet'], inputs: ['motiveID', 'Qm_Lmin', 'Pm', 'rho_m'], station: 0, checks: ['vm'] },
    nozzle:    { title: 'Nozzle', desc: 'Converging nozzle — accelerates the motive flow into the jet.', metrics: ['d_n_sel', 'd_n_flow', 'L_n', 'v_n', 'v_n_th', 'dP_nozzle', 'hl_nozzle', 'sigma'], inputs: ['alpha_n', 'Cd', 'nozzleExitFactor'], station: 1, checks: ['convergent', 'vn', 'sigma'] },
    suction:   { title: 'Suction inlet', desc: 'Entrained slurry connection into the suction chamber.', metrics: ['Qs', 'v_s', 'rho_mix'], inputs: ['suctionID', 'Ps', 'Cw', 'SG_s'], station: 2, checks: ['vs'] },
    chamber:   { title: 'Mixing chamber', desc: 'Suction chamber and nozzle–throat gap where the jet entrains the slurry.', metrics: ['gap_s', 'M', 'Qs', 'Qd', 'rho_do'], inputs: ['eta_jp'], station: 2, checks: ['annulus', 'M'] },
    throat:    { title: 'Throat', desc: 'Constant-area mixing tube — momentum exchange completes here.', metrics: ['d_th', 'd_th_p', 'd_th_h', 'L_th', 'A_th', 'R_ratio', 'r_act', 'V_th', 'hl_mixing'], inputs: ['k_th', 'd_p_max', 'SF', 'MFPR', 'rec_dn_dth'], station: 3, checks: ['solids', 'R', 'r'] },
    diffuser:  { title: 'Diffuser', desc: 'Conical diffuser — converts velocity head back into pressure.', metrics: ['d_diff', 'L_d', 'AR_d', 'Cr', 'v_d', 'h_s4', 'hl_diffuser'], inputs: ['alpha_d', 'Ld_dth'], station: 4, checks: ['alpha_d', 'Ld', 'settle', 'vmax', 'head'] },
    discharge: { title: 'Discharge', desc: 'Outlet connection to the return line.', metrics: ['Qd', 'V_disch', 'Re', 'f', 'Vc', 'V_over_Vc', 'H_req', 'dP_req'], inputs: ['dischargeID', 'L_pipe', 'pipeMaterial', 'Pback'], station: null, checks: ['diffPipe', 'vret', 'Re', 'cuttings'] }
  };
  var COMP_ORDER = ['motive', 'nozzle', 'suction', 'chamber', 'throat', 'diffuser', 'discharge'];
  var st = null;
  var memo = { mode: 'engineering', flowPlaying: true };

  function statusGlyph(s) { return '<span class="si ' + s + '">' + icon(s === 'pass' ? 'check' : s === 'fail' ? 'x' : s === 'note' ? 'info' : 'alert', 'sm') + '</span>'; }

  function tooltipHTML(c, cid) {
    var D = c.D, f = c.f, R = D.R, I = INSPECT[cid]; if (!I || D.blocked) return '';
    var rows = I.metrics.slice(0, 3).map(function (id) {
      var m = DS.METRIC[id], v = m.get(R);
      return '<div class="tt-r"><span>' + esc(m.label) + '</span><b class="num">' + esc(ui.metricText(f, m, v)) + ' ' + esc(m.text ? '' : f.u(m.dim)) + '</b></div>';
    }).join('');
    return '<div class="tt-h">' + esc(I.title) + '</div>' + rows + '<div class="tt-f">Click to inspect</div>';
  }

  function inspector(c) {
    var D = c.D, f = c.f, cid = st.sel, box = st.insp;
    box.innerHTML = '';
    // component list (keyboard-accessible alternative to clicking the drawing)
    var list = h('div', { class: 'insp-list', role: 'listbox', 'aria-label': 'Components' });
    COMP_ORDER.forEach(function (id) {
      var I = INSPECT[id], cm = VJP.geometry.COMP_BY_ID[id];
      var worst = 'pass';
      if (!D.blocked) I.checks.forEach(function (k) { var ck = D.check[k]; if (!ck) return; if (ck.status === 'fail') worst = 'fail'; else if (ck.status === 'review' && worst !== 'fail') worst = 'review'; });
      var b = h('button', { class: 'insp-item' + (id === cid ? ' on' : ''), type: 'button', role: 'option', 'aria-selected': String(id === cid),
        html: '<span class="ii-no">' + cm.no + '</span><span class="ii-t">' + esc(I.title) + '</span>' + (D.blocked ? '' : statusGlyph(worst)) });
      b.addEventListener('click', function () { select(c, id === st.sel ? null : id, true); });
      b.addEventListener('mouseenter', function () { if (st.viewer) st.viewer.hover(id); });
      b.addEventListener('mouseleave', function () { if (st.viewer) st.viewer.hover(null); });
      list.appendChild(b);
    });
    box.appendChild(h('div', { class: 'insp-head' }, h('span', { class: 'eyebrow', text: 'Components' }), h('span', { class: 'muted', style: { fontSize: '12px' }, text: 'Click a part of the drawing or a row' })));
    box.appendChild(list);
    if (D.blocked) return;
    if (!cid) {
      box.appendChild(h('div', { class: 'insp-empty', html: icon('crosshair', 'lg') + '<p>Select a component to see its calculated dimensions, hydraulic values and engineering status.</p>' }));
      return;
    }
    var I = INSPECT[cid], R = D.R;
    var card = h('div', { class: 'insp-card' });
    card.appendChild(h('div', { class: 'insp-title' }, h('h3', { text: I.title }), h('p', { text: I.desc })));
    var t = h('table', { class: 'tbl insp-tbl' });
    var tb = h('tbody');
    I.metrics.forEach(function (id) {
      var m = DS.METRIC[id], v = m.get(R);
      // type tag only where it matters (inputs, derived, empirical) — calculated is the default
      var lab = h('td', { html: esc(m.label) + ' <span class="sym">' + S.symHTML(m.sym) + '</span> ' });
      if (m.type !== 'calculated') lab.appendChild(ui.vt(m.type));
      var tr = h('tr', null, lab, h('td', { class: 'val', text: ui.metricText(f, m, v) }), h('td', { class: 'unit', text: m.text ? '' : f.u(m.dim) }));
      tr.addEventListener('mouseenter', function () { if (st.viewer) st.viewer.highlightDim(dimFor(id)); });
      tr.addEventListener('mouseleave', function () { if (st.viewer) st.viewer.highlightDim(null); });
      tb.appendChild(tr);
    });
    if (I.station !== null && I.station !== undefined) {
      var s = R.stations[I.station];
      tb.appendChild(h('tr', { class: 'tbl-grouphead' }, h('td', { colspan: '3', text: 'Bernoulli station ' + s.id + ' — ' + s.name })));
      [['Static pressure', 'P', s.P, 'pressure_g'], ['Velocity', 'V', s.V, 'vel'], ['Total head', 'H', s.H_total, 'head_m']].forEach(function (x) {
        tb.appendChild(h('tr', null, h('td', { html: esc(x[0]) + ' <span class="sym">' + S.symHTML(x[1] + '_{' + s.id + '}') + '</span>' }), h('td', { class: 'val', text: f.v(x[2], x[3]) }), h('td', { class: 'unit', text: f.u(x[3]) })));
      });
    }
    t.appendChild(tb);
    card.appendChild(h('div', { class: 'tbl-wrap' }, t));
    // engineering status of this component
    var ck = h('div', { class: 'insp-checks' });
    ck.appendChild(h('div', { class: 'eyebrow', text: 'Engineering status' }));
    I.checks.forEach(function (k) {
      var x = D.check[k]; if (!x) return;
      var b = h('button', { class: 'insp-check', type: 'button', html: statusGlyph(x.status) + '<span>' + esc(x.name) + '</span><span class="ic-v num">' + esc(x.sci ? U.sci(x.value, 3) : f.v(x.value, x.dim)) + ' ' + esc(f.u(x.dim)) + '</span>' });
      b.addEventListener('click', function () { c.nav('validation', { check: k }); });
      ck.appendChild(b);
    });
    card.appendChild(ck);
    // inputs that shape this component
    var inp = h('div', { class: 'insp-inputs' }, h('div', { class: 'eyebrow', text: 'Governing inputs' }));
    var row = h('div', { class: 'insp-chips' });
    I.inputs.forEach(function (k) {
      var fl = S.BYKEY[k], v = R.inputs[k];
      var b = h('button', { class: 'chip-btn', type: 'button', 'data-tip': 'Edit on the Inputs page', html: '<span class="sym">' + S.symHTML(fl.sym || fl.name) + '</span> <b class="num">' + esc(fl.select ? v : f.v(Number(v), fl.dim)) + '</b> <span class="muted">' + esc(fl.select ? '' : f.u(fl.dim)) + '</span>' });
      b.addEventListener('click', function () { c.nav('inputs', { f: k }); });
      row.appendChild(b);
    });
    inp.appendChild(row);
    card.appendChild(inp);
    var links = h('div', { class: 'insp-links' },
      h('button', { class: 'btn sm', type: 'button', html: icon('results') + 'View in Results', onClick: function () { c.nav('results', { c: cid }); } }),
      h('button', { class: 'btn sm', type: 'button', html: icon('profiles') + 'Show on profiles', onClick: function () { c.nav('profiles', { c: cid }); } }),
      h('button', { class: 'btn sm ghost', type: 'button', html: icon('zoom-in') + 'Zoom to', onClick: function () { st.viewer.focusComponent(cid); } }));
    card.appendChild(links);
    box.appendChild(card);
  }
  function dimFor(metricId) {
    return { D_n_in: 'D_in', d_n_sel: 'd_n', d_th: 'd_th', L_th: 'L_th', L_n: 'L_n', gap_s: 's', d_diff: 'd_diff', L_d: 'L_d' }[metricId] || null;
  }
  function select(c, cid, fromUser) {
    st.sel = cid || null;
    c.app.selection.comp = st.sel;
    if (st.viewer) st.viewer.select(st.sel);
    inspector(c);
    if (fromUser) history.replaceState(null, '', '#/schematic' + (st.sel ? '?c=' + st.sel : ''));
  }

  function toolbar(c) {
    var tb = h('div', { class: 'sch-tb', role: 'toolbar', 'aria-label': 'Schematic tools' });
    var mode = h('div', { class: 'seg brand', role: 'radiogroup', 'aria-label': 'View mode' });
    [['engineering', 'schematic', 'Engineering', 'Engineering schematic — geometry, dimensions, components'], ['flow', 'wind', 'Flow', 'Calculated flow visualization — motive jet, entrainment, solids']].forEach(function (m) {
      var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(memo.mode === m[0]), 'data-tip': m[3], html: icon(m[1], 'sm') + esc(m[2]) });
      b.addEventListener('click', function () { setMode(c, m[0]); });
      mode.appendChild(b);
    });
    st.modeSeg = mode;
    function tbtn(ic, label, fn, extra) { var b = h('button', { class: 'btn sm icon' + (extra || ''), type: 'button', 'aria-label': label, 'data-tip': label, html: icon(ic) }); b.addEventListener('click', fn); return b; }
    var zin = tbtn('zoom-in', 'Zoom in (+)', function () { st.viewer.zoomBy(1.3, st.viewer.W / 2, st.viewer.H / 2); });
    var zout = tbtn('zoom-out', 'Zoom out (−)', function () { st.viewer.zoomBy(0.77, st.viewer.W / 2, st.viewer.H / 2); });
    var fit = tbtn('fit', 'Fit to screen (F)', function () { st.viewer.fit(); });
    var reset = tbtn('reset', 'Reset view', function () { st.viewer.set({ exag: 'auto' }); select(c, null, true); st.viewer.fit(); syncToggles(); });
    st.zoomLbl = h('span', { class: 'sch-zoom num', 'data-tip': 'Zoom relative to fit' });
    var viewGrp = h('div', { class: 'btn-group' }, zout, zin, fit, reset);
    function tog(key, label, ic, tip) {
      var iconOnly = key === 'simplified';
      var b = h('button', { class: 'btn sm' + (iconOnly ? ' icon' : ''), type: 'button', 'aria-pressed': 'false', 'aria-label': iconOnly ? tip : null, 'data-tip': tip, html: icon(ic, 'sm') + (iconOnly ? '' : esc(label)) });
      b.addEventListener('click', function () { var p = {}; p[key] = !st.viewer.s[key]; st.viewer.set(p); saveState(c); syncToggles(); });
      b._key = key; return b;
    }
    st.toggles = [tog('dims', 'Dims', 'ruler', 'Show dimensions (D)'), tog('labels', 'Labels', 'tag', 'Show component labels & flow rates (L)'), tog('stations', 'Stations', 'station', 'Show Bernoulli stations 1, 2, 2s, 3, 4'), tog('simplified', 'Simple', 'layers', 'Simplified linework (no hatching or flanges)')];
    var exag = h('button', { class: 'btn sm', type: 'button', 'data-tip': 'Toggle true 1 : 1 radial scale', html: icon('grid', 'sm') + '<span class="ex-l">1 : 1</span>' });
    exag.addEventListener('click', function () { st.viewer.set({ exag: st.viewer.s.exag === 'auto' ? 1 : 'auto' }); saveState(c); syncToggles(); });
    st.exagBtn = exag;
    var exp = h('button', { class: 'btn sm icon', type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Export drawing', 'data-tip': 'Export drawing', 'data-tip-s': 'SVG (vector) or PNG, dark or print/light', html: icon('download', 'sm') });
    exp.addEventListener('click', function () {
      ui.menu(exp, [
        { head: 'Engineering drawing' },
        { label: 'SVG (vector) — dark', icon: 'code', onClick: function () { exportDrawing(c, 'svg', 'dark'); } },
        { label: 'SVG (vector) — print / light', icon: 'code', onClick: function () { exportDrawing(c, 'svg', 'light'); } },
        { label: 'PNG (2×) — dark', icon: 'image', onClick: function () { exportDrawing(c, 'png', 'dark'); } },
        { label: 'PNG (2×) — print / light', icon: 'image', onClick: function () { exportDrawing(c, 'png', 'light'); } }
      ]);
    });
    tb.append(mode, h('div', { class: 'tb-sep' }), viewGrp, st.zoomLbl, h('div', { class: 'tb-sep' }), st.toggles[0], st.toggles[1], st.toggles[2], st.toggles[3], exag, h('div', { class: 'tb-sp' }), exp);
    return tb;
  }
  function syncToggles() {
    if (!st || !st.viewer) return;
    var s = st.viewer.s, flow = s.mode === 'flow';
    st.toggles.forEach(function (b) {
      var on = !!s[b._key];
      b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
      b.disabled = flow && (b._key === 'dims' || b._key === 'simplified');
    });
    st.exagBtn.classList.toggle('on', s.exag === 1);
    st.exagBtn.setAttribute('aria-pressed', String(s.exag === 1));
    Array.prototype.forEach.call(st.modeSeg.children, function (b, i) { b.setAttribute('aria-checked', String((i === 0 ? 'engineering' : 'flow') === s.mode)); });
    updateScaleChip();
  }
  function updateScaleChip() {
    if (!st || !st.viewer || !st.viewer.M) return;
    var n = st.viewer.scaleNote();
    st.zoomLbl.textContent = n.zoom;
    st.scaleChip.innerHTML = '<span class="sc-a">' + icon('ruler', 'xs') + esc(n.axial) + '</span><span class="sc-r' + (n.exaggerated ? ' ex' : '') + '">' + esc(n.radial) + '</span><span class="sc-u">Dimensions in ' + esc(U.unitLabel('len_mm', st.sys)) + '</span>';
    st.scaleChip.setAttribute('data-tip', n.exaggerated ? 'Display scale ≠ engineering scale' : 'Display scale = engineering scale');
    st.scaleChip.setAttribute('data-tip-s', n.exaggerated ? 'Axial lengths are drawn to scale; diameters are exaggerated ×' + n.e.toFixed(2) + ' for legibility. All dimension values are the calculated values.' : 'Lengths and diameters are drawn to the same scale.');
  }
  function saveState(c) {
    var s = st.viewer.s;
    c.setPref('schematic', { dims: s.dims, labels: s.labels, stations: s.stations, exag: s.exag, simplified: s.simplified, arrows: s.arrows });
  }

  /* -------------------------------------------------------- flow controls */
  function flowBar(c) {
    var bar = h('div', { class: 'flow-bar', role: 'toolbar', 'aria-label': 'Flow visualization controls' });
    var play = h('button', { class: 'btn sm', type: 'button' });
    play.addEventListener('click', function () {
      if (ui.reducedMotion()) { ui.toast('Reduced motion is on — showing a static frame', 'info'); return; }
      memo.flowPlaying = !st.flow.playing;
      if (memo.flowPlaying) st.flow.play(); else st.flow.stop();
      syncFlow();
    });
    var rst = h('button', { class: 'btn sm icon', type: 'button', 'aria-label': 'Restart', 'data-tip': 'Restart particles', html: icon('skip-back') });
    rst.addEventListener('click', function () { st.flow.reset(); });
    var spd = h('input', { class: 'range', type: 'range', min: '0.25', max: '3', step: '0.25', value: String(st.flow.cfg.speed), 'aria-label': 'Playback multiplier' });
    var spdL = h('span', { class: 'num flow-spd' });
    spd.addEventListener('input', function () { st.flow.set({ speed: Number(spd.value) }); saveFlow(c); syncFlow(); });
    function sw(key, label, ic) {
      var inp = h('input', { type: 'checkbox' }); inp.checked = !!st.flow.cfg[key];
      inp.addEventListener('change', function () { var p = {}; p[key] = inp.checked; st.flow.set(p); saveFlow(c); });
      return h('label', { class: 'switch', 'data-tip': label }, inp, h('span', { class: 'tr' }), h('span', { html: icon(ic, 'sm') + esc(label) }));
    }
    var rm = h('input', { type: 'checkbox' }); rm.checked = ui.reducedMotion();
    rm.addEventListener('change', function () { c.setPref('reducedMotion', rm.checked); document.documentElement.classList.toggle('reduce-motion', rm.checked); document.documentElement.classList.toggle('motion-ok', !rm.checked); st.flow.setReduced(rm.checked); if (!rm.checked && memo.flowPlaying) st.flow.play(); syncFlow(); });
    bar.append(play, rst, h('span', { class: 'flow-lbl', text: 'Playback' }), spd, spdL, h('div', { class: 'tb-sep' }),
      sw('motive', 'Motive', 'droplet'), sw('particles', 'Slurry & solids', 'particles'), sw('field', 'Velocity field', 'layers'), sw('arrows', 'Arrows', 'wind'),
      h('div', { class: 'tb-sp' }), h('label', { class: 'switch', 'data-tip': 'Reduced motion — static frame' }, rm, h('span', { class: 'tr' }), h('span', { html: icon('motion', 'sm') + 'Reduced motion' })));
    st.playBtn = play; st.spdL = spdL;
    return bar;
  }
  function saveFlow(c) { var f = st.flow.cfg; c.setPref('flow', { motive: f.motive, particles: f.particles, field: f.field, arrows: f.arrows, speed: f.speed }); }
  function syncFlow() {
    if (!st || !st.flow) return;
    var on = st.flow.playing && !ui.reducedMotion();
    st.playBtn.innerHTML = icon(on ? 'pause' : 'play', 'sm') + (on ? 'Pause' : 'Play');
    st.spdL.textContent = '×' + st.flow.cfg.speed.toFixed(2).replace(/0$/, '');
    var inf = st.flow.info(), f = st.f;
    if (!inf) { st.hud.innerHTML = ''; return; }
    var pb = inf.playback;
    st.hud.innerHTML =
      '<div class="hud-t">' + icon('wind', 'sm') + 'Calculated flow visualization <span class="hud-nc">not CFD</span></div>' +
      '<div class="hud-r">Speed ∝ calculated local velocity · reference ' + '<span class="sym">v<sub>n</sub></span> = <b class="num">' + esc(f.q(inf.vref, 'vel')) + '</b></div>' +
      '<div class="hud-r">Playback ≈ <b class="num">1/' + esc(pb >= 10 ? Math.round(pb) : pb.toFixed(1)) + '</b> of real time' + (ui.reducedMotion() ? ' · <b>static frame (reduced motion)</b>' : !on ? ' · <b>paused</b>' : '') + '</div>' +
      '<div class="hud-leg"><span><i class="lg-m"></i>Motive fluid</span><span><i class="lg-s"></i>Entrained slurry</span><span><i class="lg-d"></i>Solids ≤ ' + esc(f.q(inf.dmax, 'len_mm', 3)) + ' (d₅₀ ' + esc(f.q(inf.d50, 'len_mm', 3)) + ')</span></div>' +
      (inf.settle > 0 ? '<div class="hud-r warn">' + icon('alert', 'xs') + ' Settling tendency shown — V/V<sub>c</sub> below 1.2 in the return line</div>' : '');
    var vmax = inf.vref;
    st.legend.innerHTML = '<div class="leg-t">|V| velocity (' + esc(f.u('vel')) + ')</div><div class="leg-bar"></div><div class="leg-ticks"><span>0</span><span>' + esc(f.v(vmax * 0.25, 'vel', 2)) + '</span><span>' + esc(f.v(vmax, 'vel', 3)) + '</span></div><div class="leg-n">√-scaled · assumed radial profile</div>';
  }
  function setMode(c, mode) {
    memo.mode = mode;
    st.viewer.set({ mode: mode });
    var flow = mode === 'flow';
    st.root.classList.toggle('mode-flow', flow);
    st.flow.activate(flow);
    if (flow) { if (memo.flowPlaying && !ui.reducedMotion()) st.flow.play(); else st.flow.render(); }
    syncToggles(); syncFlow();
  }

  function exportDrawing(c, kind, theme) {
    var D = c.D, p = c.store.project, r = c.store.activeRev();
    var svg = VJP.schematic.exportSVG(D, c.sys, { theme: theme, dims: st.viewer.s.dims, labels: st.viewer.s.labels, stations: st.viewer.s.stations, exag: st.viewer.s.exag,
      project: p.number + ' — ' + p.name, revision: 'Rev ' + r.rev + ' · ' + r.status + (c.store.isDirty() ? ' (unsaved)' : ''), date: ui.dateStr(new Date().toISOString()) });
    var base = p.number + '_Rev' + r.rev + '_schematic' + (theme === 'light' ? '_print' : '');
    if (kind === 'svg') { ui.download(base + '.svg', VJP.schematic.serialize(svg), 'image/svg+xml'); ui.toast('Schematic exported (SVG)'); }
    else VJP.schematic.toPNG(svg, 2, function (blob) { if (blob) { ui.download(base + '.png', blob); ui.toast('Schematic exported (PNG)'); } else ui.toast('PNG export failed in this browser', 'fail'); });
  }

  VJP.pages.schematic = {
    mount: function (el, c) {
      st = { sys: c.sys, f: c.f, sel: c.params.c || c.app.selection.comp || null };
      if (c.params.mode === 'flow') memo.mode = 'flow';
      var page = h('div', { class: 'page page-schematic full' });
      st.root = page;
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>04</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Schematic' }),
          h('p', { class: 'page-desc', text: 'Generated from the calculated design state — every change to the inputs redraws the geometry. Click a component to inspect it; scroll to zoom, drag to pan.' })),
        h('div', { class: 'ph-r' }, st.scaleChip = h('div', { class: 'scale-chip', tabindex: '0' }))));
      if (c.D.blocked) {
        page.appendChild(blockedPanel(c, 'The schematic cannot be generated'));
        el.appendChild(page); return;
      }
      var layout = h('div', { class: 'sch-layout' });
      var stage = h('div', { class: 'sch-stage panel' });
      stage.appendChild(toolbar(c));
      var vwBox = h('div', { class: 'sch-box' });
      stage.appendChild(vwBox);
      st.hud = h('div', { class: 'flow-hud', 'aria-live': 'polite' });
      st.legend = h('div', { class: 'flow-legend' });
      vwBox.appendChild(st.hud); vwBox.appendChild(st.legend);
      var viewerEl = h('div', { class: 'sch-canvas' });
      vwBox.insertBefore(viewerEl, st.hud);
      layout.appendChild(stage);
      st.insp = h('aside', { class: 'sch-insp panel', 'aria-label': 'Component inspector' });
      layout.appendChild(st.insp);
      page.appendChild(layout);
      el.appendChild(page);

      var saved = c.prefs.schematic || {};
      st.viewer = VJP.schematic.create(viewerEl, { state: { dims: saved.dims !== false, labels: saved.labels !== false, stations: !!saved.stations, exag: saved.exag === 1 ? 1 : 'auto', simplified: !!saved.simplified, arrows: saved.arrows !== false, mode: memo.mode },
        tooltip: function (cid) { return tooltipHTML(c, cid); } });
      st.flow = VJP.flow.create(st.viewer, { cfg: c.prefs.flow || {} });
      stage.appendChild(flowBar(c));
      st.viewer.on('select', function (cid) { select(c, cid, true); });
      st.viewer.on('view', function () { updateScaleChip(); });
      st.viewer.on('state', function () { saveState(c); syncToggles(); });
      st.viewer.setDesign(c.D, c.f);
      st.flow.setDesign(c.D);
      st.flow.setReduced(ui.reducedMotion());
      st.viewer.select(st.sel);
      setMode(c, memo.mode);
      inspector(c);
      if (c.params.dim) st.viewer.highlightDim(c.params.dim);
      // keyboard: space toggles playback in flow mode
      viewerEl.addEventListener('keydown', function (e) { if (e.key === ' ' && memo.mode === 'flow') { e.preventDefault(); st.playBtn.click(); } });
    },
    update: function (c) {
      if (!st) return;
      if (c.D.blocked !== !st.viewer || !st.viewer) { this.unmount(); var el = document.getElementById('page'); el.innerHTML = ''; this.mount(el, c); return; }
      st.f = c.f; st.sys = c.sys;
      st.viewer.setDesign(c.D, c.f);
      st.flow.setDesign(c.D);
      if (st.flow.active && !st.flow.playing) st.flow.render();
      inspector(c); syncToggles(); syncFlow();
    },
    onSelect: function (sel) { if (st && st.viewer) { st.sel = sel.comp; st.viewer.select(sel.comp); } },
    unmount: function () { if (st) { if (st.flow) st.flow.destroy(); if (st.viewer) st.viewer.destroy(); } st = null; }
  };

  function blockedPanel(c, title) {
    var D = c.D;
    var box = h('div', { class: 'panel' }, h('div', { class: 'panel-b' },
      h('div', { class: 'empty', style: { paddingBottom: '16px' } },
        h('img', { src: ui.asset('brand/venturi-jet-pump-mark.png'), alt: '' }),
        h('h3', { text: title }),
        h('p', { text: 'Calculation cannot proceed — ' + D.status.line + '. The geometry is only drawn from a valid calculated design, so no stale drawing is shown.' })),
      blockerList(c)));
    return box;
  }
  function blockerList(c) {
    var f = c.f, list = h('div', { class: 'blockers' });
    c.D.V.blockers.forEach(function (b) {
      var params = h('div', { class: 'bk-params' });
      b.params.forEach(function (k) { var fl = S.BYKEY[k]; if (!fl) return; params.appendChild(h('button', { class: 'chip-btn', type: 'button', html: '<span class="sym">' + S.symHTML(fl.sym || '') + '</span> ' + esc(fl.name), onClick: function () { c.nav('inputs', { f: k }); } })); });
      list.appendChild(h('div', { class: 'blocker' },
        h('span', { class: 'bk-ic', html: icon('x-circle', 'lg') }),
        h('div', { class: 'bk-t', text: b.title }),
        h('div', { class: 'bk-row', html: '<b>Problem</b>' + esc(b.problem(f)) }),
        h('div', { class: 'bk-row', html: '<b>Why it matters</b>' + esc(b.why) }),
        h('div', { class: 'bk-row', html: '<b>Recommended action</b>' + esc(b.action(f)) }), b.params.length ? params : null));
    });
    return list;
  }
  VJP.pages._blockerList = blockerList;
  VJP.pages._blockedPanel = blockedPanel;
})(typeof window !== 'undefined' ? window : this);
