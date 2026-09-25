/* VALIDATION — engineering design review of the authoritative design state. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, V = VJP.validation;
  VJP.pages = VJP.pages || {};
  var filter = 'all', closed = {};

  function valText(k, f) { if (typeof k.value !== 'number' || !isFinite(k.value)) return '—'; return k.sci ? U.sci(k.value, 3) : f.q(k.value, k.dim, k.dim === 'ratio' ? 4 : undefined); }
  // requirement statement in symbol markup (render with S.symHTML; S.symText for CSV)
  function reqText(k, f) {
    if (k.reqText) return k.reqText(f);
    var q = k.req; if (!q) return '—';
    function v(x) { return k.sci ? U.sci(x, 2) : f.q(x, q.dim, 4); }
    var sym = k.sym;
    if (q.min !== undefined && q.max !== undefined) return v(q.min) + ' ≤ ' + sym + ' ≤ ' + v(q.max);
    if (q.min !== undefined) return sym + ' ' + (q.op || '≥') + ' ' + (q.sym ? q.sym + ' = ' : '') + v(q.min);
    if (q.max !== undefined) return sym + ' ≤ ' + (q.sym ? q.sym + ' = ' : '') + v(q.max);
    return '—';
  }
  function marginText(k) {
    if (k.margin === null || k.margin === undefined || !isFinite(k.margin)) return '';
    var p = k.margin * 100;
    return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(Math.abs(p) >= 100 ? 0 : 1) + ' % to limit';
  }
  // small limit gauge: acceptable region + value marker (linear scales only)
  function gauge(k) {
    var q = k.req; if (!q || k.sci || typeof k.value !== 'number' || !isFinite(k.value)) return null;
    var vals = [k.value, q.min, q.max].filter(function (x) { return typeof x === 'number' && isFinite(x); });
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max.apply(null, vals) * 1.25;
    if (!(hi > lo)) return null;
    var W = 150, H = 16, sx = function (x) { return 2 + (x - lo) / (hi - lo) * (W - 4); };
    var a0 = q.min !== undefined ? sx(q.min) : 2, a1 = q.max !== undefined ? sx(q.max) : W - 2;
    var cls = ui.statusClass(k.status);
    var svg = '<svg class="gauge" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<rect x="2" y="6" width="' + (W - 4) + '" height="4" rx="2" class="g-track"/>' +
      '<rect x="' + a0.toFixed(1) + '" y="6" width="' + Math.max(1, a1 - a0).toFixed(1) + '" height="4" rx="2" class="g-ok"/>' +
      (q.min !== undefined ? '<line x1="' + a0.toFixed(1) + '" y1="3" x2="' + a0.toFixed(1) + '" y2="13" class="g-lim"/>' : '') +
      (q.max !== undefined ? '<line x1="' + a1.toFixed(1) + '" y1="3" x2="' + a1.toFixed(1) + '" y2="13" class="g-lim"/>' : '') +
      '<path d="M' + sx(k.value).toFixed(1) + ' 11 l-4.5 5 h9 z" class="g-val ' + cls + '"/><line x1="' + sx(k.value).toFixed(1) + '" y1="2" x2="' + sx(k.value).toFixed(1) + '" y2="11" class="g-val-l ' + cls + '"/></svg>';
    return h('span', { class: 'gauge-w', html: svg });
  }

  function checkEl(k, c) {
    var f = c.f, cls = ui.statusClass(k.status);
    var el = h('article', { class: 'vcheck ' + cls, id: 'chk-' + k.id, 'data-status': k.status });
    var head = h('div', { class: 'vc-h' },
      ui.badge(k.status, k.status === 'pass' ? 'Pass' : k.status === 'review' ? 'Review' : k.status === 'fail' ? 'Fail' : 'Note'),
      h('div', { class: 'vc-t' }, h('h3', { text: k.name }), k.what ? h('p', { text: k.what }) : null),
      k.kind !== 'note' ? h('span', { class: 'kind k-' + k.kind, 'data-tip': V.KINDS[k.kind].label, 'data-tip-s': V.KINDS[k.kind].desc, tabindex: '0', text: V.KINDS[k.kind].label }) : null);
    el.appendChild(head);
    if (k.kind === 'note') { el.appendChild(h('div', { class: 'vc-basis', html: '<b>Basis</b> ' + esc(k.basis) })); return el; }
    var grid = h('div', { class: 'vc-grid' },
      h('div', { class: 'vc-cell' }, h('div', { class: 'vc-k', text: 'Calculated' }), h('div', { class: 'vc-v num', html: '<span class="sym">' + S.symHTML(k.sym) + '</span> = ' + esc(valText(k, f)) })),
      h('div', { class: 'vc-cell' }, h('div', { class: 'vc-k', text: 'Required' }), h('div', { class: 'vc-v num', html: S.symHTML(reqText(k, f)) })),
      h('div', { class: 'vc-cell' }, h('div', { class: 'vc-k', text: 'Margin' }), h('div', { class: 'vc-v' }, h('span', { class: 'num', text: marginText(k) || '—' }), gauge(k))));
    el.appendChild(grid);
    el.appendChild(h('div', { class: 'vc-basis', html: '<b>Basis / source</b> ' + esc(k.basis) }));
    if (k.status !== 'pass') {
      if (k.why) el.appendChild(h('div', { class: 'vc-row', html: '<b>Why it matters</b> ' + esc(k.why) }));
      if (k.action) el.appendChild(h('div', { class: 'vc-row act', html: '<b>Recommended action</b> ' + esc(k.action(f)) }));
    }
    var foot = h('div', { class: 'vc-foot' });
    if (k.params && k.params.length) {
      foot.appendChild(h('span', { class: 'vc-k', text: 'Responsible inputs' }));
      k.params.forEach(function (p) {
        var fl = S.BYKEY[p]; if (!fl) return;
        var b = h('button', { class: 'chip-btn', type: 'button', 'data-tip': fl.name, html: '<span class="sym">' + S.symHTML(fl.sym || fl.name) + '</span> <b class="num">' + esc(fl.select ? c.D.R.inputs[p] : f.v(Number(c.D.R.inputs[p]), fl.dim)) + '</b> <span class="muted">' + esc(fl.select ? '' : f.u(fl.dim)) + '</span>' });
        b.addEventListener('click', function () { c.nav('inputs', { f: p }); });
        foot.appendChild(b);
      });
    }
    var sp = h('span', { class: 'sp' }); foot.appendChild(sp);
    if (k.pbackAction && k.status !== 'pass') foot.appendChild(h('button', { class: 'btn xs', type: 'button', html: icon('target', 'xs') + 'Use computed ΔP_req', onClick: function () { c.actions.usePback(); } }));
    if (k.component) foot.appendChild(h('button', { class: 'btn xs ghost', type: 'button', html: icon('crosshair', 'xs') + 'Schematic', onClick: function () { c.nav('schematic', { c: k.component }); } }));
    el.appendChild(foot);
    return el;
  }

  VJP.pages.validation = {
    mount: function (el, c) {
      var D = c.D, f = c.f;
      var page = h('div', { class: 'page page-validation' });
      var chips = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Filter checks' });
      var csvB = h('button', { class: 'btn sm', type: 'button', html: icon('table') + 'Export checklist' });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>06</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Validation' }),
          h('p', { class: 'page-desc', text: 'Engineering design review. The design status is decided only by the physical-validity checks and the design criteria of the spreadsheet model; advisory items are review notes and assumptions are informational. A pass means a numerical criterion is met — not that the design is ready for fabrication.' })),
        h('div', { class: 'ph-r' }, chips, csvB)));
      page.appendChild(VJP.pages.results ? resultsBanner(c) : h('div'));
      if (D.blocked) {
        page.appendChild(h('div', { class: 'panel', style: { marginTop: '14px' } }, h('div', { class: 'panel-h' }, h('h2', { text: 'Calculation cannot proceed' }), h('span', { class: 'ph-sub', text: 'Checks are not evaluated until these are corrected' })), h('div', { class: 'panel-b' }, VJP.pages._blockerList(c))));
        el.appendChild(page); return;
      }
      // spreadsheet overall check (traceability)
      var b66 = D.R.validation.overallOK;
      page.appendChild(h('div', { class: 'b66' },
        h('span', { class: 'si ' + (b66 ? 'ok' : 'warn'), html: icon(b66 ? 'check' : 'alert', 'sm') }),
        h('span', { html: 'Spreadsheet overall check <span class="mono">B66</span>: <b>' + (b66 ? 'PASS' : 'REVIEW') + '</b> — covers solids passage, head ratio, cavitation, entrainment and the diffuser-exit velocity window only. The status above additionally requires every other criterion (head adequacy, cuttings removal, geometry ratios, erosion).' })));
      // category tiles
      var tiles = h('div', { class: 'vtiles' });
      V.CATEGORIES.forEach(function (cat) {
        var ks = D.checks.filter(function (k) { return k.cat === cat.id; });
        if (!ks.length) return;
        var n = { pass: 0, review: 0, fail: 0, note: 0 }; ks.forEach(function (k) { n[k.status]++; });
        var worst = n.fail ? 'fail' : n.review ? 'review' : cat.id === 'assumptions' ? 'note' : 'pass';
        var t = h('button', { class: 'vtile ' + worst, type: 'button', html: '<span class="si ' + worst + '">' + icon(ui.statusIcon(worst), 'sm') + '</span><span class="vt-t">' + esc(cat.title) + '</span><span class="vt-n num">' +
          (cat.id === 'assumptions' ? n.note + ' notes' : (n.pass + '/' + (ks.length)) + (n.review ? ' · ' + n.review + '⚠' : '') + (n.fail ? ' · ' + n.fail + '✕' : '')) + '</span>' });
        t.addEventListener('click', function () { var s = document.getElementById('cat-' + cat.id); if (s) { if (s.classList.contains('closed')) s.querySelector('.vcat-h').click(); s.scrollIntoView({ block: 'start', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); } });
        tiles.appendChild(t);
      });
      page.appendChild(tiles);
      // categories
      var list = h('div', { class: 'vlist' });
      V.CATEGORIES.forEach(function (cat) {
        var ks = D.checks.filter(function (k) { return k.cat === cat.id; });
        if (!ks.length) return;
        var sec = h('section', { class: 'vcat panel' + (closed[cat.id] ? ' closed' : ''), id: 'cat-' + cat.id });
        var n = { pass: 0, review: 0, fail: 0, note: 0 }; ks.forEach(function (k) { n[k.status]++; });
        var hd = h('button', { class: 'vcat-h', type: 'button', 'aria-expanded': String(!closed[cat.id]),
          html: '<span class="vcat-t">' + esc(cat.title) + '</span><span class="vcat-d">' + esc(cat.desc) + '</span><span class="counts">' +
            (n.pass ? '<span class="count pass">' + icon('check') + n.pass + '</span>' : '') + (n.review ? '<span class="count review">' + icon('alert') + n.review + '</span>' : '') +
            (n.fail ? '<span class="count fail">' + icon('x') + n.fail + '</span>' : '') + (n.note ? '<span class="count note">' + icon('info') + n.note + '</span>' : '') + '</span>' + icon('chevron-down', 'sm vcat-chev') });
        hd.addEventListener('click', function () { closed[cat.id] = !closed[cat.id]; sec.classList.toggle('closed', !!closed[cat.id]); hd.setAttribute('aria-expanded', String(!closed[cat.id])); });
        sec.appendChild(hd);
        var body = h('div', { class: 'vcat-b' });
        var order = { fail: 0, review: 1, pass: 2, note: 3 };
        ks.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).forEach(function (k) { body.appendChild(checkEl(k, c)); });
        sec.appendChild(body);
        list.appendChild(sec);
      });
      page.appendChild(list);
      el.appendChild(page);

      [['all', 'All'], ['fail', 'Fail'], ['review', 'Review'], ['pass', 'Pass'], ['note', 'Assumptions']].forEach(function (x) {
        var cnt = x[0] === 'all' ? D.checks.length : D.checks.filter(function (k) { return k.status === x[0]; }).length;
        var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(filter === x[0]), html: esc(x[1]) + ' <span class="mono muted">' + cnt + '</span>' });
        b.addEventListener('click', function () { filter = x[0]; Array.prototype.forEach.call(chips.children, function (q) { q.setAttribute('aria-checked', String(q === b)); }); apply(); });
        chips.appendChild(b);
      });
      function apply() {
        list.querySelectorAll('.vcheck').forEach(function (a) { a.classList.toggle('hidden', filter !== 'all' && a.getAttribute('data-status') !== filter); });
        list.querySelectorAll('.vcat').forEach(function (s) { s.classList.toggle('hidden', !s.querySelector('.vcheck:not(.hidden)')); });
      }
      apply();
      csvB.addEventListener('click', function () {
        var rows = [['Venturi Jet Pump — validation checklist'], ['Project', c.store.project.number + ' ' + c.store.project.name, 'Revision', 'Rev ' + c.store.activeRev().rev], ['Status', D.status.title + ' — ' + D.status.line], [],
          ['Category', 'Check', 'Kind', 'Status', 'Calculated', 'Required', 'Margin', 'Basis', 'Recommended action']];
        D.checks.forEach(function (k) {
          var cat = V.CATEGORIES.filter(function (x) { return x.id === k.cat; })[0];
          rows.push([cat.title, k.name, V.KINDS[k.kind].label, k.status.toUpperCase(), k.kind === 'note' ? '' : S.symText(k.sym) + ' = ' + valText(k, f), k.kind === 'note' ? '' : S.symText(reqText(k, f)), marginText(k), k.basis, k.status !== 'pass' && k.action ? k.action(f) : '']);
        });
        ui.download(c.store.project.number + '_Rev' + c.store.activeRev().rev + '_validation.csv', ui.csv(rows), 'text/csv;charset=utf-8');
        ui.toast('Validation checklist exported');
      });
      if (c.params.check) setTimeout(function () {
        var a = document.getElementById('chk-' + c.params.check); if (!a) return;
        var s = a.closest('.vcat'); if (s && s.classList.contains('closed')) s.querySelector('.vcat-h').click();
        a.scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' });
        a.classList.add('flash');
      }, 60);
    }
  };
  function resultsBanner(c) {
    var D = c.D, s = D.status;
    var el = h('div', { class: 'banner big ' + s.tone, role: 'status' });
    el.appendChild(h('div', { class: 'bn-ic', html: icon(s.state === 'blocked' ? 'blocked' : s.tone === 'pass' ? 'check' : s.tone === 'fail' ? 'x' : 'alert') }));
    el.appendChild(h('div', null, h('div', { class: 'bn-t', text: s.title }), h('div', { class: 'bn-l', text: s.line })));
    if (!D.blocked) {
      var cn = s.counts;
      el.appendChild(h('div', { class: 'bn-r' }, h('div', { class: 'counts' },
        h('span', { class: 'count pass', html: icon('check') + cn.critPass + '/' + cn.critTotal + ' criteria' }),
        h('span', { class: 'count review', html: icon('alert') + cn.advReview + '/' + cn.advTotal + ' advisory' }),
        h('span', { class: 'count note', html: icon('info') + cn.note + ' assumptions' }))));
    }
    return el;
  }
})(typeof window !== 'undefined' ? window : this);
