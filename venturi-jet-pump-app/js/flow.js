/* CALCULATED FLOW VISUALIZATION (canvas layer of the schematic viewer)
 * -----------------------------------------------------------------------------
 * An engineering visualization of the calculated flow — NOT CFD. It does not
 * solve turbulence, multiphase physics or transient flow. What it does:
 *
 *   calculated local velocity ─► normalised by the calculated nozzle velocity
 *   ─► playback speed ─► particle motion along streamline lanes
 *
 *  · Lanes are built from the parametric model (js/geometry.js): motive lanes
 *    follow the nozzle bore then the spreading jet; suction lanes descend the
 *    branch, wrap the annulus, enter around the jet and mix toward uniform.
 *  · Local speeds come from the engine / anchored profile values: continuity
 *    Q_m/A and Q_d/A, the 1-D profile velocity in the mixing zone, v_s in the
 *    branch, Q_s over the annulus — with an assumed 1/7-power radial shape.
 *  · Particles advance in FLOW TIME, so apparent speed and trail length are
 *    proportional to the local calculated velocity. The user multiplier only
 *    scales playback.
 *  · Solids: size from d_p,max / d50, count from C_v, colour from SG_s, visual
 *    settling only when the engine's V/V_c < 1.2.
 *  · Deterministic (seeded) particles; state is kept across design changes so
 *    nothing jumps when inputs change.
 * ========================================================================== */
