/* UI kit — DOM builders, unit-aware formatters, status/type tags, tooltips,
 * menus, modals, toasts, clipboard and download helpers. No engineering logic. */
(function (root) {
  'use strict';
  var VJP = root.VJP, U = VJP.units, S = VJP.schema;
  var ui = {};

  /* ---------------------------------------------------------------- DOM */
  // h('div', {class:'x', onClick: fn, html: '<b>trusted</b>', text: 'safe'}, child, 'text', [children])
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) setAttrs(el, attrs);
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function setAttrs(el, attrs) {
    for (var k in attrs) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') { for (var sk in v) el.style[sk] = v[sk]; }
      else if (k === 'dataset') { for (var dk in v) el.dataset[dk] = v[dk]; }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  function append(el, c) {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
  function frag(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content; }
  function esc(x) { return String(x === undefined || x === null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name, cls) { return VJP.icons.svg(name, cls); }
  function iconEl(name, cls) { return frag(icon(name, cls)).firstChild; }

  /* ---------------------------------------------------------- formatters */
  // F(sys) — every displayed engineering value goes through this, so the
  // SI/Imperial switch propagates to inputs, tables, charts, tooltips, exports.
  function F(sys) {
    return {
      sys: sys,
      q: function (v, dim, sig) { return U.q(v, dim, sys, sig); },
      v: function (v, dim, sig) { return U.display(v, dim, sys, sig).text; },
      u: function (dim) { return U.unitLabel(dim, sys); },
      c: function (v, dim) { return U.conv(v, dim, sys).value; },
      n: function (v, sig) { return U.fmt(v, sig || 4); },
      sci: function (v, sig) { return U.sci(v, sig || 3); },
      sym: function (m) { return S.symHTML(m); },
      range: function (rec, dim) {
        var a = U.display(rec[0], dim, sys, 3), b = U.display(rec[1], dim, sys, 3);
        return a.text + '–' + b.text + (a.unit ? ' ' + a.unit : '');
      },
      pct: U.pct
    };
  }
  // metric value text (with unit) for a METRICS entry
  function metricText(f, metric, value) {
    if (metric.text) return String(value);
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    if (metric.sci) return U.sci(value, 3);
    return f.v(value, metric.dim, metric.sig);
  }

  /* ------------------------------------------------------ tags & badges */
  var ST = {
    pass: { ic: 'check', t: 'Pass' }, ok: { ic: 'check', t: 'Pass' }, review: { ic: 'alert', t: 'Review' }, warn: { ic: 'alert', t: 'Review' },
    fail: { ic: 'x', t: 'Fail' }, error: { ic: 'x', t: 'Error' }, note: { ic: 'info', t: 'Note' }, na: { ic: 'blocked', t: 'Not evaluated' }
  };
  function statusClass(st) { return st === 'ok' ? 'pass' : st === 'warn' ? 'review' : st === 'error' ? 'fail' : st; }
  function badge(st, text) {
    var d = ST[st] || ST.na;
    return h('span', { class: 'sb ' + statusClass(st), html: icon(d.ic) + esc(text || d.t) });
  }
  function statusIcon(st) { return (ST[st] || ST.na).ic; }
  function vt(type) {
    var T = S.TYPES[type] || S.TYPES.calculated;
    return h('span', { class: 'vt t-' + (S.TYPES[type] ? type : 'calculated'), text: T.short, 'data-tip': T.label, 'data-tip-s': T.desc, tabindex: '0' });
  }
  function symSpan(m, cls) { return h('span', { class: cls || 'sym', html: S.symHTML(m) }); }

  /* ------------------------------------------------------------- tooltips */
  var tipEl, tipT, tipFor;
  function initTooltips() {
    tipEl = h('div', { class: 'tip', role: 'tooltip', id: 'vjpTip' });
    document.body.appendChild(tipEl);
    function show(target, immediate) {
      clearTimeout(tipT);
      tipT = setTimeout(function () {
        var t = target.getAttribute('data-tip'); if (!t) return;
        var sub = target.getAttribute('data-tip-s');
        tipEl.innerHTML = '<b>' + esc(t) + '</b>' + (sub ? '<div class="tip-s">' + esc(sub) + '</div>' : '');
        tipEl.classList.add('show');
        var r = target.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
        var x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
        var y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
        tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
        tipFor = target;
      }, immediate ? 0 : 320);
    }
    function hide() { clearTimeout(tipT); tipEl.classList.remove('show'); tipFor = null; }
    document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) { if (t !== tipFor) show(t); } else if (tipFor) hide(); });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t, true); });
    document.addEventListener('focusout', hide);
    document.addEventListener('mousedown', hide);
    document.addEventListener('scroll', hide, true);
  }

  /* ---------------------------------------------------------------- toast */
  var toastBox;
  function toast(msg, tone, ms) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var ic = tone === 'fail' ? 'x-circle' : tone === 'warn' ? 'alert' : tone === 'info' ? 'info' : 'check-circle';
    var t = h('div', { class: 'toast ' + (tone || 'ok'), html: icon(ic) + '<span>' + esc(msg) + '</span>' });
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || 2600);
  }

  /* ----------------------------------------------------------------- menu */
  var openMenu = null;
  function closeMenu() { if (openMenu) { var m = openMenu; openMenu = null; m.el.remove(); document.removeEventListener('mousedown', m.outside, true); document.removeEventListener('keydown', m.key, true); if (m.anchor) { m.anchor.setAttribute('aria-expanded', 'false'); m.anchor.focus(); } } }
  // items: [{label, icon, kbd, onClick, danger, disabled} | {sep:true} | {head:'Title'}]
  function menu(anchor, items, opts) {
    opts = opts || {};
    if (openMenu && openMenu.anchor === anchor) { closeMenu(); return; }
    closeMenu();
    var el = h('div', { class: 'menu', role: 'menu' });
    var buttons = [];
    items.forEach(function (it) {
      if (!it) return;
      if (it.sep) { el.appendChild(h('div', { class: 'menu-sep', role: 'separator' })); return; }
      if (it.head) { el.appendChild(h('div', { class: 'menu-head', text: it.head })); return; }
      var b = h('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', type: 'button', 'aria-disabled': it.disabled ? 'true' : null,
        html: (it.icon ? icon(it.icon) : '<span style="width:16px"></span>') + '<span>' + esc(it.label) + '</span>' + (it.kbd ? '<span class="mk">' + esc(it.kbd) + '</span>' : '') });
      b.addEventListener('click', function () { closeMenu(); if (!it.disabled && it.onClick) it.onClick(); });
      el.appendChild(b); buttons.push(b);
    });
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
    var x = opts.align === 'left' ? r.left : r.right - w;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    var y = r.bottom + 6; if (y + hh > window.innerHeight - 8) y = Math.max(8, r.top - hh - 6);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    var m = {
      el: el, anchor: anchor,
      outside: function (e) { if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenu(); },
      key: function (e) {
        var i = buttons.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
        else if (e.key === 'Tab') closeMenu();
      }
    };
    document.addEventListener('mousedown', m.outside, true);
    document.addEventListener('keydown', m.key, true);
    openMenu = m;
    if (buttons[0]) setTimeout(function () { buttons[0].focus(); }, 0);
  }

  /* ---------------------------------------------------------------- modal */
  // modal({title, sub, body: Node, actions: [{label, primary, danger, left, onClick -> false keeps open}], wide})
  function modal(o) {
    var prev = document.activeElement;
    var bg = h('div', { class: 'modal-bg' });
    var box = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mdlT' });
    var close = function () { bg.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); if (o.onClose) o.onClose(); };
    var head = h('div', { class: 'modal-h' },
      h('div', null, h('h2', { id: 'mdlT', text: o.title }), o.sub ? h('div', { class: 'mh-sub', text: o.sub }) : null),
      h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Close', html: icon('x'), onClick: close }));
    var body = h('div', { class: 'modal-b' }, o.body);
    box.appendChild(head); box.appendChild(body);
    if (o.actions && o.actions.length) {
      var foot = h('div', { class: 'modal-f' });
      o.actions.forEach(function (a) {
        var b = h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : '') + (a.left ? ' left' : ''), type: 'button', html: (a.icon ? icon(a.icon) : '') + esc(a.label) });
        b.addEventListener('click', function () { var r = a.onClick ? a.onClick(close) : undefined; if (r !== false) close(); });
        foot.appendChild(b);
      });
      box.appendChild(foot);
    }
    bg.appendChild(box);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var f = box.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(bg);
    var auto = box.querySelector('[autofocus]') || box.querySelector('input, select, textarea') || box.querySelector('.modal-f .btn.primary') || box.querySelector('button');
    if (auto) setTimeout(function () { auto.focus(); }, 0);
    return { el: box, close: close };
  }
  function confirmBox(o) {
    return new Promise(function (resolve) {
      var done = false;
      modal({ title: o.title, sub: o.sub, body: h('div', { class: 'dim', style: { fontSize: '13.5px' }, html: o.html || esc(o.text || '') }),
        actions: [{ label: o.cancel || 'Cancel', onClick: function () { done = true; resolve(false); } },
          { label: o.ok || 'Confirm', primary: !o.danger, danger: !!o.danger, onClick: function () { done = true; resolve(true); } }],
        onClose: function () { if (!done) resolve(false); } });
    });
  }

  /* ------------------------------------------------------- copy / download */
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    return Promise.resolve(fallback());
    function fallback() {
      var ta = h('textarea', { style: { position: 'fixed', opacity: '0', left: '-9999px' } }); ta.value = text;
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); return ok;
    }
  }
  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function csv(rows) {
    return rows.map(function (r) { return r.map(function (c) { var v = c === undefined || c === null ? '' : String(c); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  }
  function tsv(rows) { return rows.map(function (r) { return r.map(function (c) { return String(c === undefined || c === null ? '' : c).replace(/\t/g, ' '); }).join('\t'); }).join('\n'); }

  /* ------------------------------------------------------------- motion */
  function reducedMotion() { return document.documentElement.classList.contains('reduce-motion') ||
    (!document.documentElement.classList.contains('motion-ok') && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  // number interpolation for major results (skipped under reduced motion)
  function tweenText(el, from, to, format, ms) {
    if (!(typeof from === 'number' && typeof to === 'number' && isFinite(from) && isFinite(to)) || from === to || reducedMotion() || document.hidden) { el.textContent = format(to); return; }
    var t0 = performance.now(); ms = ms || 260;
    cancelAnimationFrame(el._tw);
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(from + (to - from) * e);
      if (k < 1) el._tw = requestAnimationFrame(step);
    })(t0);
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function dateStr(iso, withTime) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return '—';
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var s = d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
    if (withTime) s += ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return s;
  }
  function timeStr(iso) { if (!iso) return ''; var d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  // Image assets: relative path in the modular app; the single-file build
  // (build-inline.ps1) defines VJP_ASSETS with each image embedded once.
  function asset(path) { return (root.VJP_ASSETS && root.VJP_ASSETS[path]) || path; }

  ui.h = h; ui.asset = asset; ui.s = s; ui.frag = frag; ui.esc = esc; ui.icon = icon; ui.iconEl = iconEl; ui.F = F; ui.metricText = metricText;
  ui.badge = badge; ui.statusIcon = statusIcon; ui.statusClass = statusClass; ui.vt = vt; ui.symSpan = symSpan;
  ui.initTooltips = initTooltips; ui.toast = toast; ui.menu = menu; ui.closeMenu = closeMenu; ui.modal = modal; ui.confirm = confirmBox;
  ui.copy = copy; ui.download = download; ui.csv = csv; ui.tsv = tsv; ui.reducedMotion = reducedMotion; ui.tweenText = tweenText;
  ui.debounce = debounce; ui.dateStr = dateStr; ui.timeStr = timeStr;
  root.VJP.ui = ui;
})(typeof window !== 'undefined' ? window : this);
