/* PARAMETRIC ENGINEERING SCHEMATIC (SVG)
 * -----------------------------------------------------------------------------
 * Draws the parametric model from js/geometry.js — never a fixed drawing.
 *
 *   world (x mm, r mm) ─► base (x, −r·e) ─► screen (base·k + t)
 *     e = radial display exaggeration (auto or 1:1), shown on screen at all times
 *     k,t = viewport fit / zoom / pan
 *
 * Geometry lives in one transformed group (non-scaling strokes). Annotations
 * (dimensions, labels, stations, flow arrows) are rebuilt in screen space on
 * every view change with lane packing, so labels never collide with each other
 * or with the geometry. Colours are explicit attributes so exports are
 * self-contained. The flow canvas (js/flow.js) shares this viewer's transform.
 * ========================================================================== */
(function (root) {
  'use strict';
  var VJP = root.VJP, U = VJP.units, S = VJP.schema, SVGNS = 'http://www.w3.org/2000/svg';
  var MONO = "'IBM Plex Mono', 'JetBrains Mono', Consolas, monospace", SANS = "Inter, 'Segoe UI', system-ui, sans-serif";

  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) { var v = attrs[k]; if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v); }
    if (parent) parent.appendChild(e);
    return e;
  }
  function cssv(n, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || fb; }
  function r1(v) { return Math.round(v * 10) / 10; }

  var PALETTES = {
    dark: { bg: '#0A0F19', grid: '#111A28', wall: '#223047', wall2: '#28374F', hatch: '#51678A', line: '#C7D2E2', bore: '#0D1726', bore2: '#122036',
      dim: '#A9B4C5', center: '#6B7A91', flange: '#243249', text: '#F4F7FB', text2: '#A9B4C5', muted: '#7C8AA0', brand: '#F59E0B', brandInk: '#FDBA74',
      motive: '#38BDF8', solids: '#C08A3E', plate: '#0A0F19', lance: '#2A3850', frame: '#394963' },
    light: { bg: '#FFFFFF', grid: '#EEF2F7', wall: '#E2E8F0', wall2: '#E9EEF4', hatch: '#8A98AD', line: '#1E293B', bore: '#FFFFFF', bore2: '#F3F6FA',
      dim: '#334155', center: '#64748B', flange: '#CBD5E1', text: '#0E1522', text2: '#3D4B61', muted: '#5B687D', brand: '#C2410C', brandInk: '#B45309',
      motive: '#0284C7', solids: '#92400E', plate: '#FFFFFF', lance: '#D8E0EA', frame: '#94A3B8' }
  };
  function livePalette() {
    var light = document.documentElement.getAttribute('data-theme') === 'light', b = light ? PALETTES.light : PALETTES.dark;
    return {
      bg: cssv('--sch-bg', b.bg), grid: cssv('--sch-grid', b.grid), wall: cssv('--sch-wall', b.wall), wall2: cssv('--sch-wall-2', b.wall2),
      hatch: cssv('--sch-hatch', b.hatch), line: cssv('--sch-line', b.line), bore: cssv('--sch-bore', b.bore), bore2: cssv('--sch-bore-2', b.bore2),
      dim: cssv('--sch-dim', b.dim), center: cssv('--sch-center', b.center), flange: cssv('--sch-flange', b.flange), text: cssv('--text', b.text),
      text2: cssv('--text-2', b.text2), muted: cssv('--text-muted', b.muted), brand: cssv('--brand', b.brand), brandInk: cssv('--brand-ink', b.brandInk),
      motive: cssv('--motive', b.motive), solids: b.solids, plate: cssv('--sch-bg', b.plate), lance: b.lance, frame: b.frame
    };
  }

  function autoExag(model) {
    var e = model.totalLength / (3.2 * (model.top - model.bottom));
    if (!(e > 1.15)) return 1;
    return Math.min(3.5, e);
  }

  // symbol mini-markup -> <tspan>s inside a <text>
  function symText(t, markup, small) {
    var s = String(markup || ''), re = /_\{([^}]*)\}|\^\{([^}]*)\}|_([A-Za-zα-ω0-9])/g, last = 0, m;
    function plain(txt) { if (txt) { var n = el('tspan', null, t); n.textContent = txt; } }
    while ((m = re.exec(s))) {
      plain(s.slice(last, m.index));
      var sub = m[1] !== undefined ? m[1] : m[3], sup = m[2];
      var sp = el('tspan', { 'baseline-shift': sup !== undefined ? 'super' : 'sub', 'font-size': (small || 0.72) * 100 + '%' }, t);
      sp.textContent = sup !== undefined ? sup : sub;
      last = re.lastIndex;
    }
    plain(s.slice(last));
    return t;
  }
  function symLen(markup) { return String(markup || '').replace(/_\{([^}]*)\}/g, '$1').replace(/\^\{([^}]*)\}/g, '$1').replace(/_(.)/g, '$1').length; }

  /* ---- 1-D lane packer: labels [{c, w}] -> positions (clusters, min displacement) */
  function pack(items, lo, hi, gap) {
    gap = gap || 8;
    var order = items.map(function (it, i) { return i; }).sort(function (a, b) { return items[a].c - items[b].c; });
    var blocks = [];
    order.forEach(function (i) {
      var it = items[i], b = { ids: [i], w: it.w, sum: it.c };
      blocks.push(b);
      while (blocks.length > 1) {
        var A = blocks[blocks.length - 2], B = blocks[blocks.length - 1];
        var aC = place(A), bC = place(B);
        if (aC.end + gap <= bC.start) break;
        A.ids = A.ids.concat(B.ids); A.w += B.w + gap; A.sum += B.sum; blocks.pop();
      }
    });
    function place(b) { var ctr = b.sum / b.ids.length, st = ctr - b.w / 2; st = Math.max(lo, Math.min(hi - b.w, st)); return { start: st, end: st + b.w }; }
    blocks.forEach(function (b) {
      var p = place(b), x = p.start;
      b.ids.forEach(function (i) { items[i].x = x + items[i].w / 2; x += items[i].w + gap; });
    });
    var overflow = blocks.some(function (b) { return b.w > hi - lo; });
    return { items: items, overflow: overflow };
  }

  /* ---------------------------------------------------------------------------
   * Drawing core — shared by the live viewer and the exports
   * ------------------------------------------------------------------------- */
  function pathD(pts, e) {
    var s = '';
    for (var i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + r1(pts[i][0]) + ' ' + r1(-pts[i][1] * e);
    return s + 'Z';
  }
  function defs(svg, P, id, k) {
    var d = el('defs', null, svg);
    var inv = 1 / (k || 1);
    [['hB', 45], ['hL', -45]].forEach(function (h) {
      var p = el('pattern', { id: id + h[0], patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(' + h[1] + ') scale(' + inv + ')' }, d);
      el('rect', { width: 7, height: 7, fill: h[0] === 'hL' ? P.lance : P.wall }, p);
      el('line', { x1: 3.5, y1: -1, x2: 3.5, y2: 8, stroke: P.hatch, 'stroke-width': 1.15 }, p);
    });
    var g = el('linearGradient', { id: id + 'bore', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el('stop', { offset: '0', 'stop-color': P.bore }, g); el('stop', { offset: '0.5', 'stop-color': P.bore2 }, g); el('stop', { offset: '1', 'stop-color': P.bore }, g);
    return d;
  }
  // geometry group (world units, transformed by the caller)
  function drawGeometry(g, M, e, P, id, o) {
    o = o || {};
    var poly = M.poly, simplified = !!o.simplified, NS = 'non-scaling-stroke';
    if (!o.noBore) el('path', { d: pathD(poly.fluid, e), fill: 'url(#' + id + 'bore)', stroke: 'none', class: 'sch-bore' }, g);
    var walls = el('g', { class: 'sch-walls' }, g);
    var body = [poly.bodyAU, poly.bodyBU, poly.bodyL], lance = [poly.lanceU, poly.lanceL];
    if (!simplified) poly.flanges.forEach(function (f) { el('path', { d: pathD(f, e), fill: simplified ? P.wall : 'url(#' + id + 'hB)', stroke: P.line, 'stroke-width': 1.2, 'vector-effect': NS, 'stroke-linejoin': 'round' }, walls); });
    body.forEach(function (pp) { el('path', { d: pathD(pp, e), fill: simplified ? P.wall : 'url(#' + id + 'hB)', stroke: P.line, 'stroke-width': 1.5, 'vector-effect': NS, 'stroke-linejoin': 'round' }, walls); });
    lance.forEach(function (pp) { el('path', { d: pathD(pp, e), fill: simplified ? P.lance : 'url(#' + id + 'hL)', stroke: P.line, 'stroke-width': 1.5, 'vector-effect': NS, 'stroke-linejoin': 'round' }, walls); });
    // centreline (dash-dot)
    var L = M.totalLength;
    el('line', { x1: r1(-0.035 * L), y1: 0, x2: r1(L * 1.035), y2: 0, stroke: P.center, 'stroke-width': 1, 'vector-effect': NS, 'stroke-dasharray': '14 4 2 4' }, g);
    // branch centreline
    el('line', { x1: r1(M.branch.x), y1: r1(-(M.Rc - 0.05 * M.branch.H) * e), x2: r1(M.branch.x), y2: r1(-(M.branch.top + 0.12 * M.branch.H) * e), stroke: P.center, 'stroke-width': 1, 'vector-effect': NS, 'stroke-dasharray': '10 3 2 3' }, g);
  }

  // Screen-space annotations. T = {sx(x), sy(r)} transforms; returns nothing.
  function drawAnnotations(a, M, D, T, P, f, o) {
    o = o || {};
    var E = M.E, sys = f.sys, hiComp = o.hiComp || null, hiDim = o.hiDim || null;
    var sx = T.sx, sy = T.sy;
    var W = o.W, H = o.H;
    var bottom = sy(M.bottom), top = sy(M.top);
    function col(d) { return (hiDim && d.id === hiDim) || (hiComp && d.comp === hiComp) ? P.brand : P.dim; }
    function tcol(d) { return (hiDim && d.id === hiDim) || (hiComp && d.comp === hiComp) ? P.brandInk : P.text; }
    function arrow(x, y, ang, c, size) {
      size = size || 7; var w = size * 0.42;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      el('path', { d: 'M' + r1(x) + ' ' + r1(y) + 'L' + r1(x - ca * size - sa * w) + ' ' + r1(y - sa * size + ca * w) + 'L' + r1(x - ca * size + sa * w) + ' ' + r1(y - sa * size - ca * w) + 'Z', fill: c }, a);
    }
    function plate(x, y, w, h) { el('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(h), rx: 2, fill: P.plate, 'fill-opacity': 0.88 }, a); }
    function valText(d) { return d.dim === 'angle' ? U.fixed(d.value, 1) : U.display(d.value, d.dim, sys, 4).text; }
    var unitNote = U.unitLabel('len_mm', sys);

    // ---- diameter dimensions: dim line across the bore + label in the lane below
    var diaLane = bottom + 30;
    var dias = M.dims.filter(function (d) { return d.kind === 'dia'; });
    var diaItems = dias.map(function (d) {
      var txt = 'Ø' + valText(d), w = 8 + (symLen(d.sym) * 0.62 + 1) * 11 + txt.length * 7.3;
      return { d: d, c: sx(d.x), w: w, txt: txt };
    });
    if (o.dims !== false) {
      pack(diaItems, 8, W - 8, 10);
      diaItems.forEach(function (it) {
        var d = it.d, x = sx(d.x), y0 = sy(d.r), y1 = sy(-d.r), c = col(d);
        el('line', { x1: r1(x), y1: r1(y0 + 1), x2: r1(x), y2: r1(y1 - 1), stroke: c, 'stroke-width': 1 }, a);
        arrow(x, y0 + 0.5, -Math.PI / 2, c); arrow(x, y1 - 0.5, Math.PI / 2, c);
        // leader to label
        el('path', { d: 'M' + r1(x) + ' ' + r1(y1 + 2) + 'L' + r1(x) + ' ' + r1(diaLane - 22) + 'L' + r1(it.x) + ' ' + r1(diaLane - 13), stroke: c, 'stroke-width': 0.8, fill: 'none', 'stroke-opacity': 0.8 }, a);
        plate(it.x - it.w / 2, diaLane - 12, it.w, 17);
        var t = el('text', { x: r1(it.x), y: r1(diaLane), 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 12, fill: tcol(d), 'data-dim': d.id }, a);
        var s1 = el('tspan', { fill: col(d) === P.brand ? P.brandInk : P.muted, 'font-family': SANS, 'font-size': 11 }, t);
        symText(s1, d.sym);
        var s2 = el('tspan', { dx: 5 }, t); s2.textContent = it.txt;
      });
    }

    // ---- length chain + overall
    var chainY = bottom + 70, allY = bottom + 100;
    if (o.dims !== false) {
      var lens = M.dims.filter(function (d) { return d.kind === 'len'; });
      var extTop = function (x) { var rr = M.wallRadius(x); var tt = x < M.x.cbi ? M.lanceOuter(x) : M.bodyInner(x) + M.t; return sy(-Math.max(rr, tt)) + 4; };
      [0, 1].forEach(function (row) {
        var y = row ? allY : chainY;
        var set = lens.filter(function (d) { return d.row === row; });
        var items = set.map(function (d) {
          var txt = valText(d), w = 10 + (symLen(d.sym) * 0.62 + 1) * 11 + txt.length * 7.3;
          return { d: d, c: (sx(d.x0) + sx(d.x1)) / 2, w: w, txt: txt, span: sx(d.x1) - sx(d.x0) };
        });
        pack(items, 8, W - 8, 10);
        items.forEach(function (it) {
          var d = it.d, xa = sx(d.x0), xb = sx(d.x1), c = col(d);
          // extension lines (small gap at the object, run 5 px past the dim line)
          [xa, xb].forEach(function (x, j) {
            var xw = j ? d.x1 : d.x0;
            el('line', { x1: r1(x), y1: r1(row ? chainY + 6 : extTop(xw)), x2: r1(x), y2: r1(y + 5), stroke: P.dim, 'stroke-width': 0.8, 'stroke-opacity': 0.75 }, a);
          });
          el('line', { x1: r1(xa), y1: r1(y), x2: r1(xb), y2: r1(y), stroke: c, 'stroke-width': 1 }, a);
          if (xb - xa > 18) { arrow(xa, y, Math.PI, c, 6); arrow(xb, y, 0, c, 6); }
          else { [xa, xb].forEach(function (x) { el('line', { x1: r1(x - 3), y1: r1(y + 3), x2: r1(x + 3), y2: r1(y - 3), stroke: c, 'stroke-width': 1.3 }, a); }); }
          var inside = it.w + 8 < it.span;
          var ty = y - 5;
          if (!inside || Math.abs(it.x - it.c) > 1) el('line', { x1: r1(it.c), y1: r1(y - 1), x2: r1(it.x), y2: r1(ty - 3), stroke: c, 'stroke-width': 0.7, 'stroke-opacity': 0.7 }, a);
          plate(it.x - it.w / 2, ty - 13, it.w, 16);
          var t = el('text', { x: r1(it.x), y: r1(ty), 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 12, fill: tcol(d), 'data-dim': d.id }, a);
          var s1 = el('tspan', { fill: col(d) === P.brand ? P.brandInk : P.muted, 'font-family': SANS, 'font-size': 11 }, t);
          symText(s1, d.sym);
          var s2 = el('tspan', { dx: 5 }, t); s2.textContent = it.txt;
        });
      });
      // suction bore (horizontal dim across the branch)
      var ds = M.dims.filter(function (d) { return d.id === 'D_s'; })[0];
      if (ds) {
        var y = sy(ds.y), xa = sx(ds.x0), xb = sx(ds.x1), c = col(ds);
        el('line', { x1: r1(xa + 1), y1: r1(y), x2: r1(xb - 1), y2: r1(y), stroke: c, 'stroke-width': 1 }, a);
        arrow(xa + 0.5, y, Math.PI, c); arrow(xb - 0.5, y, 0, c);
        var lx = sx(M.branch.x1 + M.t + M.flange.suction.W) + 10, txt = 'Ø' + valText(ds);
        el('line', { x1: r1(xb), y1: r1(y), x2: r1(lx - 3), y2: r1(y), stroke: c, 'stroke-width': 0.7, 'stroke-opacity': 0.7, 'stroke-dasharray': '2 2' }, a);
        var w = 10 + 3 * 11 * 0.62 + txt.length * 7.3;
        plate(lx - 3, y - 11, w, 16);
        var t2 = el('text', { x: r1(lx), y: r1(y + 4), 'font-family': MONO, 'font-size': 12, fill: tcol(ds), 'data-dim': 'D_s' }, a);
        symText(el('tspan', { fill: P.muted, 'font-family': SANS, 'font-size': 11 }, t2), ds.sym);
        el('tspan', { dx: 5 }, t2).textContent = txt;
      }
      // angles
      M.dims.filter(function (d) { return d.kind === 'angle'; }).forEach(function (d) {
        var cx = sx(d.x0), cy = sy(-d.r0), ex = sx(d.x1), ey = sy(-d.r1), c = col(d);
        var ang = Math.atan2(ey - cy, ex - cx), rad = 30;
        var x1 = cx + rad, y1 = cy, x2 = cx + rad * Math.cos(ang), y2 = cy + rad * Math.sin(ang);
        el('line', { x1: r1(cx), y1: r1(cy), x2: r1(cx + rad + 12), y2: r1(cy), stroke: c, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }, a);
        el('path', { d: 'M' + r1(x1) + ' ' + r1(y1) + 'A' + rad + ' ' + rad + ' 0 0 ' + (ang < 0 ? 0 : 1) + ' ' + r1(x2) + ' ' + r1(y2), stroke: c, 'stroke-width': 1, fill: 'none' }, a);
        var txt = valText(d) + '°', tx = cx + rad + 16, tyy = cy + (ang < 0 ? -6 : 14);
        var w = 10 + 2 * 11 * 0.62 + txt.length * 7.3;
        plate(tx - 3, tyy - 12, w, 16);
        var t = el('text', { x: r1(tx), y: r1(tyy), 'font-family': MONO, 'font-size': 12, fill: tcol(d), 'data-dim': d.id }, a);
        symText(el('tspan', { fill: P.muted, 'font-family': SANS, 'font-size': 11 }, t), d.sym);
        el('tspan', { dx: 5 }, t).textContent = txt;
      });
    }

    // ---- component call-outs (top lane) with flow rates for the three connections
    if (o.labels !== false) {
      var lane = top - 30;
      var flows = D ? { motive: ['Q_m', D.R.inputs.Qm_Lmin], suction: ['Q_s', D.R.operating.Qs_Lmin], discharge: ['Q_d', D.R.operating.Qd_Lmin] } : {};
      var comps = M.components.map(function (cmp) {
        var ax = cmp.id === 'suction' ? M.branch.x : cmp.id === 'chamber' ? (M.x.e0 + M.x.th0) / 2 : (cmp.x0 + cmp.x1) / 2;
        var name = cmp.name.toUpperCase(), fl = flows[cmp.id];
        var sub = fl ? U.q(fl[1], 'flow_Lmin', sys, 4) : '';
        var w = Math.max(name.length * 7.1 + 6, fl ? (symLen(fl[0]) + 1) * 7 + sub.length * 6.9 + 8 : 0);
        var ar = cmp.id === 'suction' ? M.branch.top : cmp.id === 'motive' ? M.E.D_in / 2 + M.t : cmp.id === 'nozzle' ? M.lanceOuter(ax) : cmp.id === 'chamber' ? M.bodyInner(ax) + M.t : M.bodyInner(ax) + M.t;
        return { cmp: cmp, c: sx(ax), ax: ax, ar: ar, w: w, name: name, fl: fl, sub: sub };
      });
      var res = pack(comps, 8, W - 8, 12);
      var twoRows = res.overflow;
      comps.forEach(function (it, i) {
        var hi = hiComp === it.cmp.id, cc = hi ? P.brand : P.center, tc = hi ? P.brandInk : P.text2;
        var ly = twoRows && i % 2 ? lane - 30 : lane;
        var anchorY = sy(it.ar) - 3;
        if (it.cmp.id !== 'suction') {
          el('path', { d: 'M' + r1(it.x) + ' ' + r1(ly + (it.fl ? 20 : 6)) + 'L' + r1(it.c) + ' ' + r1(Math.max(ly + 24, anchorY - 10)) + 'L' + r1(it.c) + ' ' + r1(anchorY), stroke: cc, 'stroke-width': 0.8, fill: 'none', 'stroke-opacity': hi ? 1 : 0.7 }, a);
          el('circle', { cx: r1(it.c), cy: r1(anchorY), r: 2.2, fill: cc }, a);
        }
        var t = el('text', { x: r1(it.x), y: r1(ly), 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 11, 'font-weight': 650, 'letter-spacing': '0.07em', fill: tc, 'data-comp': it.cmp.id }, a);
        t.textContent = it.name;
        if (it.fl) {
          var t2 = el('text', { x: r1(it.x), y: r1(ly + 14), 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 11, fill: P.muted }, a);
          symText(el('tspan', null, t2), it.fl[0]);
          el('tspan', { dx: 4, fill: P.text2 }, t2).textContent = it.sub;
        }
      });
      // flow arrows at the three connections
      if (o.flowArrows !== false) {
        var c0 = sx(0), cy0 = sy(0);
        el('line', { x1: r1(c0 - 46), y1: r1(cy0), x2: r1(c0 - 8), y2: r1(cy0), stroke: P.motive, 'stroke-width': 2.2 }, a);
        arrow(c0 - 4, cy0, 0, P.motive, 10);
        var bxs = sx(M.branch.x), by0 = sy(M.branch.top);
        var aTop = comps.filter(function (c) { return c.cmp.id === 'suction'; })[0];
        var yStart = (aTop && twoRows && comps.indexOf(aTop) % 2 ? lane - 30 : lane) + 20;
        el('line', { x1: r1(bxs), y1: r1(Math.min(yStart, by0 - 14)), x2: r1(bxs), y2: r1(by0 - 9), stroke: P.solids, 'stroke-width': 2.2 }, a);
        arrow(bxs, by0 - 4, Math.PI / 2, P.solids, 10);
        var ce = sx(M.totalLength);
        el('line', { x1: r1(ce + 6), y1: r1(cy0), x2: r1(ce + 40), y2: r1(cy0), stroke: P.text2, 'stroke-width': 2.2 }, a);
        arrow(ce + 46, cy0, 0, P.text2, 10);
      }
    }

    // ---- Bernoulli stations
    if (o.stations && D) {
      var ST = [['s1', '1'], ['s2', '2'], ['s2s', '2s'], ['s3', '3'], ['s4', '4']];
      ST.forEach(function (s, i) {
        var x = sx(M.stationX[s[0]]), cy = sy(0), rr = M.pathRadius(M.stationX[s[0]]);
        el('line', { x1: r1(x), y1: r1(sy(rr)), x2: r1(x), y2: r1(sy(-rr)), stroke: P.muted, 'stroke-width': 0.8, 'stroke-dasharray': '1 3' }, a);
        var yy = cy + (i % 2 ? 18 : -18);
        el('circle', { cx: r1(x), cy: r1(yy), r: 9, fill: P.plate, stroke: P.text2, 'stroke-width': 1 }, a);
        var t = el('text', { x: r1(x), y: r1(yy + 3.5), 'text-anchor': 'middle', 'font-family': MONO, 'font-size': s[1].length > 1 ? 9 : 10.5, 'font-weight': 600, fill: P.text }, a);
        t.textContent = s[1];
      });
    }

    // ---- scale bar
    if (o.scaleBar !== false && T.k > 0 && isFinite(T.k)) {
      var k = T.k, target = 120 / k, pw = Math.pow(10, Math.floor(Math.log10(target))), n = target / pw;
      var len = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pw, px = len * k, x0 = 14, y0 = 20;
      if (sys === 'imp') { var inch = 25.4, tl = target / inch, pi = Math.pow(10, Math.floor(Math.log10(tl))), ni = tl / pi; len = (ni < 1.5 ? 1 : ni < 3.5 ? 2 : ni < 7.5 ? 5 : 10) * pi * inch; px = len * k; }
      var sLabel = U.q(len, 'len_mm', sys, 3) + ' (axial)';
      el('rect', { x: x0 - 6, y: y0 - 15, width: r1(px + 22 + sLabel.length * 6.8), height: 22, rx: 3, fill: P.plate, 'fill-opacity': 0.82 }, a);
      el('rect', { x: x0, y: y0 - 4, width: r1(px / 2), height: 4, fill: P.text2 }, a);
      el('rect', { x: r1(x0 + px / 2), y: y0 - 4, width: r1(px / 2), height: 4, fill: 'none', stroke: P.text2, 'stroke-width': 1 }, a);
      var st = el('text', { x: r1(x0 + px + 8), y: y0, 'font-family': MONO, 'font-size': 11, fill: P.text2 }, a);
      st.textContent = sLabel;
    }
    return { unitNote: unitNote };
  }

  /* ---------------------------------------------------------------------------
   * Live viewer
   * ------------------------------------------------------------------------- */
  var uid = 0;
  function Viewer(container, opts) {
    this.c = container; this.opts = opts || {};
    this.id = 'sch' + (++uid);
    this.s = { mode: 'engineering', dims: true, labels: true, stations: false, arrows: true, exag: 'auto', simplified: false };
    for (var k in (this.opts.state || {})) this.s[k] = this.opts.state[k];
    this.view = { k: 1, tx: 0, ty: 0, user: false };
    this.sel = null; this.hov = null; this.hiDim = null;
    this.ls = {};
    this._build();
  }
  var VP = Viewer.prototype;
  VP.on = function (evt, fn) { (this.ls[evt] = this.ls[evt] || []).push(fn); };
  VP.emit = function (evt, a) { (this.ls[evt] || []).forEach(function (fn) { fn(a); }); };

  VP._build = function () {
    var self = this, c = this.c;
    c.classList.add('sch-view');
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'application');
    c.setAttribute('aria-label', 'Venturi schematic. Drag to pan, scroll to zoom, F to fit, D dimensions, L labels.');
    this.back = el('svg', { class: 'sch-back', width: '100%', height: '100%' });
    this.canvas = document.createElement('canvas'); this.canvas.className = 'sch-flow';
    this.front = el('svg', { class: 'sch-front', width: '100%', height: '100%' });
    this.tip = document.createElement('div'); this.tip.className = 'sch-tip';
    c.appendChild(this.back); c.appendChild(this.canvas); c.appendChild(this.front); c.appendChild(this.tip);
    // interactions
    var drag = null;
    c.addEventListener('wheel', function (e) {
      if (!self.M) return;
      e.preventDefault();
      var r = c.getBoundingClientRect(), f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      self.zoomBy(f, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    c.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !self.M) return;
      drag = { x: e.clientX, y: e.clientY, tx: self.view.tx, ty: self.view.ty, moved: false, id: e.pointerId };
    });
    c.addEventListener('pointermove', function (e) {
      if (drag && drag.id === e.pointerId) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; c.setPointerCapture(e.pointerId); c.classList.add('panning'); self._hideTip(); }
        if (drag.moved) { self.view.tx = drag.tx + dx; self.view.ty = drag.ty + dy; self.view.user = true; self._applyView(); }
        return;
      }
      self._hoverAt(e);
    });
    c.addEventListener('pointerup', function (e) {
      if (drag && !drag.moved) {
        var comp = self._compAt(e);
        self.select(comp && comp === self.sel ? null : comp, true);
      }
      if (drag && drag.moved) { try { c.releasePointerCapture(e.pointerId); } catch (x) {} }
      drag = null; c.classList.remove('panning');
    });
    c.addEventListener('pointerleave', function () { if (!drag) { self._setHover(null); self._hideTip(); } });
    c.addEventListener('dblclick', function () { self.fit(); });
    c.addEventListener('keydown', function (e) {
      if (!self.M) return;
      var k = e.key, W = self.W, H = self.H;
      if (k === '+' || k === '=') self.zoomBy(1.25, W / 2, H / 2);
      else if (k === '-' || k === '_') self.zoomBy(0.8, W / 2, H / 2);
      else if (k === '0' || k === 'f' || k === 'F') self.fit();
      else if (k === 'ArrowLeft') { self.view.tx += 40; self.view.user = true; self._applyView(); }
      else if (k === 'ArrowRight') { self.view.tx -= 40; self.view.user = true; self._applyView(); }
      else if (k === 'ArrowUp') { self.view.ty += 40; self.view.user = true; self._applyView(); }
      else if (k === 'ArrowDown') { self.view.ty -= 40; self.view.user = true; self._applyView(); }
      else if (k === 'Escape') self.select(null, true);
      else if (k === 'd' || k === 'D') { self.set({ dims: !self.s.dims }); self.emit('state', self.s); }
      else if (k === 'l' || k === 'L') { self.set({ labels: !self.s.labels }); self.emit('state', self.s); }
      else return;
      e.preventDefault();
    });
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(function () { self._resize(); });
      this.ro.observe(c);
    }
  };
  VP._resize = function () {
    var r = this.c.getBoundingClientRect();
    var W = Math.max(200, Math.round(r.width)), H = Math.max(160, Math.round(r.height));
    if (W === this.W && H === this.H) return;
    var oldW = this.W, oldH = this.H;
    this.W = W; this.H = H;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr; this.canvas.height = H * dpr; this.dpr = dpr;
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    if (!this.M) return;
    if (!this.view.user || !oldW) this.fit(true);
    else { this.view.tx += (W - oldW) / 2; this.view.ty += (H - oldH) / 2; this._applyView(); }
  };

  VP.setDesign = function (D, f) {
    this.D = D; this.f = f;
    this.P = livePalette();
    var M = D && D.model;
    var changed = !this.M || !M || !this.M || M.totalLength !== this.M.totalLength || M.top !== this.M.top;
    this.M = M;
    if (!M) { this.back.innerHTML = ''; this.front.innerHTML = ''; this.emit('view', this.view); return; }
    this.e = this.s.exag === 'auto' ? autoExag(M) : 1;
    this._resize();
    if (!this.W) return;
    if (!this.view.user || changed && !this.view.user) this.fit(true);
    else this._render();
  };
  VP.set = function (patch) {
    var geo = false;
    for (var k in patch) { if (this.s[k] !== patch[k]) { this.s[k] = patch[k]; if (k === 'exag' || k === 'simplified' || k === 'mode') geo = true; } }
    if (!this.M) return;
    if (patch.exag !== undefined) { this.e = this.s.exag === 'auto' ? autoExag(this.M) : 1; this.fit(true); return; }
    if (patch.mode !== undefined || patch.dims !== undefined || patch.labels !== undefined) { if (!this.view.user) { this.fit(true); return; } }
    if (geo) this._render(); else this._applyView();
  };
  VP.pads = function () {
    var s = this.s, flow = s.mode === 'flow';
    return { l: 64, r: 64, t: s.labels ? 76 : 40, b: flow ? 124 : s.dims ? 128 : 52 };
  };
  VP.fit = function (silent) {
    var M = this.M; if (!M || !this.W) return;
    var p = this.pads(), e = this.e, L = M.totalLength;
    var x0 = -0.03 * L, bw = L * 1.06;
    var topB = M.top * e, botB = -M.bottom * e, bh = topB + botB;
    var aw = Math.max(80, this.W - p.l - p.r), ah = Math.max(60, this.H - p.t - p.b);   // never a negative scale before layout
    var k = Math.min(aw / bw, ah / bh);
    this.view = { k: k, tx: p.l + (aw - bw * k) / 2 - x0 * k, ty: p.t + (ah - bh * k) / 2 + topB * k, user: false };
    this.kFit = k;
    this._render();
    if (!silent) this.emit('view', this.view);
  };
  VP.zoomBy = function (f, cx, cy) {
    if (!this.M) return;
    var k = this.view.k, nk = Math.max(this.kFit * 0.5, Math.min(this.kFit * 24, k * f)), ff = nk / k;
    this.view.tx = cx - (cx - this.view.tx) * ff; this.view.ty = cy - (cy - this.view.ty) * ff; this.view.k = nk;
    this.view.user = true;
    this._applyView();
  };
  VP.zoomLevel = function () { return this.kFit ? this.view.k / this.kFit : 1; };
  VP.sx = function (x) { return x * this.view.k + this.view.tx; };
  VP.sy = function (r) { return -r * this.e * this.view.k + this.view.ty; };
  VP.toWorld = function (px, py) { return { x: (px - this.view.tx) / this.view.k, r: -(py - this.view.ty) / (this.view.k * this.e) }; };

  VP._render = function () {
    var M = this.M, P = this.P, id = this.id;
    this.back.innerHTML = ''; this.front.innerHTML = '';
    if (!M) return;
    var flow = this.s.mode === 'flow';
    // back: drafting grid + bore
    var bd = el('defs', null, this.back);
    var gp = el('pattern', { id: id + 'grid', patternUnits: 'userSpaceOnUse', width: 24, height: 24 }, bd);
    el('path', { d: 'M24 0H0V24', fill: 'none', stroke: P.grid, 'stroke-width': 1 }, gp);
    el('rect', { width: '100%', height: '100%', fill: flow ? P.bg : 'url(#' + id + 'grid)' }, this.back);
    defs(this.back, P, id + 'b', this.view.k);
    this.gBack = el('g', null, this.back);
    if (flow) el('path', { d: pathD(M.poly.fluid, this.e), fill: P.bg === '#FFFFFF' ? '#F1F5F9' : '#060B13', stroke: 'none' }, this.gBack);
    else el('path', { d: pathD(M.poly.fluid, this.e), fill: 'url(#' + id + 'bbore)', stroke: 'none' }, this.gBack);
    // front: walls, highlight, hit regions
    this.frontDefs = defs(this.front, P, id + 'f', this.view.k);
    this.gHi = el('g', { class: 'sch-hi' }, this.front);
    this.gGeo = el('g', null, this.front);
    drawGeometry(this.gGeo, M, this.e, P, id + 'f', { simplified: this.s.simplified, noBore: true });
    this.gHit = el('g', { class: 'sch-hit' }, this.front);
    var self = this;
    ['nozzle', 'motive', 'suction', 'throat', 'diffuser', 'discharge', 'chamber'].forEach(function (cid) {
      var cp = M.comp[cid];
      el('path', { d: pathD(cp.hit, self.e), fill: 'transparent', 'data-comp': cid, 'pointer-events': 'all' }, self.gHit);
    });
    this.gAnn = el('g', { class: 'sch-ann' }, this.front);
    this._applyView();
  };
  VP._applyView = function () {
    if (!this.M || !this.gGeo) return;
    var v = this.view, tr = 'matrix(' + v.k + ' 0 0 ' + v.k + ' ' + r1(v.tx) + ' ' + r1(v.ty) + ')';
    this.gBack.setAttribute('transform', tr);
    this.gHi.setAttribute('transform', tr); this.gGeo.setAttribute('transform', tr); this.gHit.setAttribute('transform', tr);
    var inv = 1 / v.k;
    [this.frontDefs].forEach(function (d) {
      d.querySelectorAll('pattern').forEach(function (p) { var rot = p.id.slice(-2) === 'hL' ? -45 : 45; p.setAttribute('patternTransform', 'rotate(' + rot + ') scale(' + inv + ')'); });
    });
    this._drawHighlight();
    this._drawAnnotations();
    this.emit('view', this.view);
  };
  VP._drawHighlight = function () {
    var g = this.gHi; g.innerHTML = '';
    var M = this.M, P = this.P, self = this;
    [[this.hov, 0.07], [this.sel, 0.14]].forEach(function (x) {
      var cid = x[0]; if (!cid || !M.comp[cid]) return;
      el('path', { d: pathD(M.comp[cid].region, self.e), fill: P.brand, 'fill-opacity': x[1], stroke: P.brand, 'stroke-width': cid === self.sel ? 1.6 : 1, 'stroke-opacity': cid === self.sel ? 0.95 : 0.6, 'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': cid === self.sel ? '' : '5 3' }, g);
    });
  };
  VP._drawAnnotations = function () {
    var a = this.gAnn; a.innerHTML = '';
    var self = this, flow = this.s.mode === 'flow';
    drawAnnotations(a, this.M, this.D, { sx: function (x) { return self.sx(x); }, sy: function (r) { return self.sy(r); }, k: this.view.k },
      this.P, this.f, { W: this.W, H: this.H, dims: this.s.dims && !flow, labels: this.s.labels, stations: this.s.stations, flowArrows: this.s.arrows,
        hiComp: this.sel || this.hov, hiDim: this.hiDim, scaleBar: true });
  };

  VP._compAt = function (e) {
    var t = document.elementFromPoint(e.clientX, e.clientY);
    if (t && t.getAttribute) { var cid = t.getAttribute('data-comp'); if (cid) return cid; }
    return null;
  };
  VP._hoverAt = function (e) {
    var cid = this._compAt(e);
    this._setHover(cid);
    if (cid && this.opts.tooltip) {
      var html = this.opts.tooltip(cid);
      if (html) {
        var r = this.c.getBoundingClientRect();
        this.tip.innerHTML = html; this.tip.classList.add('show');
        var x = e.clientX - r.left + 14, y = e.clientY - r.top + 16, tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
        if (x + tw > this.W - 6) x = e.clientX - r.left - tw - 14;
        if (y + th > this.H - 6) y = e.clientY - r.top - th - 12;
        this.tip.style.left = x + 'px'; this.tip.style.top = y + 'px';
      }
    } else this._hideTip();
  };
  VP._hideTip = function () { this.tip.classList.remove('show'); };
  VP._setHover = function (cid) {
    if (cid === this.hov) return;
    this.hov = cid; this.c.style.cursor = cid ? 'pointer' : '';
    this._drawHighlight(); this._drawAnnotations();
    this.emit('hover', cid);
  };
  VP.hover = function (cid) { if (cid !== this.hov) { this.hov = cid; if (this.M) { this._drawHighlight(); this._drawAnnotations(); } } };
  VP.select = function (cid, user) {
    this.sel = cid || null;
    if (this.M) { this._drawHighlight(); this._drawAnnotations(); }
    if (user) this.emit('select', this.sel);
  };
  VP.highlightDim = function (dimId) { this.hiDim = dimId || null; if (this.M) this._drawAnnotations(); };
  VP.focusComponent = function (cid) {
    var M = this.M; if (!M || !M.comp[cid]) return;
    var c = M.comp[cid], x0 = c.x0, x1 = c.x1, cx = (x0 + x1) / 2;
    var span = Math.max(x1 - x0, 0.12 * M.totalLength);
    var k = Math.min(this.kFit * 6, Math.max(this.kFit, (this.W * 0.55) / span));
    this.view.k = k; this.view.tx = this.W / 2 - cx * k; this.view.ty = this.H / 2 + (cid === 'suction' ? M.Rc * this.e * k : 0);
    this.view.user = true; this._applyView();
  };
  VP.scaleNote = function () {
    if (!this.M) return '';
    var z = this.zoomLevel();
    return { axial: 'Axial 1 : 1', radial: this.e > 1.001 ? 'Radial ×' + this.e.toFixed(2) + ' exaggerated' : 'Radial 1 : 1 (true scale)', zoom: Math.round(z * 100) + ' %', exaggerated: this.e > 1.001, e: this.e };
  };
  VP.destroy = function () { if (this.ro) this.ro.disconnect(); this.c.innerHTML = ''; this.ls = {}; };

  /* ---------------------------------------------------------------------------
   * Standalone export SVG (vector drawing with title block)
   * ------------------------------------------------------------------------- */
  function exportSVG(D, sys, o) {
    o = o || {};
    var M = D.model; if (!M) return null;
    var theme = o.theme || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    var P = PALETTES[theme], W = o.width || 1600, H = o.height || 760, titleH = o.titleBlock === false ? 0 : 74;
    var f = VJP.ui ? VJP.ui.F(sys) : { sys: sys };
    var e = o.exag === 1 ? 1 : autoExag(M);
    var svg = el('svg', { xmlns: SVGNS, viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'font-family': SANS });
    var id = 'x' + (++uid);
    el('rect', { width: W, height: H, fill: P.bg }, svg);
    defs(svg, P, id, 1);
    // frame
    el('rect', { x: 8, y: 8, width: W - 16, height: H - 16, fill: 'none', stroke: P.frame, 'stroke-width': 1.2 }, svg);
    var areaH = H - titleH - 16;
    var p = { l: 70, r: 70, t: o.labels === false ? 40 : 84, b: o.dims === false ? 50 : 136 };
    var L = M.totalLength, x0 = -0.03 * L, bw = L * 1.06, topB = M.top * e, botB = -M.bottom * e;
    var k = Math.min((W - p.l - p.r) / bw, (areaH - p.t - p.b) / (topB + botB));
    var tx = p.l + ((W - p.l - p.r) - bw * k) / 2 - x0 * k, ty = 8 + p.t + ((areaH - p.t - p.b) - (topB + botB) * k) / 2 + topB * k;
    var g = el('g', { transform: 'matrix(' + k + ' 0 0 ' + k + ' ' + r1(tx) + ' ' + r1(ty) + ')' }, svg);
    svg.querySelectorAll('pattern').forEach(function (pt) { var rot = pt.id.slice(-2) === 'hL' ? -45 : 45; pt.setAttribute('patternTransform', 'rotate(' + rot + ') scale(' + (1 / k) + ')'); });
    drawGeometry(g, M, e, P, id, { simplified: false });
    var a = el('g', null, svg);
    drawAnnotations(a, M, D, { sx: function (x) { return x * k + tx; }, sy: function (r) { return -r * e * k + ty; }, k: k }, P, f,
      { W: W, H: H - titleH, dims: o.dims !== false, labels: o.labels !== false, stations: !!o.stations, flowArrows: true, scaleBar: true });
    if (titleH) {
      var yT = H - titleH - 8, fs = Math.max(10, Math.min(14, W / 112)), fl = Math.max(9, fs * 0.76);
      el('line', { x1: 8, y1: yT, x2: W - 8, y2: yT, stroke: P.frame, 'stroke-width': 1.2 }, svg);
      var cols = [
        ['DRAWING', 'Parametric schematic'],
        ['PROJECT', (o.project || '')],
        ['REVISION', o.revision || ''],
        ['SCALE · DIMENSIONS IN ' + U.unitLabel('len_mm', sys).toUpperCase(), 'Axial 1:1 · ' + (e > 1.001 ? 'radial ×' + e.toFixed(2) + ' (exaggerated)' : 'radial 1:1')],
        ['DATE', o.date || '']
      ];
      var cw = [0.18, 0.28, 0.16, 0.26, 0.12], xx = 8;
      var fit = function (s, w, size) { var n = Math.floor((w - 22) / (size * 0.56)); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
      cols.forEach(function (cc, i) {
        var w = (W - 16) * cw[i];
        if (i) el('line', { x1: r1(xx), y1: yT, x2: r1(xx), y2: H - 26, stroke: P.frame, 'stroke-width': 1 }, svg);
        var t1 = el('text', { x: r1(xx + 11), y: r1(yT + 8 + fl * 1.3), 'font-size': fl, 'font-weight': 650, 'letter-spacing': '0.08em', fill: P.muted }, svg); t1.textContent = fit(cc[0], w, fl * 1.08);
        var t2 = el('text', { x: r1(xx + 11), y: r1(yT + 12 + fl * 1.3 + fs * 1.35), 'font-size': fs, 'font-weight': 600, fill: P.text }, svg); t2.textContent = fit(cc[1], w, fs);
        xx += w;
      });
      el('line', { x1: 8, y1: H - 26, x2: W - 8, y2: H - 26, stroke: P.frame, 'stroke-width': 1 }, svg);
      var note = 'Generated from the calculated design state (VENTURI_JET_PUMP_CALCULATOR_v4). Wall thickness, chamber envelope and flanges are display construction — not a fabrication drawing.';
      var t3 = el('text', { x: 19, y: H - 13, 'font-size': fl, fill: P.muted }, svg);
      t3.textContent = fit(note, W - 30, fl);
    }
    return svg;
  }
  function serialize(svg) { return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg); }
  function toPNG(svg, scale, cb) {
    var vb = svg.getAttribute('viewBox').split(/\s+/).map(Number), s = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = vb[2] * scale; c.height = vb[3] * scale;
      var cx = c.getContext('2d'); cx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { cb(b); }, 'image/png');
    };
    img.onerror = function () { cb(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  /* ---------------------------------------------------------------------------
   * Mini schematic (Design Summary, profile strip) — same model, outline only
   * ------------------------------------------------------------------------- */
  function mini(M, o) {
    o = o || {};
    var W = o.width || 320, H = o.height || 90, P = o.palette || livePalette();
    var L = M.totalLength, pad = o.pad === undefined ? 6 : o.pad;
    var e = o.exag || Math.max(1, Math.min(4, (H - 2 * pad) / (W - 2 * pad) * L / (M.top - M.bottom)));
    var k = Math.min((W - 2 * pad) / L, (H - 2 * pad) / ((M.top - M.bottom) * e));
    var tx = pad + ((W - 2 * pad) - L * k) / 2, ty = pad + ((H - 2 * pad) - (M.top - M.bottom) * e * k) / 2 + M.top * e * k;
    if (o.xMap) {
      // x aligned to an external axis (profile strip); radial scale fitted to the strip height
      k = o.xMap.k; tx = o.xMap.tx;
      e = Math.max(0.2, (H - 2 * pad) / ((M.top - M.bottom) * k));
      ty = H / 2 + (M.top + M.bottom) / 2 * e * k;
    }
    var svg = el('svg', { class: 'mini', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    var id = 'm' + (++uid);
    var g = el('g', { transform: 'matrix(' + k + ' 0 0 ' + k + ' ' + r1(tx) + ' ' + r1(ty) + ')' }, svg);
    el('path', { d: pathD(M.poly.fluid, e), fill: P.bore2, stroke: 'none' }, g);
    if (o.highlight && M.comp[o.highlight]) el('path', { d: pathD(M.comp[o.highlight].region, e), fill: P.brand, 'fill-opacity': 0.25, stroke: 'none' }, g);
    [M.poly.bodyAU, M.poly.bodyBU, M.poly.bodyL].forEach(function (pp) { el('path', { d: pathD(pp, e), fill: P.wall, stroke: P.line, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-opacity': 0.85 }, g); });
    [M.poly.lanceU, M.poly.lanceL].forEach(function (pp) { el('path', { d: pathD(pp, e), fill: P.lance || P.wall, stroke: P.line, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-opacity': 0.85 }, g); });
    el('line', { x1: 0, y1: 0, x2: r1(L), y2: 0, stroke: P.center, 'stroke-width': 0.8, 'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': '6 2 1 2' }, g);
    svg._map = { k: k, tx: tx, ty: ty, e: e };
    return svg;
  }

  root.VJP.schematic = {
    Viewer: Viewer, create: function (c, o) { return new Viewer(c, o); }, exportSVG: exportSVG, serialize: serialize, toPNG: toPNG,
    mini: mini, autoExag: autoExag, palettes: PALETTES, livePalette: livePalette, pathD: pathD
  };
})(typeof window !== 'undefined' ? window : this);
