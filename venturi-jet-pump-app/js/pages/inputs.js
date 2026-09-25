/* INPUTS — dedicated engineering input workspace + live Design Summary.
 * Inputs commit to the store as they are typed (coalesced into one undo step
 * per field edit). The page updates in place on every design change so focus
 * and caret are never lost. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units;
  VJP.pages = VJP.pages || {};

  var collapsed = {};          // section id -> bool (persists while the app is open)
  var advOpen = {};            // section id -> bool
  var st = null;               // page state while mounted

  function niceStep(x) {
    if (!(x > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }
  function displayValue(fld, vSI, sys) {
    if (fld.select) return String(vSI);
    var v = U.conv(Number(vSI), fld.dim, sys).value;
    if (!isFinite(v)) return '';
    return String(Number(v.toPrecision(sys === 'imp' && U.DIM[fld.dim] && U.DIM[fld.dim].imp.f !== 1 ? 5 : 10)));
  }
  function parseNum(raw) {
    var s = String(raw).trim().replace(/\s+/g, '').replace(/−/g, '-');
    if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) s = s.replace(',', '.');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }

  /* ------------------------------------------------------------ field card */
  function fieldCard(fld, c) {
    var key = fld.key, sys = c.sys;
    var inputEl;
    if (fld.select) {
      inputEl = h('select', { id: 'in_' + key, 'aria-describedby': 'st_' + key + ' ds_' + key },
        fld.options.map(function (o) { return h('option', { value: o, text: o }); }));
      inputEl.value = c.store.inputs[key];
      inputEl.addEventListener('change', function () { c.store.set(pair(key, inputEl.value)); c.store.endCoalesce(); });
    } else {
      inputEl = h('input', { id: 'in_' + key, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false',
        'aria-describedby': 'st_' + key + ' ds_' + key, value: displayValue(fld, c.store.inputs[key], sys) });
      var atFocus = null;
      inputEl.addEventListener('focus', function () { atFocus = c.store.inputs[key]; inputEl.select(); });
      inputEl.addEventListener('input', function () {
        var n = parseNum(inputEl.value);
        if (isNaN(n)) c.store.setInvalid(key, inputEl.value);
        else c.store.set(pair(key, U.toSI(n, fld.dim, st.sys)), { coalesce: 'field:' + key });
      });
      inputEl.addEventListener('blur', function () {
        c.store.endCoalesce();
        if (!(key in c.store.invalid)) inputEl.value = displayValue(fld, c.store.inputs[key], st.sys);
      });
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); inputEl.blur(); inputEl.focus(); }
        else if (e.key === 'Escape') {
          e.preventDefault();
          if (atFocus !== null) { c.store.set(pair(key, atFocus), { coalesce: 'field:' + key }); c.store.clearInvalid(key); }
          inputEl.value = displayValue(fld, c.store.inputs[key], st.sys); inputEl.select();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          var cur = parseNum(inputEl.value); if (isNaN(cur)) cur = U.conv(Number(c.store.inputs[key]), fld.dim, st.sys).value;
          var stp = st.sys === 'imp' ? niceStep(U.conv(fld.step || 1, fld.dim, 'imp').value) : (fld.step || 1);
          if (e.shiftKey) stp *= 10; if (e.altKey) stp /= 10;
          var nv = (e.key === 'ArrowUp' ? cur + stp : cur - stp);
          nv = Number(nv.toPrecision(12));
          var hh = fld.hard || {};
          var lo = hh.ge !== undefined ? U.conv(hh.ge, fld.dim, st.sys).value : undefined;
          if (lo !== undefined && nv < lo) nv = lo;
          if (hh.gt !== undefined && nv <= U.conv(hh.gt, fld.dim, st.sys).value) return;
          inputEl.value = String(nv);
          c.store.set(pair(key, U.toSI(nv, fld.dim, st.sys)), { coalesce: 'field:' + key });
        }
      });
    }
    var unit = fld.select ? null : h('span', { class: 'unit', text: U.unitLabel(fld.dim, sys) || '—' });
    var box = h('div', { class: 'field-input' }, inputEl, unit);
    var reset = h('button', { class: 'btn xs ghost fld-reset', type: 'button', 'aria-label': 'Reset ' + fld.name + ' to default', html: icon('reset', 'sm') });
    reset.addEventListener('click', function () { c.store.resetKeys([key]); var el = document.getElementById('in_' + key); if (el) el.focus(); });
    var helpBtn = h('button', { class: 'fld-help', type: 'button', 'aria-label': 'About ' + fld.name, 'data-tip': fld.help, 'data-tip-s': fld.source ? 'Basis: ' + fld.source : '', html: icon('help', 'sm') });
    var statusEl = h('div', { class: 'fld-status', id: 'st_' + key });
    var effectEl = h('div', { class: 'fld-effect' });
    var card = h('div', { class: 'fld', 'data-key': key },
      h('div', { class: 'fld-top' },
        h('label', { class: 'fld-name', for: 'in_' + key, text: fld.name }),
        fld.sym ? h('span', { class: 'fld-sym', html: S.symHTML(fld.sym) }) : null,
        helpBtn, h('span', { class: 'fld-dirty', 'data-tip': 'Changed since the stored revision', html: '●' }),
        h('span', { class: 'fld-sp' }), ui.vt(fld.type)),
      h('div', { class: 'fld-row' }, box, reset),
      h('div', { class: 'fld-desc', id: 'ds_' + key, text: fld.desc }),
      statusEl, effectEl);
    return { el: card, input: inputEl, box: box, status: statusEl, effect: effectEl, fld: fld, reset: reset };
  }
  function pair(k, v) { var o = {}; o[k] = v; return o; }

  function updateField(F, c) {
    var fld = F.fld, key = fld.key, D = c.D, f = c.f, sys = c.sys;
    var r = D.V.fields[key] || { status: 'ok', code: 'ok' };
    var status = r.status;
    F.el.setAttribute('data-status', status);
    F.box.className = 'field-input' + (status === 'error' ? ' error' : status === 'warn' ? ' warn' : '');
    F.input.setAttribute('aria-invalid', status === 'error' ? 'true' : 'false');
    var isDef = c.store.isDefault(key);
    F.el.classList.toggle('modified', !isDef);
    F.reset.classList.toggle('hidden', isDef);
    if (!isDef) F.reset.setAttribute('data-tip', 'Reset to default ' + (fld.select ? VJP.engine.DEFAULT_INPUTS[key] : f.q(VJP.engine.DEFAULT_INPUTS[key], fld.dim, 4)));
    var sv = c.store.savedValue(key);
    F.el.classList.toggle('dirty', sv !== undefined && !sameVal(sv, c.store.inputs[key]));
    // keep the typed text while focused; otherwise show the authoritative value
    if (document.activeElement !== F.input && !(key in c.store.invalid)) {
      var dv = displayValue(fld, c.store.inputs[key], sys);
      if (F.input.value !== dv) F.input.value = dv;
    }
    // status line
    var rng = fld.rec ? f.range(fld.rec, fld.dim) : '';
    var html;
    if (status === 'error') {
      html = '<span class="si fail">' + icon('x') + '</span><span>' + esc(r.code === 'empty' ? 'Value required — calculation cannot proceed' : r.code === 'nan' ? 'Not a number — calculation cannot proceed' : VJP.validation.hardText(fld, f)) + '</span>';
    } else if (status === 'warn') {
      html = '<span class="si warn">' + icon('alert') + '</span><span><b>' + (r.code === 'low' ? 'Below' : 'Above') + ' recommended ' + esc(rng) + '</b> — ' + esc(r.code === 'low' ? (fld.low || 'review') : (fld.high || 'review')) + '</span>';
    } else {
      html = '<span class="si ok">' + icon('check') + '</span><span>' + (fld.rec ? 'Within recommended range · ' + esc(rng) : fld.select ? 'Selected' : 'Valid') + '</span>';
    }
    F.status.innerHTML = html;
    // live consequence (display of engine results; never recomputed here)
    F.effect.innerHTML = '';
    if (!fld.effect) return;
    if (D.blocked) { F.effect.innerHTML = '<span class="si na">' + icon('blocked', 'sm') + '</span><span class="muted">Not calculated — calculation blocked</span>'; return; }
    var rows = [];
    try { rows = fld.effect(D.R, f) || []; } catch (e) { rows = []; }
    rows.forEach(function (x) {
      var line = h('div', { class: 'eff' },
        h('span', { class: 'eff-arrow', html: icon('arrow-right', 'xs') }),
        h('span', { class: 'eff-k', html: x.k }), h('span', { class: 'eff-v num', text: x.v }),
        x.s ? h('span', { class: 'si ' + x.s, html: icon(x.s === 'ok' ? 'check' : x.s === 'fail' ? 'x' : 'alert', 'sm') + (x.s === 'ok' ? '<span class="sr-only">pass</span>' : '<span class="sr-only">' + (x.s === 'fail' ? 'fail' : 'review') + '</span>') }) : null);
      F.effect.appendChild(line);
    });
    var acts = h('div', { class: 'eff-acts' });
    if (fld.pbackAction) acts.appendChild(h('button', { class: 'linkbtn', type: 'button', html: icon('target', 'xs') + 'Use computed ΔP<sub>req</sub>', onClick: function () { c.actions.usePback(); } }));
    if (fld.component) acts.appendChild(h('button', { class: 'linkbtn', type: 'button', html: icon('crosshair', 'xs') + 'Show in schematic', onClick: function () { c.nav('schematic', { c: fld.component }); } }));
    if (acts.childNodes.length) F.effect.appendChild(acts);
  }
  function sameVal(a, b) { return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : String(a) === String(b); }

  /* --------------------------------------------------------------- section */
  function sectionEl(sec, c) {
    var fields = sec.fields.map(function (k) { return fieldCard(S.BYKEY[k], c); });
    var adv = (sec.advanced || []).map(function (k) { return fieldCard(S.BYKEY[k], c); });
    var statusEl = h('div', { class: 'isec-status' });
    var resetBtn = h('button', { class: 'btn xs ghost', type: 'button', html: icon('reset', 'sm') + 'Reset section', 'data-tip': 'Restore this section to the spreadsheet defaults' });
    resetBtn.addEventListener('click', function () { c.store.resetKeys(sec.fields.concat(sec.advanced || [])); ui.toast(sec.title + ' reset to defaults'); });
    var toggle = h('button', { class: 'btn xs ghost icon isec-toggle', type: 'button', 'aria-expanded': String(!collapsed[sec.id]), 'aria-label': 'Collapse ' + sec.title, html: icon('chevron-down') });
    var body = h('div', { class: 'isec-b' }, h('div', { class: 'fgrid' }, fields.map(function (F) { return F.el; })));
    var advEl = null, advSum = null;
    if (adv.length) {
      advSum = h('summary', null);
      advEl = h('details', { class: 'adv' }, advSum, h('div', { class: 'fgrid' }, adv.map(function (F) { return F.el; })));
      if (advOpen[sec.id]) advEl.open = true;
      advEl.addEventListener('toggle', function () { advOpen[sec.id] = advEl.open; });
      body.appendChild(advEl);
    }
    var head = h('header', { class: 'isec-h' },
      h('span', { class: 'isec-no', text: String(sec.no).padStart(2, '0') }),
      h('div', { class: 'isec-t' }, h('h2', { text: sec.title }), h('p', { text: sec.desc })),
      statusEl, resetBtn, toggle);
    var el = h('section', { class: 'isec panel' + (collapsed[sec.id] ? ' collapsed' : ''), id: 'sec-' + sec.id, 'aria-labelledby': 'sec-' + sec.id + '-t' }, head, body);
    head.querySelector('h2').id = 'sec-' + sec.id + '-t';
    toggle.addEventListener('click', function () {
      collapsed[sec.id] = !collapsed[sec.id];
      el.classList.toggle('collapsed', !!collapsed[sec.id]);
      toggle.setAttribute('aria-expanded', String(!collapsed[sec.id]));
    });
    return { sec: sec, el: el, fields: fields.concat(adv), adv: adv, advEl: advEl, advSum: advSum, status: statusEl, reset: resetBtn };
  }
  function updateSection(X, c) {
    var V = c.D.V, nW = 0, nE = 0, nMod = 0;
    X.fields.forEach(function (F) { updateField(F, c); var s = (V.fields[F.fld.key] || {}).status; if (s === 'warn') nW++; if (s === 'error') nE++; if (!c.store.isDefault(F.fld.key)) nMod++; });
    var n = X.fields.length;
    X.status.innerHTML = nE ? '<span class="si fail">' + icon('x') + nE + ' invalid</span>'
      : nW ? '<span class="si warn">' + icon('alert') + nW + ' outside range</span>'
      : '<span class="si ok">' + icon('check') + 'All ' + n + ' within range</span>';
    X.reset.disabled = nMod === 0;
    if (X.advEl) {
      var aW = 0, aE = 0, aM = 0;
      X.adv.forEach(function (F) { var s = (V.fields[F.fld.key] || {}).status; if (s === 'warn') aW++; if (s === 'error') aE++; if (!c.store.isDefault(F.fld.key)) aM++; });
      if ((aW || aE) && !X.advEl.open) { X.advEl.open = true; advOpen[X.sec.id] = true; } // never hide an issue
      X.advSum.innerHTML = icon('chevron-right', 'sm adv-chev') + '<span class="adv-t">Advanced · ' + esc(X.sec.advancedTitle || 'secondary parameters') + '</span>' +
        '<span class="adv-n">' + X.adv.length + ' parameter' + (X.adv.length > 1 ? 's' : '') + (aM ? ' · ' + aM + ' modified' : '') + '</span>' +
        (aE ? '<span class="si fail">' + icon('x', 'sm') + aE + '</span>' : aW ? '<span class="si warn">' + icon('alert', 'sm') + aW + '</span>' : '');
    }
    return { warn: nW, err: nE };
  }

  /* ---------------------------------------------------------- design summary */
  function summaryEl(c) {
    var root = h('aside', { class: 'dsum', 'aria-label': 'Current design summary' });
    var refs = { rows: {} };
    refs.head = h('div', { class: 'dsum-h' }, h('span', { class: 'eyebrow', text: 'Current design' }), h('span', { class: 'dsum-live' }));
    refs.banner = h('div', { class: 'dsum-status' });
    var kv = h('div', { class: 'dsum-kv', role: 'list' });
    VJP.design.SUMMARY.forEach(function (id) {
      var m = VJP.design.METRIC[id];
      var num = h('span', { class: 'num' }), unit = h('span', { class: 'u' }), delta = h('span', { class: 'delta' });
      var row = h('button', { class: 'kvrow', type: 'button', role: 'listitem', 'data-tip': m.comp ? 'Show in schematic' : 'Open results' },
        h('span', { class: 'k', html: esc(m.label) + ' <span class="sym">' + S.symHTML(m.sym) + '</span>' }),
        h('span', { class: 'v' }, num, unit), delta);
      row.addEventListener('click', function () { if (m.comp) c.nav('schematic', { c: m.comp }); else c.nav('results', { focus: id }); });
      refs.rows[id] = { num: num, unit: unit, delta: delta, row: row, m: m, last: null };
      kv.appendChild(row);
    });
    refs.val = h('button', { class: 'dsum-val', type: 'button', onClick: function () { c.nav('validation'); } });
    refs.mini = h('button', { class: 'dsum-mini', type: 'button', 'aria-label': 'Open the schematic', onClick: function () { c.nav('schematic'); } });
    refs.attn = h('div', { class: 'dsum-attn' });
    root.append(refs.head, refs.banner, kv, refs.val, refs.mini, refs.attn);
    refs.el = root;
    return refs;
  }
  function updateSummary(Z, c) {
    var D = c.D, f = c.f, s = D.status, store = c.store;
    Z.head.lastChild.innerHTML = '<span class="pulse-dot"></span>Live · Rev ' + esc(store.activeRev().rev) + (store.saveState === 'saved' ? '' : ' · unsaved');
    Z.el.classList.remove('updated'); void Z.el.offsetWidth; Z.el.classList.add('updated');
    Z.banner.className = 'dsum-status banner compact ' + s.tone;
    Z.banner.innerHTML = '<div class="bn-ic">' + icon(s.state === 'blocked' ? 'blocked' : s.tone === 'pass' ? 'check' : s.tone === 'fail' ? 'x' : 'alert') + '</div>' +
      '<div><div class="bn-t">' + esc(s.title) + '</div><div class="bn-l">' + esc(s.line) + '</div></div>';
    var savedR = null;
    var sr = store.saved ? store._savedRev() : null;
    if (sr) { var SD = VJP.design.evaluate(sr.inputs, {}); if (!SD.blocked) savedR = SD.R; }
    Object.keys(Z.rows).forEach(function (id) {
      var row = Z.rows[id], m = row.m;
      if (D.blocked) { row.num.textContent = '—'; row.unit.textContent = ''; row.delta.textContent = ''; row.row.classList.add('na'); row.last = null; return; }
      row.row.classList.remove('na');
      var v = m.get(D.R), disp = m.sci ? null : U.conv(v, m.dim, c.sys).value;
      var fmtFn = function (x) { return m.sci ? U.sci(x, 3) : U.fmt(x, m.sig || U.SIG[m.dim] || 4); };
      var target = m.sci ? v : disp;
      if (row.last !== null && row.last !== target) { ui.tweenText(row.num, row.last, target, fmtFn); row.row.classList.remove('chg'); void row.row.offsetWidth; row.row.classList.add('chg'); }
      else row.num.textContent = fmtFn(target);
      row.last = target;
      row.unit.textContent = f.u(m.dim);
      var sv = savedR ? m.get(savedR) : null;
      if (sv !== null && isFinite(sv) && Math.abs(v - sv) > 1e-9 * Math.max(1, Math.abs(sv))) {
        var p = U.pct(v, sv);
        row.delta.innerHTML = (v > sv ? '▲' : '▼') + ' ' + esc(p);
        row.delta.setAttribute('data-tip', 'Change vs stored Rev ' + store.activeRev().rev); row.delta.setAttribute('data-tip-s', 'Stored: ' + (m.sci ? U.sci(sv, 3) : f.q(sv, m.dim, m.sig)));
      } else { row.delta.textContent = ''; row.delta.removeAttribute('data-tip'); }
    });
    var cnt = s.counts;
    Z.val.innerHTML = D.blocked ? '<span class="si fail">' + icon('blocked') + 'Validation not evaluated</span><span class="dsum-go">' + icon('arrow-right', 'sm') + '</span>'
      : '<span class="counts"><span class="count pass">' + icon('check') + cnt.pass + ' passed</span><span class="count review">' + icon('alert') + cnt.review + ' review</span><span class="count fail">' + icon('x') + cnt.fail + ' failed</span></span><span class="dsum-go" data-tip="Open validation">' + icon('arrow-right', 'sm') + '</span>';
    // mini schematic (same parametric model as the Schematic page)
    Z.mini.innerHTML = '';
    if (D.model && VJP.schematic && VJP.schematic.mini) {
      Z.mini.appendChild(VJP.schematic.mini(D.model, { width: 320, height: 96 }));
      Z.mini.appendChild(h('span', { class: 'dsum-mini-l', html: icon('schematic', 'sm') + 'Parametric geometry · open schematic' }));
    } else {
      Z.mini.appendChild(h('span', { class: 'dsum-mini-l', html: icon('blocked', 'sm') + 'Geometry not generated — calculation blocked' }));
    }
    // attention list
    var items = [];
    D.V.blockers.forEach(function (b) { items.push({ s: 'fail', t: b.title, go: function () { if (b.params[0]) focusField(b.params[0]); else c.nav('validation'); } }); });
    D.checks.filter(function (k) { return k.status === 'fail'; }).forEach(function (k) { items.push({ s: 'fail', t: k.name, go: function () { c.nav('validation', { check: k.id }); } }); });
    D.checks.filter(function (k) { return k.status === 'review'; }).forEach(function (k) { items.push({ s: 'warn', t: k.name + (k.kind === 'advisory' ? ' (advisory)' : ''), go: function () { c.nav('validation', { check: k.id }); } }); });
    D.V.fieldWarns.forEach(function (key) { items.push({ s: 'warn', t: S.BYKEY[key].name + ' outside recommended range', go: function () { focusField(key); } }); });
    Z.attn.innerHTML = '';
    Z.attn.appendChild(h('div', { class: 'eyebrow', text: items.length ? 'Requires attention (' + items.length + ')' : 'Requires attention' }));
    if (!items.length) Z.attn.appendChild(h('div', { class: 'attn-none', html: '<span class="si ok">' + icon('check') + '</span>No open issues' }));
    items.slice(0, 7).forEach(function (it) {
      var b = h('button', { class: 'attn-i', type: 'button', html: '<span class="si ' + it.s + '">' + icon(it.s === 'fail' ? 'x' : 'alert', 'sm') + '</span><span>' + esc(it.t) + '</span>' + icon('chevron-right', 'sm') });
      b.addEventListener('click', it.go);
      Z.attn.appendChild(b);
    });
    if (items.length > 7) Z.attn.appendChild(h('button', { class: 'linkbtn', type: 'button', text: '+ ' + (items.length - 7) + ' more in Validation', style: { marginTop: '6px', fontSize: '12.5px' }, onClick: function () { c.nav('validation'); } }));
  }

  function focusField(key) {
    var inp = document.getElementById('in_' + key);
    if (!inp) return;
    var sec = inp.closest('.isec');
    if (sec && sec.classList.contains('collapsed')) { var tg = sec.querySelector('.isec-toggle'); if (tg) tg.click(); }
    var det = inp.closest('details'); if (det) det.open = true;
    var card = inp.closest('.fld');
    card.scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' });
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    setTimeout(function () { inp.focus({ preventScroll: true }); }, 250);
  }

  /* ------------------------------------------------------------------ page */
  VJP.pages.inputs = {
    mount: function (el, c) {
      st = { sys: c.sys, sections: [] };
      var page = h('div', { class: 'page page-inputs' });
      var expandAll = h('button', { class: 'btn sm', type: 'button', html: icon('expand') + 'Expand all' });
      var collapseAll = h('button', { class: 'btn sm', type: 'button', html: icon('collapse') + 'Collapse all' });
      var resetAll = h('button', { class: 'btn sm', type: 'button', html: icon('reset') + 'Reset all defaults' });
      expandAll.addEventListener('click', function () { st.sections.forEach(function (X) { collapsed[X.sec.id] = false; X.el.classList.remove('collapsed'); X.el.querySelector('.isec-toggle').setAttribute('aria-expanded', 'true'); if (X.advEl) X.advEl.open = true; }); });
      collapseAll.addEventListener('click', function () { st.sections.forEach(function (X) { collapsed[X.sec.id] = true; X.el.classList.add('collapsed'); X.el.querySelector('.isec-toggle').setAttribute('aria-expanded', 'false'); }); });
      resetAll.addEventListener('click', function () {
        ui.confirm({ title: 'Reset all inputs?', text: 'Every input returns to the spreadsheet default (Design A). You can undo this with Ctrl+Z.', ok: 'Reset all' })
          .then(function (y) { if (y) { c.store.resetAll(); ui.toast('All inputs reset to defaults'); } });
      });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>01</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Inputs' }),
          h('p', { class: 'page-desc', html: 'Design parameters for <b>' + esc(c.store.project.number) + '</b> · Rev ' + esc(c.store.activeRev().rev) + '. Values update the calculation as you type; hard physical limits block the calculation, recommended ranges raise engineering warnings. <span class="muted">↑/↓ steps a value (Shift ×10, Alt ×0.1) · Esc reverts.</span>' })),
        h('div', { class: 'ph-r' }, expandAll, collapseAll, resetAll)));

      var index = h('nav', { class: 'sec-index', 'aria-label': 'Input sections' });
      var left = h('div', { class: 'inputs-main' }, index);
      VJP.schema.SECTIONS.forEach(function (sec) {
        var X = sectionEl(sec, c);
        st.sections.push(X);
        left.appendChild(X.el);
        var chip = h('button', { class: 'sec-chip', type: 'button', 'aria-label': sec.title, html: '<span class="sc-no">' + sec.no + '</span><span class="sc-t">' + esc(sec.short || sec.title) + '</span><span class="sc-s"></span>' });
        chip.addEventListener('click', function () {
          if (collapsed[sec.id]) X.el.querySelector('.isec-toggle').click();
          X.el.scrollIntoView({ block: 'start', behavior: ui.reducedMotion() ? 'auto' : 'smooth' });
        });
        X.chip = chip;
        index.appendChild(chip);
      });
      st.summary = summaryEl(c);
      page.appendChild(h('div', { class: 'inputs-layout' }, left, st.summary.el));
      el.appendChild(page);

      // highlight the section in view
      if ('IntersectionObserver' in window) {
        st.io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            st.sections.forEach(function (X) { X.chip.classList.toggle('active', X.el === en.target); });
          });
        }, { root: document.getElementById('main'), rootMargin: '-15% 0px -70% 0px' });
        st.sections.forEach(function (X) { st.io.observe(X.el); });
      }
      this.update(c);
      if (c.params.f) setTimeout(function () { focusField(c.params.f); }, 60);
    },
    update: function (c) {
      if (!st) return;
      st.sys = c.sys;
      st.sections.forEach(function (X) {
        var r = updateSection(X, c);
        X.chip.querySelector('.sc-s').innerHTML = r.err ? '<span class="si fail">' + icon('x', 'xs') + r.err + '</span>' : r.warn ? '<span class="si warn">' + icon('alert', 'xs') + r.warn + '</span>' : '<span class="si ok">' + icon('check', 'xs') + '</span>';
        X.chip.setAttribute('data-tip', r.err ? r.err + ' invalid input(s)' : r.warn ? r.warn + ' input(s) outside the recommended range' : 'All inputs within range');
      });
      updateSummary(st.summary, c);
    },
    onSave: function (c) { if (st) this.update(c); },
    unmount: function () { if (st && st.io) st.io.disconnect(); st = null; }
  };
})(typeof window !== 'undefined' ? window : this);
