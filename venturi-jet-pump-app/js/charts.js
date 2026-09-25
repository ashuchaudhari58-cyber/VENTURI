/* ENGINEERING LINE CHARTS (SVG) — hydraulic profiles and comparisons.
 *  · centred title + subtitle; one quantity per axis (never dual-axis)
 *  · 2 px lines, ≥ 8 px ringed markers, solid hairline grid, recessive axes
 *  · component bands with labels; engine station markers on the curves
 *  · crosshair tooltip listing every series (values lead, labels follow)
 *  · external cursor sync + band highlight for linked views; SVG/PNG export
 * Colours are resolved to explicit attributes so exports are self-contained. */
(function (root) {
  'use strict';
  var VJP = root.VJP, SVGNS = 'http://www.w3.org/2000/svg';
  var MONO = "'IBM Plex Mono', 'JetBrains Mono', Consolas, monospace", SANS = "Inter, 'Segoe UI', system-ui, sans-serif";
  function el(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); if (attrs) for (var k in attrs) { var v = attrs[k]; if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v); } if (parent) parent.appendChild(e); return e; }
  function cssv(n, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || fb; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function palette(theme) {
    if (theme === 'light') return { surface: '#FFFFFF', text: '#0E1522', text2: '#3D4B61', muted: '#5B687D', grid: '#E6EAF1', axis: '#B4C0D2', band: 'rgba(15,23,42,0.035)', bandHi: 'rgba(245,158,11,0.16)', bandLine: '#D5DCE7', cursor: '#0E1522', brand: '#C2410C' };
    return { surface: cssv('--surface', '#0E1522'), text: cssv('--text', '#F4F7FB'), text2: cssv('--text-2', '#A9B4C5'), muted: cssv('--text-muted', '#7C8AA0'), grid: cssv('--grid', '#1B2536'),
      axis: cssv('--axis', '#394963'), band: cssv('--band', 'rgba(148,163,184,0.045)'), bandHi: cssv('--band-hi', 'rgba(245,158,11,0.10)'), bandLine: cssv('--border', '#263247'), cursor: cssv('--text-2', '#A9B4C5'), brand: cssv('--brand', '#F59E0B') };
  }
  function niceStep(range, target) {
    if (!(range > 0)) return 1;
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function tickFmt(v, step) {
    if (Math.abs(v) < step * 1e-6) v = 0;
    var d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    var s = v.toFixed(Math.min(6, d));
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function interp(pts, x) {
    var n = pts.length; if (!n) return NaN;
    if (x <= pts[0][0]) return pts[0][1]; if (x >= pts[n - 1][0]) return pts[n - 1][1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    var t = (x - pts[lo][0]) / ((pts[hi][0] - pts[lo][0]) || 1);
    return pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t;
  }

  /* ------------------------------------------------------------ line chart */
  function Line(container, o) {
    this.c = container; this.o = o; this.cursorX = null; this.hiBand = null; this.pinned = null;
    this.P = palette(o.theme);
    container.innerHTML = '';
    container.classList.add('chart');
    var head = document.createElement('div'); head.className = 'chart-h';
    head.innerHTML = '<div class="chart-t">' + esc(o.title) + '</div>' + (o.subtitle ? '<div class="chart-s">' + esc(o.subtitle) + '</div>' : '');
    if (o.series.length > 1) {
      var lg = document.createElement('div'); lg.className = 'chart-lg';
      lg.innerHTML = o.series.map(function (s) {
        return '<span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="' + s.color + '" stroke-width="2.4"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' stroke-linecap="round"/></svg>' + esc(s.name) + '</span>';
      }).join('');
      head.appendChild(lg);
    }
    if (o.actions) head.appendChild(o.actions);
    container.appendChild(head);
    this.box = document.createElement('div'); this.box.className = 'chart-b'; container.appendChild(this.box);
    this.tip = document.createElement('div'); this.tip.className = 'chart-tip'; this.box.appendChild(this.tip);
    this.render();
  }
  var LP = Line.prototype;
  LP.render = function () {
    var o = this.o, P = this.P, self = this;
    var W = Math.max(280, Math.round(o.width || this.box.clientWidth || 560)), H = o.height || 260;
    this.W = W; this.H = H;
    if (this.svg) this.svg.remove();
    var m = { l: o.ml || 64, r: 18, t: 22, b: 46 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    this.m = m; this.pw = pw; this.ph = ph;
    // domains
    var xd = o.x.domain || [0, 1], ys = [];
    o.series.forEach(function (s) { s.points.forEach(function (p) { if (isFinite(p[1])) ys.push(p[1]); }); });
    (o.markers || []).concat(o.offMarkers || []).forEach(function (mk) { if (isFinite(mk.y)) ys.push(mk.y); });
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    if (o.y.zero) { ymin = Math.min(0, ymin); ymax = Math.max(0, ymax); }
    if (!(isFinite(ymin) && isFinite(ymax))) { ymin = 0; ymax = 1; }
    if (ymax - ymin < 1e-12) { ymax = ymin + 1; }
    // power-of-ten axis factor for large magnitudes (e.g. Re ×10⁶)
    var amax = Math.max(Math.abs(ymin), Math.abs(ymax)), p10 = amax >= 1e4 ? Math.floor(Math.log10(amax)) : 0, fac = Math.pow(10, p10);
    this.fac = fac;
    var ystep = niceStep((ymax - ymin) / fac, 5) * fac;
    ymin = Math.floor(ymin / ystep) * ystep; ymax = Math.ceil(ymax / ystep) * ystep;
    if (ymax === ymin) ymax = ymin + ystep;
    this.yd = [ymin, ymax]; this.xd = xd;
    var sx = function (x) { return m.l + (x - xd[0]) / (xd[1] - xd[0]) * pw; };
    var sy = function (y) { return m.t + ph - (y - ymin) / (ymax - ymin) * ph; };
    this.sx = sx; this.sy = sy;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart-svg', role: 'img', 'aria-label': o.title + ' — ' + (o.subtitle || ''), 'font-family': SANS });
    this.svg = svg;
    el('rect', { x: 0, y: 0, width: W, height: H, fill: o.exportBg ? P.surface : 'transparent' }, svg);
    // component bands
    this.bandEls = {};
    (o.bands || []).forEach(function (b, i) {
      var x0 = Math.max(m.l, sx(b.x0)), x1 = Math.min(m.l + pw, sx(b.x1));
      if (x1 - x0 < 0.5) return;
      var r = el('rect', { x: r1(x0), y: m.t, width: r1(x1 - x0), height: ph, fill: i % 2 ? P.band : 'transparent', class: 'band' }, svg);
      self.bandEls[b.id] = { rect: r, base: i % 2 ? P.band : 'transparent' };
      if (i) el('line', { x1: r1(x0), y1: m.t, x2: r1(x0), y2: m.t + ph, stroke: P.bandLine, 'stroke-width': 1 }, svg);
      var wpx = x1 - x0, label = wpx > b.label.length * 6.6 + 10 ? b.label : wpx > 22 ? String(b.no) : '';
      if (label) { var t = el('text', { x: r1((x0 + x1) / 2), y: m.t + 13, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, 'letter-spacing': '0.04em', fill: P.muted }, svg); t.textContent = label; }
    });
    // grid + ticks
    var xstep = niceStep(xd[1] - xd[0], Math.max(4, Math.min(9, Math.round(pw / 95))));
    for (var gx = Math.ceil(xd[0] / xstep) * xstep; gx <= xd[1] + 1e-9; gx += xstep) {
      var X = sx(gx);
      el('line', { x1: r1(X), y1: m.t, x2: r1(X), y2: m.t + ph, stroke: P.grid, 'stroke-width': 1 }, svg);
      var tx = el('text', { x: r1(X), y: m.t + ph + 17, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': MONO, fill: P.text2 }, svg);
      tx.textContent = tickFmt(gx, xstep);
    }
    for (var gy = ymin; gy <= ymax + ystep * 1e-6; gy += ystep) {
      var Y = sy(gy);
      el('line', { x1: m.l, y1: r1(Y), x2: m.l + pw, y2: r1(Y), stroke: Math.abs(gy) < ystep * 1e-6 && ymin < 0 ? P.axis : P.grid, 'stroke-width': 1 }, svg);
      var ty = el('text', { x: m.l - 8, y: r1(Y + 4), 'text-anchor': 'end', 'font-size': 11.5, 'font-family': MONO, fill: P.text2 }, svg);
      ty.textContent = tickFmt(gy / fac, ystep / fac);
    }
    el('line', { x1: m.l, y1: m.t + ph, x2: m.l + pw, y2: m.t + ph, stroke: P.axis, 'stroke-width': 1 }, svg);
    el('line', { x1: m.l, y1: m.t, x2: m.l, y2: m.t + ph, stroke: P.axis, 'stroke-width': 1 }, svg);
    // axis titles
    var xt = el('text', { x: r1(m.l + pw / 2), y: H - 8, 'text-anchor': 'middle', 'font-size': 12, fill: P.text2 }, svg);
    xt.textContent = o.x.label + (o.x.unit ? ' (' + o.x.unit + ')' : '');
    var yl = o.y.label + (fac !== 1 ? ' (×10' + String(p10).split('').map(function (c) { return SUP[c] || c; }).join('') + (o.y.unit ? ' ' + o.y.unit : '') + ')' : o.y.unit ? ' (' + o.y.unit + ')' : '');
    var yt = el('text', { x: 15, y: r1(m.t + ph / 2), 'text-anchor': 'middle', 'font-size': 12, fill: P.text2, transform: 'rotate(-90 15 ' + r1(m.t + ph / 2) + ')' }, svg);
    yt.textContent = yl;
    // series (clip to plot)
    var cid = 'cl' + Math.random().toString(36).slice(2, 8);
    var cp = el('clipPath', { id: cid }, el('defs', null, svg));
    el('rect', { x: m.l, y: m.t - 2, width: pw, height: ph + 4 }, cp);
    var gS = el('g', { 'clip-path': 'url(#' + cid + ')' }, svg);
    o.series.forEach(function (s) {
      var d = '';
      s.points.forEach(function (p, i) { if (isFinite(p[1])) d += (d ? 'L' : 'M') + r1(sx(p[0])) + ' ' + r1(sy(p[1])); });
      el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || null }, gS);
    });
    // station markers (engine values) — ringed in the surface colour
    (o.markers || []).forEach(function (mk) {
      if (!isFinite(mk.y) || mk.x < xd[0] || mk.x > xd[1]) return;
      el('circle', { cx: r1(sx(mk.x)), cy: r1(sy(mk.y)), r: 4.5, fill: mk.color, stroke: P.surface, 'stroke-width': 2 }, svg);
      if (mk.label) { var t = el('text', { x: r1(sx(mk.x)), y: r1(sy(mk.y) - 9), 'text-anchor': 'middle', 'font-size': 10.5, 'font-family': MONO, 'font-weight': 600, fill: P.text }, svg); t.textContent = mk.label; }
    });
    (o.offMarkers || []).forEach(function (mk) {
      if (!isFinite(mk.y)) return;
      var X = sx(mk.x), Y = sy(mk.y), left = X > m.l + pw - (String(mk.label || '').length * 6.5 + 16);
      el('circle', { cx: r1(X), cy: r1(Y), r: 4.5, fill: P.surface, stroke: mk.color, 'stroke-width': 2 }, svg);
      if (mk.label) { var t = el('text', { x: r1(left ? X - 9 : X + 9), y: r1(Y + (left ? -8 : 4)), 'text-anchor': left ? 'end' : 'start', 'font-size': 10.5, 'font-family': MONO, fill: P.text2 }, svg); t.textContent = mk.label; }
    });
    // end labels supplement the legend — but never stacked: if they would collide, the legend carries identity
    if (o.series.length > 1 && o.endLabels !== false) {
      var ends = o.series.map(function (s) { var last = s.points[s.points.length - 1]; return last ? { s: s, y: sy(last[1]) } : null; }).filter(Boolean);
      var clash = ends.some(function (a, i) { return ends.some(function (b, j) { return i < j && Math.abs(a.y - b.y) < 14; }); });
      if (!clash) ends.forEach(function (e) {
        var t = el('text', { x: r1(m.l + pw - 4), y: r1(e.y - 6), 'text-anchor': 'end', 'font-size': 11, fill: P.text2 }, svg); t.textContent = e.s.short || e.s.name;
      });
    }
    // cursor layer
    this.gCur = el('g', { class: 'cur', 'pointer-events': 'none' }, svg);
    if (o.interactive !== false) {
      var ov = el('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent', style: 'cursor: crosshair' }, svg);
      ov.addEventListener('pointermove', function (e) {
        var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
        var x = xd[0] + (px - m.l) / pw * (xd[1] - xd[0]);
        if (o.onHover) o.onHover(x); else self.setCursor(x);
      });
      ov.addEventListener('pointerleave', function () { if (o.onHover) o.onHover(null); else self.setCursor(null); });
      ov.addEventListener('click', function (e) {
        var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
        if (o.onClick) o.onClick(xd[0] + (px - m.l) / pw * (xd[1] - xd[0]));
      });
    }
    this.box.insertBefore(svg, this.tip);
    if (this.hiBand) this.highlightBand(this.hiBand);
    if (this.cursorX !== null) this.setCursor(this.cursorX);
  };
  LP.setCursor = function (x, opts) {
    var o = this.o, P = this.P, g = this.gCur; if (!g) return;
    g.innerHTML = ''; this.cursorX = x;
    if (x === null || x === undefined || !isFinite(x) || x < this.xd[0] || x > this.xd[1]) { this.tip.classList.remove('show'); return; }
    var X = this.sx(x), m = this.m, self = this;
    el('line', { x1: r1(X), y1: m.t, x2: r1(X), y2: m.t + this.ph, stroke: P.cursor, 'stroke-width': 1, 'stroke-opacity': 0.8 }, g);
    var rows = [];
    o.series.forEach(function (s) {
      var y = interp(s.points, x); if (!isFinite(y)) return;
      el('circle', { cx: r1(X), cy: r1(self.sy(y)), r: 4, fill: s.color, stroke: P.surface, 'stroke-width': 2 }, g);
      rows.push('<div class="ct-r"><svg width="14" height="6" aria-hidden="true"><line x1="1" y1="3" x2="13" y2="3" stroke="' + s.color + '" stroke-width="2.2"' + (s.dash ? ' stroke-dasharray="4 2"' : '') + '/></svg><b class="num">' + esc(o.y.fmt ? o.y.fmt(y) : String(y)) + '</b><span>' + esc(s.name) + '</span></div>');
    });
    var head = '<div class="ct-h">' + esc(o.x.label) + ' <b class="num">' + esc(o.x.fmt ? o.x.fmt(x) : String(x)) + '</b>' + (opts && opts.band ? ' · ' + esc(opts.band) : '') + '</div>';
    this.tip.innerHTML = head + rows.join('');
    this.tip.classList.add('show');
    var bw = this.box.clientWidth, sc = bw / this.W, left = X * sc + 14;
    var tw = this.tip.offsetWidth;
    if (left + tw > bw - 4) left = X * sc - tw - 14;
    this.tip.style.left = Math.max(4, left) + 'px'; this.tip.style.top = (m.t * sc + 6) + 'px';
  };
  LP.highlightBand = function (id) {
    this.hiBand = id;
    for (var k in this.bandEls) { var b = this.bandEls[k]; b.rect.setAttribute('fill', k === id ? this.P.bandHi : b.base); }
  };
  LP.resize = function () { var w = this.box.clientWidth; if (w && Math.abs(w - this.W) > 2 && !this.o.width) this.render(); };
  // standalone SVG with the title / subtitle / legend drawn in (for export & report)
  LP.exportSVG = function (theme) {
    var o = {}; for (var k in this.o) o[k] = this.o[k];
    o.theme = theme || 'light'; o.exportBg = true; o.interactive = false; o.width = o.width || this.W;
    var tmp = document.createElement('div'); tmp.style.cssText = 'position:absolute;left:-10000px;top:0;width:' + o.width + 'px';
    document.body.appendChild(tmp);
    var ch = new Line(tmp, o), P = ch.P, W = ch.W, H0 = ch.H, extra = o.series.length > 1 ? 58 : 44;
    var svg = el('svg', { xmlns: SVGNS, viewBox: '0 0 ' + W + ' ' + (H0 + extra), width: W, height: H0 + extra, 'font-family': SANS });
    el('rect', { width: W, height: H0 + extra, fill: P.surface }, svg);
    var t = el('text', { x: W / 2, y: 20, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 600, fill: P.text }, svg); t.textContent = o.title;
    if (o.subtitle) { var st = el('text', { x: W / 2, y: 37, 'text-anchor': 'middle', 'font-size': 12, fill: P.text2 }, svg); st.textContent = o.subtitle; }
    if (o.series.length > 1) {
      var lx = W / 2 - o.series.length * 70;
      o.series.forEach(function (s, i) {
        var x = lx + i * 140;
        el('line', { x1: x, y1: 50, x2: x + 20, y2: 50, stroke: s.color, 'stroke-width': 2.4, 'stroke-dasharray': s.dash || null }, svg);
        var lt = el('text', { x: x + 26, y: 54, 'font-size': 12, fill: P.text2 }, svg); lt.textContent = s.name;
      });
    }
    var g = el('g', { transform: 'translate(0 ' + extra + ')' }, svg);
    Array.prototype.forEach.call(ch.svg.childNodes, function (n) { g.appendChild(n.cloneNode(true)); });
    tmp.remove();
    return svg;
  };

  /* ------------------------------------------------------------ bar chart */
  // horizontal bars for a handful of named quantities (single series)
  function bars(container, o) {
    var P = palette(o.theme);
    container.innerHTML = '';
    container.classList.add('chart');
    var head = document.createElement('div'); head.className = 'chart-h';
    head.innerHTML = '<div class="chart-t">' + esc(o.title) + '</div>' + (o.subtitle ? '<div class="chart-s">' + esc(o.subtitle) + '</div>' : '');
    container.appendChild(head);
    var W = Math.max(280, o.width || container.clientWidth || 520), rowH = 34, m = { l: o.ml || 150, r: 90, t: 8, b: 28 };
    var H = m.t + m.b + rowH * o.items.length, pw = W - m.l - m.r;
    var max = Math.max.apply(null, o.items.map(function (i) { return Math.abs(i.value); })) || 1;
    var step = niceStep(max, 4), xmax = Math.ceil(max / step) * step;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart-svg', 'font-family': SANS, role: 'img', 'aria-label': o.title });
    for (var gx = 0; gx <= xmax + 1e-9; gx += step) {
      var X = m.l + gx / xmax * pw;
      el('line', { x1: r1(X), y1: m.t, x2: r1(X), y2: H - m.b, stroke: P.grid, 'stroke-width': 1 }, svg);
      var tx = el('text', { x: r1(X), y: H - m.b + 16, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': MONO, fill: P.text2 }, svg); tx.textContent = tickFmt(gx, step);
    }
    o.items.forEach(function (it, i) {
      var y = m.t + i * rowH + 8, w = Math.max(1, Math.abs(it.value) / xmax * pw), bh = Math.min(18, rowH - 14);
      var lab = el('text', { x: m.l - 10, y: y + bh / 2 + 4, 'text-anchor': 'end', 'font-size': 12.5, fill: P.text }, svg); lab.textContent = it.label;
      el('path', { d: 'M' + m.l + ' ' + y + 'H' + r1(m.l + w - 4) + 'Q' + r1(m.l + w) + ' ' + y + ' ' + r1(m.l + w) + ' ' + (y + 4) + 'V' + (y + bh - 4) + 'Q' + r1(m.l + w) + ' ' + (y + bh) + ' ' + r1(m.l + w - 4) + ' ' + (y + bh) + 'H' + m.l + 'Z', fill: it.color || o.color }, svg);
      var vt = el('text', { x: r1(m.l + w + 8), y: y + bh / 2 + 4, 'font-size': 12, 'font-family': MONO, fill: P.text }, svg); vt.textContent = it.text;
    });
    el('line', { x1: m.l, y1: m.t, x2: m.l, y2: H - m.b, stroke: P.axis, 'stroke-width': 1 }, svg);
    var xl = el('text', { x: m.l + pw / 2, y: H - 2, 'text-anchor': 'middle', 'font-size': 12, fill: P.text2 }, svg); xl.textContent = o.xLabel || '';
    var b = document.createElement('div'); b.className = 'chart-b'; b.appendChild(svg); container.appendChild(b);
    return { svg: svg };
  }

  /* ------------------------------------------------------------ export */
  function serialize(svg) { return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg); }
  function toPNG(svg, scale, cb) { VJP.schematic.toPNG(svg, scale, cb); }

  root.VJP.charts = { line: function (c, o) { return new Line(c, o); }, bars: bars, palette: palette, interp: interp, serialize: serialize, toPNG: toPNG, niceStep: niceStep };
})(typeof window !== 'undefined' ? window : this);