(function (root) {
  'use strict';
  var VJP = root.VJP, PI = Math.PI;

  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shape(a) { a = Math.min(Math.abs(a), 0.985); return 1.224 * Math.pow(1 - a, 1 / 7); }        // assumed turbulent profile
  function hA(z) { z = clamp(z, 0.001, 0.999); return Math.max(0.4, 1.2 * Math.pow(4 * z * (1 - z), 1 / 7)); } // annulus shape
  function area(rmm) { return PI * Math.pow(rmm / 1000, 2); }

  /* ---------------------------------------------------- velocity model */
  function makeModel(D) {
    var R = D.R, M = D.model, prof = D.prof, E = M.E, X = M.x;
    var Qm = R.motive.Qm_m3s, Qs = R.operating.Qs_m3s, Qd = R.operating.Qd_m3s, v_s = R.velocities.v_s;
    var END = Math.exp(-3);
    function mix(x) { if (x <= X.tip) return 0; if (x >= X.th1) return 1; var t = (x - X.tip) / (X.th1 - X.tip); return (1 - Math.exp(-3 * t)) / (1 - END); }
    function Rt(x) { return x < X.th0 ? E.d_th / 2 : M.bodyInner(x); }
    function rj(x) { if (x <= X.tip) return M.lanceInner(x); return E.d_n / 2 + (Rt(x) - E.d_n / 2) * mix(x); }
    function Vp(x) { return VJP.geometry.sampleAt(prof, x).V; }                        // anchored 1-D profile velocity
    function outerGap(x) { return x < X.th0 ? M.bodyInner(x) : E.d_th / 2; }
    function vEntry(x) {                                                                  // entrained stream between jet and wall
      var o = outerGap(x), i = rj(x), A = area(o) - area(i);
      return Math.min(Vp(x), A > 1e-9 ? Qs / A : Vp(x));
    }
    function vAnn(x) { var A = area(M.bodyInner(x)) - area(M.lanceOuter(x)); return A > 1e-9 ? Qs / A : v_s; }
    // Column-wise field evaluation for the heat-map: everything that depends only on x is
    // computed once per column; fieldAt(col, r) is cheap. Returns null outside the wetted domain.
    function fieldCol(x) {
      var c = { x: x, zone: x <= X.tip ? 0 : x <= X.th1 ? 1 : 2 };
      c.branch = x >= M.branch.x0 && x <= M.branch.x1;
      if (c.zone === 0) { c.li = M.lanceInner(x); c.vm = Qm / area(c.li); if (x >= X.cbi) { c.lo = M.lanceOuter(x); c.ri = M.bodyInner(x); c.va = vAnn(x); } }
      else if (c.zone === 1) { c.o = outerGap(x); c.m = mix(x); c.j = rj(x); c.core = Vp(x); c.ve = vEntry(x); c.rt = Rt(x); }
      else { c.R2 = M.bodyInner(x); c.vd = Qd / area(c.R2); }
      return c;
    }
    function fieldAt(c, r) {
      var a = Math.abs(r);
      if (r > 0 && c.branch && a >= M.Rc) return a <= M.branch.top ? v_s * shape((c.x - M.branch.x) / M.branch.rS) : null;
      if (c.zone === 0) {
        if (a <= c.li) return c.vm * shape(a / c.li);
        if (c.lo !== undefined && a >= c.lo && a <= c.ri) return c.va * hA((a - c.lo) / (c.ri - c.lo));
        return null;
      }
      if (c.zone === 1) {
        if (a > c.o) return null;
        // jet core and entrained stream blended across a soft shear layer (visual smoothing, not a turbulence model)
        var w = 1 / (1 + Math.exp((a - c.j) / Math.max(1e-6, 0.16 * c.j)));
        var vj = c.core * (1.1 - 0.45 * Math.min(1, (a / c.j) * (a / c.j)));
        var vEn = c.ve * hA((a - c.j) / Math.max(1e-6, c.o - c.j));
        var v0 = w * vj + (1 - w) * vEn;
        return v0 * (1 - c.m) + c.m * c.core * shape(a / c.rt);
      }
      if (a > c.R2) return null;
      return c.vd * shape(a / c.R2);
    }
    function field(x, r) { return fieldAt(fieldCol(x), r); }
    return { R: R, M: M, E: E, X: X, mix: mix, Rt: Rt, rj: rj, Vp: Vp, vEntry: vEntry, vAnn: vAnn, field: field, fieldCol: fieldCol, fieldAt: fieldAt, outerGap: outerGap, v_s: v_s, Qd: Qd, Qm: Qm };
  }

  // lane = { x[], r[], v[], t[] (cumulative flow time, s), a[] (alpha) , T }
  function finish(pts) {
    var n = pts.length, x = new Float32Array(n), r = new Float32Array(n), v = new Float32Array(n), t = new Float64Array(n), a = new Float32Array(n);
    for (var i = 0; i < n; i++) { x[i] = pts[i][0]; r[i] = pts[i][1]; v[i] = Math.max(0.05, pts[i][2]); a[i] = pts[i][3] === undefined ? 1 : pts[i][3]; }
    for (var j = 1; j < n; j++) { var ds = Math.hypot(x[j] - x[j - 1], r[j] - r[j - 1]); t[j] = t[j - 1] + ds / (0.5 * (v[j] + v[j - 1]) * 1000); }
    return { x: x, r: r, v: v, t: t, a: a, T: t[n - 1] };
  }
  function xSamples(M) {
    var X = M.x, L = M.totalLength, xs = [], i;
    for (i = 0; i <= 150; i++) xs.push(L * i / 150);
    for (i = 0; i <= 36; i++) xs.push(X.n0 + (X.tip - X.n0) * i / 36);
    for (i = 0; i <= 40; i++) xs.push(X.tip + (X.th0 + 0.35 * (X.th1 - X.th0) - X.tip) * i / 40);
    for (i = 0; i <= 16; i++) xs.push(X.th1 + (X.d1 - X.th1) * i / 16);
    xs.sort(function (a, b) { return a - b; });
    return xs.filter(function (x, k) { return k === 0 || x - xs[k - 1] > 0.05; });
  }
  function buildLanes(F) {
    var M = F.M, X = F.X, E = F.E, xs = xSamples(M), lanes = { motive: [], sucU: [], sucL: [] };
    var NM = 34, NS = 14, NL = 11, i;
    for (i = 0; i < NM; i++) {
      var xi = ((i + 0.5) / NM) * 2 - 1, pts = [];
      xs.forEach(function (x) {
        var Rm = x <= X.tip ? M.lanceInner(x) : F.rj(x), v;
        if (x <= X.tip) v = F.Qm / area(M.lanceInner(x)) * shape(xi);
        else if (x <= X.th1) { var m = F.mix(x); v = F.Vp(x) * ((1 - m) * (1.1 - 0.45 * xi * xi) + m * shape(xi)); }
        else v = F.Qd / area(M.bodyInner(x)) * shape(xi);
        pts.push([x, xi * Rm * 0.97, v, x > M.totalLength * 0.985 ? (M.totalLength - x) / (M.totalLength * 0.015) : 1]);
      });
      lanes.motive.push(finish(pts));
    }
    function sucTail(zeta, xf, x0, sign) {
      var out = [];
      xs.forEach(function (x) {
        if (x < x0) return;
        var r, v;
        if (x <= X.tip) { var lo = M.lanceOuter(x), ri = M.bodyInner(x); r = lo + zeta * (ri - lo); v = F.vAnn(x) * hA(zeta); }
        else if (x < X.th1) {
          var m = F.mix(x), inner = F.rj(x), outer = F.outerGap(x);
          var rAnn = inner + zeta * (outer - inner), rMix = xf * F.Rt(x);
          r = (1 - m) * rAnn + m * rMix;
          v = (1 - m) * F.vEntry(x) * hA(zeta) + m * F.Vp(x) * shape(xf);
        } else { r = xf * M.bodyInner(x); v = F.Qd / area(M.bodyInner(x)) * shape(xf); }
        out.push([x, sign * r, v, x > M.totalLength * 0.985 ? (M.totalLength - x) / (M.totalLength * 0.015) : 1]);
      });
      return out;
    }
    var rr = rng(7331);
    for (i = 0; i < NS; i++) {
      var eta = (i + 0.5) / NS, zeta = 0.1 + 0.8 * eta, xf = 0.12 + 0.82 * rr();
      var xl = M.branch.x + (2 * eta - 1) * 0.84 * M.branch.rS;
      var pts2 = [], top = M.branch.top, r1 = M.Rc + (0.25 + 0.45 * eta) * M.branch.rS;
      var vB = F.v_s * shape(2 * eta - 1);
      for (var k = 0; k <= 12; k++) { var rk = top - (top - r1) * k / 12; pts2.push([xl, rk, vB]); }
      var x2 = Math.min(M.x.e0 - 1, xl + (0.55 + 0.95 * (1 - eta)) * M.branch.rS);
      var lo2 = M.lanceOuter(x2), r2 = lo2 + zeta * (M.bodyInner(x2) - lo2), v2 = F.vAnn(x2) * hA(zeta);
      for (var q = 1; q <= 12; q++) {                                    // quadratic turn into the annulus
        var s = q / 12, u = 1 - s;
        var bx = u * u * xl + 2 * u * s * xl + s * s * x2, by = u * u * r1 + 2 * u * s * r2 + s * s * r2;
        pts2.push([bx, by, vB + (v2 - vB) * s]);
      }
      lanes.sucU.push(finish(pts2.concat(sucTail(zeta, xf, x2 + 0.5, 1))));
    }
    for (i = 0; i < NL; i++) {
      var eta2 = (i + 0.5) / NL, z2 = 0.1 + 0.8 * rr(), xf2 = 0.12 + 0.82 * rr();
      var xs0 = M.branch.x - 0.5 * M.branch.rS + 1.1 * M.branch.rS * eta2;
      var tail = sucTail(z2, xf2, xs0, -1);
      for (var w = 0; w < tail.length; w++) { var fr = (tail[w][0] - xs0) / (0.9 * M.branch.rS); if (fr < 1) tail[w][3] = Math.max(0, fr); }
      lanes.sucL.push(finish(tail));
    }
    return lanes;
  }
  function posAt(L, tau, out) {
    var t = L.t, n = t.length;
    if (tau <= 0) { out.x = L.x[0]; out.r = L.r[0]; out.v = L.v[0]; out.a = L.a[0]; return out; }
    if (tau >= L.T) { out.x = L.x[n - 1]; out.r = L.r[n - 1]; out.v = L.v[n - 1]; out.a = 0; return out; }
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (t[mid] <= tau) lo = mid; else hi = mid; }
    var f = (tau - t[lo]) / (t[hi] - t[lo] || 1);
    out.x = L.x[lo] + (L.x[hi] - L.x[lo]) * f; out.r = L.r[lo] + (L.r[hi] - L.r[lo]) * f;
    out.v = L.v[lo] + (L.v[hi] - L.v[lo]) * f; out.a = L.a[lo] + (L.a[hi] - L.a[lo]) * f;
    return out;
  }

  /* ------------------------------------------------------------ system */
  function Flow(viewer, opts) {
    this.vw = viewer; this.opts = opts || {};
    this.cfg = { motive: true, particles: true, field: true, arrows: true, speed: 1 };
    for (var k in (this.opts.cfg || {})) this.cfg[k] = this.opts.cfg[k];
    this.playing = false; this.reduced = false;
    this.ctx = viewer.canvas.getContext('2d');
    var R = rng(20260925);                    // fixed seed → stable across re-renders
    function pool(n, extra) { var a = []; for (var i = 0; i < n; i++) { var p = { lane: R(), ph: R(), seed: R() * 1000, j: R() }; if (extra) extra(p); a.push(p); } return a; }
    this.pm = pool(560);
    this.ps = pool(200);
    this.pd = pool(440, function (p) { var z = Math.sqrt(-2 * Math.log(Math.max(1e-6, R()))) * Math.cos(2 * PI * R()); p.z = z; p.shade = R(); p.slip = R(); });
    this.tmp = { x: 0, r: 0, v: 0, a: 1 }; this.tmp2 = { x: 0, r: 0, v: 0, a: 1 };
    this.t = 0; this.last = 0;
    var self = this;
    this._frame = function (ts) { self._tick(ts); };
    this._vis = function () { if (document.hidden) self._pauseLoop(); else if (self.playing) self._startLoop(); };
    document.addEventListener('visibilitychange', this._vis);
    viewer.on('view', function () { if (!self.playing && self.active) self.render(); });
  }
  var FP = Flow.prototype;

  FP.setDesign = function (D) {
    if (!D || !D.model || !D.prof) { this.F = null; this.lanes = null; return; }
    this.D = D; this.F = makeModel(D); this.lanes = buildLanes(this.F);
    var R = D.R, L = D.model.totalLength;
    this.vref = R.nozzle.v_n;                                       // reference: calculated nozzle exit velocity
    this.Tref = 0.9;                                                 // s of playback for a v_ref particle to cross the pump
    this.rho = (L / (this.vref * 1000)) / this.Tref;                 // flow-seconds per playback-second
    this.dmax = R.inputs.d_p_max; this.d50 = R.slurry.d50;
    this.nSolids = Math.round(clamp(R.slurry.Cv * 2400, 36, this.pd.length));
    this.settle = R.settling.V_over_Vc < 1.2 ? (1.2 - R.settling.V_over_Vc) / 1.2 : 0;
    this.solidColor = solidColour(R.inputs.SG_s);
    this._coarse = null; this._coarseKey = null; this._fine = null; this._fineKey = null; this._finePending = null; this._sprites = {};
  };
  FP.info = function () {
    if (!this.F) return null;
    return { vref: this.vref, rho: this.rho * this.cfg.speed, playback: 1 / (this.rho * this.cfg.speed), nSolids: this.nSolids, settle: this.settle, dmax: this.dmax, d50: this.d50 };
  };
  FP.set = function (patch) { for (var k in patch) this.cfg[k] = patch[k]; if (!this.playing) this.render(); };
  FP.activate = function (on) { this.active = on; this.vw.canvas.style.display = on ? 'block' : 'none'; if (!on) this.stop(); else this.render(); };
  FP.play = function () { if (this.reduced || !this.F) { this.render(); return; } this.playing = true; this._startLoop(); };
  FP.stop = function () { this.playing = false; this._pauseLoop(); };
  FP.reset = function () { this.t = 0; this.render(); };
  FP.setReduced = function (r) { this.reduced = r; if (r) this.stop(); this.render(); };
  FP._startLoop = function () { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this._frame); } };
  FP._pauseLoop = function () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; };
  FP._tick = function (ts) {
    this.raf = null;
    if (!this.playing) return;
    var dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0;
    this.last = ts;
    this.t += dt;
    this.render();
    this.raf = requestAnimationFrame(this._frame);
  };
  FP.destroy = function () { this.stop(); document.removeEventListener('visibilitychange', this._vis); };

  function solidColour(sg) {
    if (sg <= 1.9) return [184, 146, 98];      // clayey / light soil
    if (sg <= 2.4) return [153, 104, 58];      // sand / silt
    if (sg <= 2.8) return [122, 82, 48];       // quartz sand, gravel
    return [104, 92, 84];                      // dense rock
  }
  FP._sprite = function (rpx, shade) {
    var key = Math.round(rpx * 2) + ':' + Math.round(shade * 4);
    if (this._sprites[key]) return this._sprites[key];
    var s = Math.ceil(rpx * 2 + 2), c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'), col = this.solidColor, k = 0.82 + 0.36 * (Math.round(shade * 4) / 4);
    var base = 'rgb(' + col.map(function (v) { return Math.round(clamp(v * k, 0, 255)); }).join(',') + ')';
    var hi = 'rgb(' + col.map(function (v) { return Math.round(clamp(v * k * 1.35 + 30, 0, 255)); }).join(',') + ')';
    var lo = 'rgb(' + col.map(function (v) { return Math.round(v * k * 0.55); }).join(',') + ')';
    var grd = g.createRadialGradient(s / 2 - rpx * 0.35, s / 2 - rpx * 0.4, rpx * 0.1, s / 2, s / 2, rpx);
    grd.addColorStop(0, hi); grd.addColorStop(0.55, base); grd.addColorStop(1, lo);
    g.fillStyle = grd; g.beginPath(); g.arc(s / 2, s / 2, rpx, 0, 2 * PI); g.fill();
    this._sprites[key] = c;
    return c;
  };

  // heat-map of |V| over the world box [x0,x1]×[rb,rt] → canvas + its box in base coordinates
  FP._paintField = function (x0, x1, rt, rb, gw, gh) {
    var e = this.vw.e, c = document.createElement('canvas'); c.width = gw; c.height = gh;
    var g = c.getContext('2d'), img = g.createImageData(gw, gh), dat = img.data, vref = this.vref, F = this.F;
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var ramp = light ? [[241, 245, 249], [191, 219, 254], [96, 165, 250], [29, 78, 216]] : [[11, 23, 40], [21, 61, 110], [45, 120, 200], [150, 205, 255]];
    var alpha = light ? 200 : 235;
    for (var i = 0; i < gw; i++) {
      var col = F.fieldCol(x0 + (x1 - x0) * (i + 0.5) / gw);
      for (var j = 0; j < gh; j++) {
        var v = F.fieldAt(col, rt - (rt - rb) * (j + 0.5) / gh), o = (j * gw + i) * 4;
        if (v === null || !(v === v)) { dat[o + 3] = 0; continue; }
        var tt = clamp(Math.sqrt(v / vref), 0, 1) * 3, seg = Math.min(2, Math.floor(tt)), f = tt - seg;
        var A = ramp[seg], B = ramp[seg + 1];
        dat[o] = A[0] + (B[0] - A[0]) * f; dat[o + 1] = A[1] + (B[1] - A[1]) * f; dat[o + 2] = A[2] + (B[2] - A[2]) * f; dat[o + 3] = alpha;
      }
    }
    g.putImageData(img, 0, 0);
    return { img: c, box: { x: x0, y: -rt * e, w: x1 - x0, h: (rt - rb) * e } };
  };
  // coarse layer: whole model (rebuilt when the design / exaggeration changes)
  FP._coarseField = function () {
    var M = this.F.M, e = this.vw.e, key = e.toFixed(3);
    if (this._coarse && this._coarseKey === key) return this._coarse;
    var gw = 900, gh = Math.round(clamp(gw * (M.top - M.bottom) * e / M.totalLength, 60, 360));
    this._coarse = this._paintField(0, M.totalLength, M.top, M.bottom, gw, gh);
    this._coarseKey = key; this._fine = null; this._fineKey = null;
    return this._coarse;
  };
  // fine layer: the visible region at ~1.5 px per cell, recomputed (debounced) after zoom / pan
  FP._fineField = function () {
    var vw = this.vw, v = vw.view, M = this.F.M;
    if (!vw.zoomLevel || vw.zoomLevel() < 1.25) return null;
    var key = [v.k.toFixed(4), Math.round(v.tx), Math.round(v.ty), vw.e.toFixed(3), vw.W, vw.H].join(',');
    if (key !== this._fineKey && key !== this._finePending) {
      var self = this;
      this._finePending = key;
      clearTimeout(this._fineT);
      this._fineT = setTimeout(function () {
        if (!self.F || self._finePending !== key) return;
        var a = vw.toWorld(0, 0), b = vw.toWorld(vw.W, vw.H);
        var x0 = clamp(Math.min(a.x, b.x), 0, M.totalLength), x1 = clamp(Math.max(a.x, b.x), 0, M.totalLength);
        var rt = clamp(Math.max(a.r, b.r), M.bottom, M.top), rb = clamp(Math.min(a.r, b.r), M.bottom, M.top);
        if (x1 - x0 < 1 || rt - rb < 1) return;
        var pxW = (x1 - x0) * v.k, pxH = (rt - rb) * vw.e * v.k;
        var gw = Math.round(clamp(pxW / 1.5, 40, 1100)), gh = Math.round(clamp(pxH / 1.5, 20, 640));
        self._fine = self._paintField(x0, x1, rt, rb, gw, gh);
        self._fineKey = key; self._finePending = null;
        if (!self.playing) self.render();
      }, 140);
    }
    return this._fine;
  };

  FP.render = function () {
    var vw = this.vw, ctx = this.ctx, F = this.F;
    if (!ctx || !vw.W) return;
    var dpr = vw.dpr || 1, W = vw.W, H = vw.H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!F || !this.active || !vw.M) return;
    var v = vw.view, e = vw.e, M = F.M;
    // clip to the wetted domain
    if (!this._clipKey || this._clipKey !== e + ':' + M.totalLength) { this._clip = new Path2D(VJP.schematic.pathD(M.poly.fluid, e)); this._clipKey = e + ':' + M.totalLength; }
    ctx.save();
    ctx.setTransform(v.k * dpr, 0, 0, v.k * dpr, v.tx * dpr, v.ty * dpr);
    ctx.clip(this._clip);
    if (this.cfg.field) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = 0.9;
      var co = this._coarseField();
      ctx.drawImage(co.img, co.box.x, co.box.y, co.box.w, co.box.h);
      var fi = this._fineField();
      if (fi) ctx.drawImage(fi.img, fi.box.x, fi.box.y, fi.box.w, fi.box.h);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var tFlow = this.t * this.rho * this.cfg.speed;          // elapsed FLOW time (s)
    var trail = 0.06 * this.rho * this.cfg.speed;             // trail = 60 ms of playback → length ∝ velocity
    var pA = this.tmp, pB = this.tmp2, self = this;
    var sx = function (x) { return x * v.k + v.tx; }, sy = function (r) { return -r * e * v.k + v.ty; };
    var zoomLOD = clamp(vw.zoomLevel ? vw.zoomLevel() : 1, 0.5, 4);
    function streaks(list, lanes, frac, colTail, colHead, wT, wH, jitterAmp) {
      var n = Math.floor(list.length * frac);
      var tails = new Path2D(), heads = new Path2D();
      for (var i = 0; i < n; i++) {
        var p = list[i], L = lanes[Math.floor(p.lane * lanes.length) % lanes.length];
        var tau = ((p.ph * L.T + tFlow) % L.T + L.T) % L.T;
        posAt(L, tau, pA); if (pA.a <= 0.02) continue;
        posAt(L, Math.max(0, tau - trail), pB);
        var jit = jitterAmp ? jitterAmp * turb(F, pA.x) * Math.sin(self.t * (2.1 + p.j * 3) + p.seed) : 0;
        var x1 = sx(pA.x), y1 = sy(pA.r + jit), x0 = sx(pB.x), y0 = sy(pB.r + jit);
        if (x1 < -20 || x1 > W + 20 || y1 < -20 || y1 > H + 20) continue;
        if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 1.2) { x0 = x1 - 1.2; }
        tails.moveTo(x0, y0); tails.lineTo(x1, y1);
        var hx = x0 + (x1 - x0) * 0.62, hy = y0 + (y1 - y0) * 0.62;
        heads.moveTo(hx, hy); heads.lineTo(x1, y1);
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = colTail; ctx.lineWidth = wT; ctx.stroke(tails);
      ctx.strokeStyle = colHead; ctx.lineWidth = wH; ctx.stroke(heads);
    }
    var lanes = this.lanes;
    if (this.cfg.motive) {
      var mc = light ? ['rgba(2,132,199,0.28)', 'rgba(3,105,161,0.85)'] : ['rgba(56,189,248,0.30)', 'rgba(210,240,255,0.92)'];
      streaks(this.pm, lanes.motive, clamp(0.55 + 0.25 * zoomLOD, 0.6, 1), mc[0], mc[1], 2.4, 1.5, 0.018);
    }
    if (this.cfg.particles) {
      var sc = light ? ['rgba(146,100,40,0.22)', 'rgba(120,80,30,0.7)'] : ['rgba(212,178,120,0.22)', 'rgba(232,206,160,0.72)'];
      var both = lanes.sucU.concat(lanes.sucL);
      streaks(this.ps, both, 1, sc[0], sc[1], 2.0, 1.3, 0.03);
      // solids — lag the carrier (slip) and show gravity settling only when V/Vc < 1.2
      var n = this.nSolids, k = v.k, dmax = this.dmax;
      for (var i = 0; i < n; i++) {
        var p = this.pd[i], L = both[Math.floor(p.lane * both.length) % both.length];
        var slip = 0.04 + 0.12 * p.slip;
        var tau = ((p.ph * L.T + tFlow * (1 - slip)) % L.T + L.T) % L.T;
        posAt(L, tau, pA); if (pA.a <= 0.05) continue;
        var dmm = clamp(this.d50 * Math.exp(0.42 * p.z), 0.08 * dmax, dmax);
        var rr = pA.r;
        if (this.settle > 0 && pA.x > M.x.d1) { var fr = (pA.x - M.x.d1) / (M.totalLength - M.x.d1); rr -= fr * this.settle * 0.8 * M.bodyInner(pA.x) * (0.5 + 0.5 * p.slip); rr = Math.max(rr, -M.bodyInner(pA.x) * 0.92); }
        rr += 0.02 * turb(F, pA.x) * M.bodyInner(pA.x) * Math.sin(this.t * (1.7 + p.j * 2) + p.seed);
        var x = sx(pA.x), y = sy(rr);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        var rpx = clamp(dmm / 2 * k, 0.9, 11);
        var spr = this._sprite(rpx, p.shade);
        ctx.globalAlpha = pA.a;
        ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
      }
      ctx.globalAlpha = 1;
    }
    if (this.cfg.arrows) {
      // chevrons marching along the axis at the local calculated velocity
      var Lm = lanes.motive[Math.floor(lanes.motive.length / 2)];
      ctx.strokeStyle = light ? 'rgba(15,23,42,0.45)' : 'rgba(244,247,251,0.55)'; ctx.lineWidth = 1.6;
      var nArrows = 9;
      for (var q = 0; q < nArrows; q++) {
        var tq = ((q / nArrows) * Lm.T + tFlow * 0.5) % Lm.T;
        posAt(Lm, tq, pA);
        var ax = sx(pA.x), ay = sy(0);
        ctx.beginPath(); ctx.moveTo(ax - 5, ay - 5); ctx.lineTo(ax, ay); ctx.lineTo(ax - 5, ay + 5); ctx.stroke();
      }
    }
    ctx.restore();
  };
  // visual turbulence intensity (peaks in the mixing zone) — cosmetic only, not a turbulence model
  function turb(F, x) { var m = F.mix(x); return 0.25 + 3.2 * m * (1 - m); }

  root.VJP.flow = { create: function (viewer, opts) { return new Flow(viewer, opts); }, makeModel: makeModel };
})(typeof window !== 'undefined' ? window : this);
