/* ENGINEERING REPORT — preview on A4 paper, then print / "Save as PDF".
 * Built from the same design state as every page: vector schematic, vector
 * charts and structured tables (no screenshots). Units follow the display
 * system. The document states its save state honestly. */
(function (root) {
  'use strict';
  var VJP = root.VJP, U, S, DS, esc;
  var opts = { steps: true, equations: true, profiles: true, schematic: true };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function sym(m) { return S.symHTML(m); }
  function table(head, rows, cls) {
    return '<table class="rp-t' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map(function (x) { return '<th' + (x.r ? ' class="r"' : '') + '>' + x.t + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (head[i] && head[i].r ? ' class="r num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function statusWord(s) { return s === 'pass' ? '✓ PASS' : s === 'review' ? '⚠ REVIEW' : s === 'fail' ? '✕ FAIL' : 'ⓘ NOTE'; }

  function build(ctx) {
    U = VJP.units; S = VJP.schema; DS = VJP.design; esc = VJP.ui.esc;
    var store = ctx.store, D = ctx.D, sys = ctx.sys, f = VJP.ui.F(sys), R = D.R, p = store.project, rev = store.activeRev();
    var dirty = store.isDirty(), now = new Date().toISOString();
    var doc = el('article', 'rp-doc');
    var sec = 0;
    function H2(t) { sec++; return '<h2><span class="rp-n">' + sec + '</span>' + esc(t) + '</h2>'; }

    // ---------------------------------------------------------------- cover
    var stored = store._savedRev && store._savedRev();
    var saveLine = !stored ? '<b class="rp-warn">NOT STORED</b> — Rev ' + esc(rev.rev) + ' has never been saved; this report reflects the working copy'
      : dirty ? '<b class="rp-warn">UNSAVED WORKING COPY</b> — differs from Rev ' + esc(rev.rev) + ' as stored ' + VJP.ui.dateStr(store.lastSaved(), true)
      : 'Rev ' + esc(rev.rev) + ' as stored ' + VJP.ui.dateStr(store.lastSaved(), true);
    doc.appendChild(el('header', 'rp-cover',
      '<div class="rp-brand"><img src="' + VJP.ui.asset('brand/venturi-jet-pump-logo.png') + '" alt="Venturi Jet Pump — Design Calculation"></div>' +
      '<div class="rp-title"><div class="rp-kicker">Design calculation report</div><h1>Venturi Jet Pump — Ejector for MTBM Slurry Circuit</h1>' +
      '<div class="rp-sub">' + esc(p.number) + ' · ' + esc(p.name) + '</div></div>'));
    doc.appendChild(el('div', 'rp-dc', table([{ t: 'Document control' }, { t: '' }, { t: '' }, { t: '' }], [
      ['Project no.', '<b>' + esc(p.number) + '</b>', 'Revision', '<b>Rev ' + esc(rev.rev) + '</b> · ' + esc(rev.status)],
      ['Project', esc(p.name), 'Date of issue', VJP.ui.dateStr(now, true)],
      ['Client', esc(p.client || '—'), 'Prepared by', esc(p.engineer || '—')],
      ['Site / drive', esc(p.site || '—'), 'Units', sys === 'imp' ? 'Imperial (display)' : 'SI'],
      ['Calculation model', 'VENTURI_JET_PUMP_CALCULATOR_v4', 'Record state', saveLine]
    ], 'rp-dct')));

    // --------------------------------------------------------------- status
    var s = D.status, cn = s.counts;
    var b66 = !D.blocked && R.validation.overallOK;
    doc.appendChild(el('section', 'rp-s', H2('Design status') +
      '<div class="rp-status ' + s.tone + '"><div class="rp-st">' + (s.state === 'blocked' ? '✕' : s.tone === 'pass' ? '✓' : '⚠') + ' ' + esc(s.title.toUpperCase()) + '</div><div class="rp-sl">' + esc(s.line) + '</div></div>' +
      (D.blocked ? '' : '<p class="rp-p">Checks: ' + cn.pass + ' passed · ' + cn.review + ' to review · ' + cn.fail + ' failed (' + cn.critPass + ' of ' + cn.critTotal + ' design criteria met; ' + cn.advReview + ' of ' + cn.advTotal + ' advisory items require review). ' +
        'Spreadsheet overall check B66: ' + (b66 ? 'PASS' : 'REVIEW') + ' (covers solids passage, head ratio, cavitation, entrainment and the diffuser-exit velocity window only). ' +
        'A pass means the numerical criteria are met; it is not a statement of fitness for fabrication, which requires independent engineering review.</p>')));
    if (D.blocked) {
      doc.appendChild(el('section', 'rp-s', '<h3>Calculation cannot proceed</h3>' + table([{ t: 'Condition' }, { t: 'Problem' }, { t: 'Recommended action' }],
        D.V.blockers.map(function (b) { return [esc(b.title), esc(b.problem(f)), esc(b.action(f))]; }))));
      appendTail(doc, H2, ctx);
      return doc;
    }

    // ---------------------------------------------------------- key results
    doc.appendChild(el('section', 'rp-s', H2('Key results') + table([{ t: 'Result' }, { t: 'Symbol' }, { t: 'Value', r: true }, { t: 'Unit' }, { t: 'Type' }, { t: 'Criterion' }],
      DS.KEY_RESULTS.map(function (k) {
        var m = DS.METRIC[k.id], v = m.get(R), ck = k.check && D.check[k.check];
        return [esc(k.label), '<span class="sym">' + sym(m.sym) + '</span>', esc(VJP.ui.metricText(f, m, v)), esc(m.text ? '' : f.u(m.dim)), S.TYPES[m.type].short, ck ? '<span class="rp-' + ck.status + '">' + statusWord(ck.status) + '</span> ' + esc(ck.name) : '—'];
      }))));

    // ------------------------------------------------------------ geometry
    var geo = el('section', 'rp-s rp-break');
    geo.innerHTML = H2('Geometry — parametric schematic');
    if (opts.schematic && D.model) {
      var fig = el('figure', 'rp-fig');
      // canvas sized so 11–12 px annotation text prints at ≈ 6.5 pt across the 180 mm text width
      var svg = VJP.schematic.exportSVG(D, sys, { theme: 'light', width: 980, height: 440, titleBlock: false });
      svg.setAttribute('width', '100%'); svg.removeAttribute('height');
      fig.appendChild(svg);
      var ex = VJP.schematic.autoExag(D.model);
      fig.appendChild(el('figcaption', null, 'Figure ' + sec + '.1 — Parametric schematic generated from the calculated design state. Axial lengths to scale; ' +
        (ex > 1.001 ? 'diameters exaggerated ×' + ex.toFixed(2) + ' for legibility' : 'diameters to the same scale') + '. Dimensions in ' + U.unitLabel('len_mm', sys) + '. Wall thickness, suction-chamber envelope and flanges are display construction — not a fabrication drawing.'));
      geo.appendChild(fig);
    }
    var gRows = DS.METRICS.filter(function (m) { return m.g === 'geometry'; }).map(function (m) { var v = m.get(R); return [esc(m.label), '<span class="sym">' + sym(m.sym) + '</span>', esc(VJP.ui.metricText(f, m, v)), esc(f.u(m.dim)), S.TYPES[m.type].short, esc(m.ref)]; });
    geo.insertAdjacentHTML('beforeend', table([{ t: 'Geometry' }, { t: 'Symbol' }, { t: 'Value', r: true }, { t: 'Unit' }, { t: 'Type' }, { t: 'Sheet' }], gRows));
    doc.appendChild(geo);

    // --------------------------------------------------------------- inputs
    var inp = el('section', 'rp-s rp-break');
    inp.innerHTML = H2('Input parameters');
    S.SECTIONS.forEach(function (sc) {
      var rows = sc.fields.concat(sc.advanced || []).map(function (k) {
        var fl = S.BYKEY[k], v = R.inputs[k], st = D.V.fields[k] || {};
        var val = fl.select ? esc(v) : esc(f.v(Number(v), fl.dim));
        var rec = fl.rec ? esc(f.range(fl.rec, fl.dim)) : '—';
        var stt = st.status === 'warn' ? '<span class="rp-review">⚠ outside range</span>' : st.status === 'error' ? '<span class="rp-fail">✕ invalid</span>' : '<span class="rp-pass">✓</span>';
        return [esc(fl.name), '<span class="sym">' + sym(fl.sym) + '</span>', val, esc(fl.select ? '' : f.u(fl.dim)), S.TYPES[fl.type].short, rec, stt];
      });
      inp.insertAdjacentHTML('beforeend', '<h3>' + sc.no + ' · ' + esc(sc.title) + '</h3>' + table([{ t: 'Parameter' }, { t: 'Symbol' }, { t: 'Value', r: true }, { t: 'Unit' }, { t: 'Type' }, { t: 'Recommended' }, { t: '' }], rows, 'rp-inputs'));
    });
    doc.appendChild(inp);

    // ---------------------------------------------------------- calc summary
    var cs = el('section', 'rp-s rp-break');
    cs.innerHTML = H2('Calculation summary') + '<p class="rp-p">Audit trail in the engine’s dependency order, in the calculation basis (the workbook’s metric units). Cell references are to the “Jet Pump Design” sheet.</p>';
    var steps = VJP.calcsteps.STEPS, n5 = function (x) { return U.fmt(x, 5); };
    var list = opts.steps ? steps : steps.filter(function (st) { return st.check || /d_th|d_n_sel|L_th|L_d|d_diff|H$|^M$|Qd|v_n$|sigma|H_req|st3|st4/.test(st.id); });
    cs.insertAdjacentHTML('beforeend', table([{ t: '#' }, { t: 'Quantity' }, { t: 'Equation / substitution' }, { t: 'Result', r: true }, { t: 'Ref' }], list.map(function (st) {
      var v = st.res(R);
      return [String(st.no).padStart(2, '0'), esc(st.title), '<div class="rp-eq">' + sym(st.eq) + '</div><div class="rp-sub2">' + sym(st.sym || String(st.eq).split(' = ')[0]) + ' = ' + esc(st.sub(R, n5)) + '</div>',
        esc(st.sci ? U.sci(v, 4) : U.fmt(v, 5)) + (st.unit === '—' ? '' : ' ' + esc(st.unit)), esc(st.cell) + (st.ref ? '<br>Eq. ' + esc(st.ref) : '')];
    }), 'rp-calc'));
    doc.appendChild(cs);

    // --------------------------------------------------------- hydraulics
    if (opts.profiles && D.prof && VJP.profileDefs) {
      var hy = el('section', 'rp-s rp-break');
      hy.innerHTML = H2('Hydraulic profiles') + '<p class="rp-p">One-dimensional reconstruction along the axis, anchored to the calculated Bernoulli station values (markers 1–4). Physics-based approximation — not CFD.</p>';
      var grid = el('div', 'rp-charts');
      var defs = VJP.profileDefs({ D: D, f: f, sys: sys }, true);
      defs.forEach(function (d) {
        var holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:470px';
        document.body.appendChild(holder);
        var ch = VJP.charts.line(holder, { title: d.title, subtitle: d.subtitle, x: d.x, y: d.y, series: d.series, bands: d.bands, markers: d.markers, offMarkers: d.offMarkers, height: 230, width: 470, theme: 'light', interactive: false, ml: 56 });
        var svg2 = ch.exportSVG('light'); svg2.setAttribute('width', '100%'); svg2.removeAttribute('height');
        holder.remove();
        var fg = el('figure', 'rp-chart'); fg.appendChild(svg2); grid.appendChild(fg);
      });
      hy.appendChild(grid);
      var cols = [['P', 'pressure_g'], ['V', 'vel'], ['ρ', 'density'], ['h_s', 'head_m'], ['h_v', 'head_m'], ['H', 'head_m']];
      hy.insertAdjacentHTML('beforeend', '<h3>Bernoulli station profile</h3>' + table([{ t: 'Station' }].concat(cols.map(function (c) { return { t: sym(c[0]) + ' (' + esc(f.u(c[1])) + ')', r: true }; })),
        R.stations.map(function (st) { return [esc(st.id + ' — ' + st.name)].concat([st.P, st.V, st.rho, st.h_static, st.h_velocity, st.H_total].map(function (v, j) { return esc(f.v(v, cols[j][1])); })); })));
      doc.appendChild(hy);
    }

    // ---------------------------------------------------------- validation
    var va = el('section', 'rp-s rp-break');
    va.innerHTML = H2('Validation checklist');
    VJP.validation.CATEGORIES.forEach(function (cat) {
      var ks = D.checks.filter(function (k) { return k.cat === cat.id; });
      if (!ks.length) return;
      if (cat.id === 'assumptions') return;
      va.insertAdjacentHTML('beforeend', '<h3>' + esc(cat.title) + '</h3>' + table([{ t: 'Check' }, { t: 'Kind' }, { t: 'Calculated' }, { t: 'Required' }, { t: 'Status' }, { t: 'Basis' }], ks.map(function (k) {
        var val = k.sci ? U.sci(k.value, 3) : f.q(k.value, k.dim);
        var req = k.reqText ? k.reqText(f) : (function () { var q = k.req; if (!q) return '—'; function v(x) { return k.sci ? U.sci(x, 2) : f.q(x, q.dim); } return q.min !== undefined && q.max !== undefined ? v(q.min) + ' – ' + v(q.max) : q.min !== undefined ? '≥ ' + v(q.min) : '≤ ' + v(q.max); })();
        return [esc(k.name) + (k.status !== 'pass' && k.action ? '<div class="rp-act">Action: ' + esc(k.action(f)) + '</div>' : ''), VJP.validation.KINDS[k.kind].label, '<span class="sym">' + sym(k.sym) + '</span> = ' + esc(val), sym(req), '<span class="rp-' + k.status + '">' + statusWord(k.status) + '</span>', esc(k.basis)];
      }), 'rp-val'));
    });
    doc.appendChild(va);
    appendTail(doc, H2, ctx);
    return doc;
  }
  function appendTail(doc, H2, ctx) {
    var D = ctx.D;
    if (opts.equations) {
      var eq = el('section', 'rp-s rp-break');
      eq.innerHTML = H2('Governing equations') + VJP.formulas.CATS.filter(function (c) { return c.id !== 'assumptions'; }).map(function (cat) {
        return '<h3>' + esc(cat.title) + '</h3>' + table([{ t: 'Eq.' }, { t: 'Name' }, { t: 'Equation' }, { t: 'Validity' }], VJP.formulas.EQUATIONS.filter(function (e) { return e.cat === cat.id; }).map(function (e) {
          return [esc(e.id), esc(e.name), '<span class="rp-eq">' + sym(e.eq) + '</span>', esc(e.range || '')];
        }), 'rp-eqs');
      }).join('');
      doc.appendChild(eq);
    }
    var as = el('section', 'rp-s');
    var notes = D.checks && D.checks.length ? D.checks.filter(function (k) { return k.kind === 'note'; }).map(function (k) { return '<li>' + esc(k.name) + ' <span class="rp-muted">(' + esc(k.basis) + ')</span></li>'; }).join('') :
      VJP.formulas.EQUATIONS.filter(function (e) { return e.cat === 'assumptions'; }).map(function (e) { return '<li>' + esc(e.name + ': ' + S.symText(e.eq)) + '</li>'; }).join('');
    as.innerHTML = H2('Assumptions & limitations') + '<ul class="rp-list">' + notes +
      '<li>Display construction in the schematic (wall thickness, chamber envelope, throat-entry cone, flanges, outlet reducer) is proportional and not sized by the model.</li>' +
      '<li>Flow visualization and hydraulic profiles are engineering visualizations of the calculated values — not a CFD, turbulence or multiphase simulation.</li></ul>';
    doc.appendChild(as);
    var rf = el('section', 'rp-s');
    rf.innerHTML = H2('References') + '<ol class="rp-list">' + VJP.formulas.REFERENCES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol>';
    doc.appendChild(rf);
    doc.appendChild(el('section', 'rp-s rp-sign', '<table class="rp-t rp-signt"><thead><tr><th>Prepared</th><th>Checked</th><th>Approved</th></tr></thead><tbody><tr><td>' + esc(ctx.store.project.engineer || '') + '</td><td></td><td></td></tr><tr><td class="rp-muted">Name / signature / date</td><td class="rp-muted">Name / signature / date</td><td class="rp-muted">Name / signature / date</td></tr></tbody></table>'));
    doc.appendChild(el('footer', 'rp-foot', 'Generated by Venturi Jet Pump Design Studio from the calculated design state · calculation model VENTURI_JET_PUMP_CALCULATOR_v4 · ' + VJP.ui.dateStr(new Date().toISOString(), true)));
  }

  function open(ctx) {
    var rootEl = document.getElementById('reportRoot');
    var ui = VJP.ui, h = ui.h, icon = ui.icon;
    rootEl.innerHTML = '';
    rootEl.hidden = false;
    document.documentElement.classList.add('report-open');
    var p = ctx.store.project, rev = ctx.store.activeRev();
    var pageStyle = document.getElementById('rpPageStyle') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'rpPageStyle' }));
    var foot = (p.number + ' · Rev ' + rev.rev + (ctx.store.isDirty() ? ' (unsaved working copy)' : '') + ' — Venturi Jet Pump design report').replace(/"/g, "'");
    pageStyle.textContent = '@page { size: A4; margin: 14mm 13mm 16mm; @bottom-left { content: "' + foot + '"; font: 8pt Inter, sans-serif; color: #5B687D; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, sans-serif; color: #5B687D; } }';
    var bar = h('div', { class: 'rp-bar' });
    function opt(key, label) {
      var i = h('input', { type: 'checkbox' }); i.checked = !!opts[key];
      i.addEventListener('change', function () { opts[key] = i.checked; render(); });
      return h('label', { class: 'switch' }, i, h('span', { class: 'tr' }), h('span', { text: label }));
    }
    var close = h('button', { class: 'btn', type: 'button', html: icon('x') + 'Close' });
    var print = h('button', { class: 'btn primary', type: 'button', html: icon('report') + 'Print / Save as PDF' });
    bar.append(h('div', { class: 'rp-bar-t', html: '<b>Engineering report</b> <span class="muted">preview · A4</span>' }), opt('schematic', 'Schematic'), opt('profiles', 'Hydraulic profiles'), opt('steps', 'Full calculation steps'), opt('equations', 'Equations'),
      h('div', { class: 'tb-sp' }), h('span', { class: 'rp-tip muted', 'data-tip': 'Print dialog tip', 'data-tip-s': 'Turn off the browser’s own headers and footers; the report prints its own page footer with project, revision and page numbers.', html: icon('info', 'sm') + 'Print tips' }), close, print);
    var scroller = h('div', { class: 'rp-scroll' });
    rootEl.append(bar, scroller);
    function render() { scroller.innerHTML = ''; scroller.appendChild(build(ctx)); }
    render();
    function done() { rootEl.hidden = true; rootEl.innerHTML = ''; document.documentElement.classList.remove('report-open'); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); done(); } }
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', done);
    print.addEventListener('click', function () { window.print(); });
    setTimeout(function () { print.focus(); }, 0);
  }

  root.VJP = root.VJP || {};
  root.VJP.report = { open: open, build: build, options: opts };
})(typeof window !== 'undefined' ? window : this);
