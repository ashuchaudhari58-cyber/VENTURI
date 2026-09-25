/* PARAMETRIC GEOMETRY MODEL + 1-D HYDRAULIC PROFILES
 * -----------------------------------------------------------------------------
 *   ENGINEERING DIMENSIONS   (engine results — the only source of sizes)
 *            ↓
 *   PARAMETRIC GEOMETRY      (this module: axial layout, wall profiles,
 *                             components, stations, dimension anchors)
 *            ↓
 *   VIEWPORT / SVG           (js/schematic.js — display scale only)
 *            ↓
 *   FLOW VISUALIZATION       (js/flow.js — consumes the same model)
 *
 * Coordinates: x = axial position (mm) from the motive inlet flange face,
 * r = radius (mm), + upwards (the suction branch is on the + side).
 *
 * Calculated dimensions (D_n,in, d_n,sel, L_n, s, d_th, L_th, L_d, d_diff,
 * D_s, D_d) are used exactly. Everything the engine does not size — wall
 * thickness, the suction-chamber envelope, the throat-entry cone, stubs,
 * flanges, the outlet reducer — is DISPLAY CONSTRUCTION defined by the
 * proportional RULES below (never presented as a calculated dimension).
 * The chamber envelope is sized so the annulus around the motive lance has
 * twice the suction-pipe flow area — it is not dimensioned on the drawing.
 *
 * The 1-D profiles (pressure, velocity, EGL/HGL, Re along the axis) are the
 * physics-based reconstruction of the previous release (continuity +
 * Bernoulli + momentum), ANCHORED to the engine's Bernoulli station values.
 * They are not CFD.
 * ========================================================================== */
(function (root) {
  'use strict';
  var PI = Math.PI, G = 9.81;
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function rad(d) { return d * PI / 180; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // DISPLAY CONSTRUCTION RULES (dimensionless, proportional to calculated sizes)
  var RULES = {
    wall: 0.06,          // wall thickness            = 0.06 × largest bore
    tipWall: 0.5,        // nozzle tip wall           = 0.5 × wall ...
    tipClear: 0.45,      //   ... limited to 0.45 × radial clearance nozzle→throat
    entryAngle: 30,      // throat-entry cone half-angle (°)
    chamberArea: 2.0,    // chamber annulus area      = 2 × suction pipe area (low chamber velocity)
    branchMargin: 0.25,  // chamber straight length   = D_s + 2·wall + 2·0.25·D_s
    stubIn: 0.5,         // motive inlet stub         = 0.5 × D_n,in
    stubOut: 0.55,       // discharge stub            = 0.55 × D_d
    branchH: 0.9,        // suction branch height     = 0.9 × D_s above the chamber
    reducerAngle: 15,    // outlet reducer half-angle (°) when d_diff ≠ D_d
    flangeW: 0.3,        // flange radial projection  = 0.3 × pipe ID
    flangeT: 0.12        // flange thickness          = 0.12 × pipe ID
  };

  var COMPONENTS = [
    { id: 'motive',    no: 1, name: 'Motive inlet',   short: 'Motive' },
    { id: 'nozzle',    no: 2, name: 'Nozzle',         short: 'Nozzle' },
    { id: 'suction',   no: 3, name: 'Suction inlet',  short: 'Suction', offAxis: true },
    { id: 'chamber',   no: 4, name: 'Mixing chamber', short: 'Mixing' },
    { id: 'throat',    no: 5, name: 'Throat',         short: 'Throat' },
    { id: 'diffuser',  no: 6, name: 'Diffuser',       short: 'Diffuser' },
    { id: 'discharge', no: 7, name: 'Discharge',      short: 'Discharge' }
  ];
  var COMP_BY_ID = {}; COMPONENTS.forEach(function (c) { COMP_BY_ID[c.id] = c; });

  /* Quadratic-Bézier fillets on a polyline, sampled to points so that every
   * polygon sharing the boundary uses identical vertices. deltas[i] = cut
   * length at vertex i (0 = sharp). */
  function fillet(pts, deltas, samples) {
    samples = samples || 7;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var d = deltas ? deltas[i] || 0 : 0;
      if (d <= 0 || i === 0 || i === pts.length - 1) { out.push(pts[i]); continue; }
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      if (la < 1e-9 || lb < 1e-9) { out.push(p); continue; }
      var dd = Math.min(d, 0.45 * la, 0.45 * lb);
      var p1 = [p[0] + (a[0] - p[0]) / la * dd, p[1] + (a[1] - p[1]) / la * dd];
      var p2 = [p[0] + (b[0] - p[0]) / lb * dd, p[1] + (b[1] - p[1]) / lb * dd];
      for (var k = 0; k <= samples; k++) {
        var t = k / samples, u = 1 - t;
        out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]);
      }
    }
    return out;
  }
  function mirror(pts) { return pts.map(function (p) { return [p[0], -p[1]]; }); }

  /* ---------------------------------------------------------------------------
   * buildModel(R) — parametric geometry from the engine results. Returns null
   * when the calculated geometry is not buildable (see validation blockers).
   * ------------------------------------------------------------------------- */
  function buildModel(R) {
    var E = {
      D_in: R.nozzle.D_n_in, d_n: R.nozzle.d_n_sel, L_n: R.nozzle.L_n, alpha_n: R.inputs.alpha_n,
      s: R.nozzle.gap_s, d_th: R.throat.d_th, L_th: R.throat.L_th,
      L_d: R.diffuser.L_d, d_diff: R.diffuser.d_diff, alpha_d: R.inputs.alpha_d,
      D_s: R.inputs.suctionID, D_d: R.inputs.dischargeID
    };
    for (var k in E) if (!fin(E[k])) return null;
    if (!(E.L_n > 0 && E.d_th > E.d_n && E.D_in > E.d_n && E.s > 0 && E.L_th > 0 && E.L_d > 0 &&
          E.d_diff >= E.d_th && E.D_s > 0 && E.D_d > 0)) return null;

    // ---- display construction (proportional) ----
    var dref = Math.max(E.D_in, E.d_th, E.D_s, E.D_d, E.d_diff);
    var t = RULES.wall * dref;
    var tTip = Math.min(RULES.tipWall * t, RULES.tipClear * (E.d_th - E.d_n) / 2);
    var rLance = E.D_in / 2 + t;                                   // motive lance outer radius
    var Rc = Math.max(Math.sqrt(rLance * rLance + RULES.chamberArea * E.D_s * E.D_s / 4), E.d_th / 2 + t, 0.55 * E.D_s);
    var Le = (Rc - E.d_th / 2) / Math.tan(rad(RULES.entryAngle));  // throat-entry cone length
    var needStraight = E.D_s * (1 + 2 * RULES.branchMargin) + 2 * t;
    var backT = t;
    var stubIn = RULES.stubIn * E.D_in;

    // axial layout, first relative to the nozzle inlet (x_n0 = 0) then shifted.
    // The chamber must fit the branch (needStraight) AND enclose the nozzle tip.
    var n0 = 0, tip = E.L_n, th0 = tip + E.s, e0 = th0 - Le;
    var protrude = Math.min(E.L_n, Math.max(0.3 * E.L_n, 0.5 * E.D_s));
    var cbi = Math.min(e0 - needStraight, tip - protrude), cb = cbi - backT;
    var f0 = Math.min(cb, n0) - stubIn;                             // flange face
    var sh = -f0;                                                   // shift so flange face is x = 0
    var X = {
      flange: 0, cb: cb + sh, cbi: cbi + sh, n0: n0 + sh, tip: tip + sh, th0: th0 + sh, e0: e0 + sh
    };
    X.th1 = X.th0 + E.L_th;
    X.d1 = X.th1 + E.L_d;
    var mism = Math.abs(E.d_diff - E.D_d);
    var redL = mism > 0.005 * E.D_d ? (mism / 2) / Math.tan(rad(RULES.reducerAngle)) : 0;
    X.r1 = X.d1 + redL;
    X.end = X.r1 + RULES.stubOut * E.D_d;
    X.b = (X.cbi + X.e0) / 2;                                        // suction branch centreline
    var Hb = RULES.branchH * E.D_s;
    var yTop = Rc + t + Hb;
    var fIn = { T: RULES.flangeT * E.D_in, W: RULES.flangeW * E.D_in };
    var fOut = { T: RULES.flangeT * E.D_d, W: RULES.flangeW * E.D_d };
    var fS = { T: RULES.flangeT * E.D_s, W: RULES.flangeW * E.D_s };

    // ---- radius functions (piecewise linear, no fillets) ----
    function lanceInner(x) {                  // motive bore / nozzle bore
      if (x <= X.n0) return E.D_in / 2;
      if (x >= X.tip) return E.d_n / 2;
      return E.D_in / 2 - (x - X.n0) * (E.D_in - E.d_n) / (2 * E.L_n);
    }
    function lanceOuter(x) {                  // tapered nozzle wall: t at inlet → tTip at the tip
      if (x <= X.n0) return rLance;
      if (x >= X.tip) return E.d_n / 2 + tTip;
      var u = (x - X.n0) / E.L_n;
      return lanceInner(x) + t + (tTip - t) * u;
    }
    function bodyInner(x) {                   // chamber / throat / diffuser / outlet bore (x ≥ cbi)
      if (x <= X.e0) return Rc;
      if (x <= X.th0) return Rc + (E.d_th / 2 - Rc) * (x - X.e0) / Le;
      if (x <= X.th1) return E.d_th / 2;
      if (x <= X.d1) return E.d_th / 2 + (E.d_diff - E.d_th) / 2 * (x - X.th1) / E.L_d;
      if (x <= X.r1 && redL > 0) return E.d_diff / 2 + (E.D_d - E.d_diff) / 2 * (x - X.d1) / redL;
      return redL > 0 ? E.D_d / 2 : E.d_diff / 2;
    }
    // fluid envelope (outermost wetted radius) — what the flow visualization is bounded by
    function wallRadius(x) { return x < X.cbi ? lanceInner(x) : bodyInner(x); }
    // 1-D hydraulic path radius — reproduces the previous model: nozzle bore up to the
    // nozzle exit, throat bore through the gap and throat, then diffuser / outlet bore
    function pathRadius(x) {
      if (x <= X.tip) return lanceInner(x);
      if (x <= X.th1) return E.d_th / 2;
      return bodyInner(x);
    }

    // ---- wall polylines (world mm), fillets sampled once and shared ----
    var dE = 0.25 * Math.min(needStraight, Le), dT = 0.25 * Math.min(Le, E.L_th);
    var dD = 0.2 * Math.min(E.L_th, E.L_d), dR = redL > 0 ? 0.3 * redL : 0;
    var xbL = X.b - E.D_s / 2, xbR = X.b + E.D_s / 2;
    // inner profile of the body, from the branch (downstream wall) to the outlet;
    // the outer profile starts at the branch outer wall so fillets never notch it
    var tail = [[X.th0, E.d_th / 2], [X.th1, E.d_th / 2], [X.d1, E.d_diff / 2]];
    var tailDel = [dT, dD, dR];
    if (redL > 0) { tail.push([X.r1, E.D_d / 2]); tailDel.push(dR); }
    tail.push([X.end, bodyInner(X.end)]); tailDel.push(0);
    var inner = fillet([[xbR, Rc], [X.e0, Rc]].concat(tail), [0, dE].concat(tailDel));
    var outer = fillet([[xbR + t, Rc + t], [X.e0, Rc + t]].concat(tail.map(function (p) { return [p[0], p[1] + t]; })),
      [0, dE * 0.8].concat(tailDel.map(function (d) { return d * 0.8; })));

    // motive lance (inner & outer), with a fillet at the cone start
    var runL = X.n0 - 0;
    var dN = 0.2 * Math.min(E.L_n, Math.max(runL, 1e-6));
    var lanceIn = fillet([[0, E.D_in / 2], [X.n0, E.D_in / 2], [X.tip, E.d_n / 2]], [0, dN, 0]);
    var lanceOut = fillet([[0, rLance], [X.n0, rLance], [X.tip, E.d_n / 2 + tTip]], [0, dN * 0.8, 0]);

    var P = {};
    // Lance (motive pipe + nozzle) upper; lower is mirrored
    P.lanceU = lanceIn.concat(lanceOut.slice().reverse());
    P.lanceL = mirror(P.lanceU);
    // Body left of the branch: back plate + chamber top wall + left branch wall
    P.bodyAU = [[X.cb, lanceOuter(X.cb)], [X.cb, Rc + t], [xbL - t, Rc + t], [xbL - t, yTop], [xbL, yTop], [xbL, Rc], [X.cbi, Rc], [X.cbi, lanceOuter(X.cbi)]];
    // Body right of the branch: right branch wall + chamber wall + entry cone + throat + diffuser + outlet
    P.bodyBU = [[xbR, Rc], [xbR, yTop], [xbR + t, yTop]].concat(outer, inner.slice().reverse().slice(0, -1));
    // Lower body (no branch): back plate + chamber + ... in one piece
    var lowerOuter = [[X.cb, -lanceOuter(X.cb)], [X.cb, -(Rc + t)]].concat(mirror(outer));
    P.bodyL = lowerOuter.concat(mirror(inner).reverse(), [[X.cbi, -Rc], [X.cbi, -lanceOuter(X.cbi)]]);
    // Flanges
    P.flanges = [
      rect(0, rLance, fIn.T, rLance + fIn.W), rect(0, -rLance - fIn.W, fIn.T, -rLance),
      rect(X.end - fOut.T, bodyInner(X.end) + t, X.end, bodyInner(X.end) + t + fOut.W),
      rect(X.end - fOut.T, -bodyInner(X.end) - t - fOut.W, X.end, -bodyInner(X.end) - t),
      rect(xbL - t - fS.W, yTop - fS.T, xbL - t, yTop), rect(xbR + t, yTop - fS.T, xbR + t + fS.W, yTop)
    ];
    function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }

    // Fluid domain (single simple polygon): lance bore → around the nozzle tip →
    // chamber → branch → throat → diffuser → outlet, and the mirrored lower half.
    var up = lanceIn.slice();                                       // bore to the nozzle tip
    up = up.concat(lanceOut.slice().reverse().filter(function (p) { return p[0] >= X.cbi; }));
    up.push([X.cbi, lanceOuter(X.cbi)], [X.cbi, Rc], [xbL, Rc], [xbL, yTop], [xbR, yTop]);
    up = up.concat(inner);
    var lo = mirror(lanceIn).concat(mirror(lanceOut).reverse().filter(function (p) { return p[0] >= X.cbi; }));
    lo.push([X.cbi, -lanceOuter(X.cbi)], [X.cbi, -Rc]);
    lo = lo.concat(mirror(inner));
    P.fluid = up.concat(lo.reverse());

    // ---- components: axial spans (for profiles) + hit regions (for the schematic) ----
    var comps = COMPONENTS.map(function (c) { return { id: c.id, no: c.no, name: c.name, short: c.short, offAxis: !!c.offAxis }; });
    var CB = {}; comps.forEach(function (c) { CB[c.id] = c; });
    CB.motive.x0 = 0; CB.motive.x1 = X.n0;
    CB.nozzle.x0 = X.n0; CB.nozzle.x1 = X.tip;
    CB.chamber.x0 = X.tip; CB.chamber.x1 = X.th0;          // axial span along the flow path (gap s)
    CB.throat.x0 = X.th0; CB.throat.x1 = X.th1;
    CB.diffuser.x0 = X.th1; CB.diffuser.x1 = X.d1;
    CB.discharge.x0 = X.d1; CB.discharge.x1 = X.end;
    CB.suction.x0 = xbL; CB.suction.x1 = xbR;
    function band(x0, x1, r) { return [[x0, r], [x1, r], [x1, -r], [x0, -r]]; }
    function coneBand(x0, x1, f, pad) {             // region between ±(f(x)+pad)
      var n = 16, a = [], b = [];
      for (var i = 0; i <= n; i++) { var x = x0 + (x1 - x0) * i / n; a.push([x, f(x) + pad]); b.push([x, -f(x) - pad]); }
      return a.concat(b.reverse());
    }
    CB.motive.hit = band(0, X.n0, rLance + fIn.W);
    CB.nozzle.hit = coneBand(X.n0, X.tip, lanceOuter, 0);
    CB.suction.hit = [[xbL - t - fS.W, yTop], [xbR + t + fS.W, yTop], [xbR + t, Rc], [xbL - t, Rc]];
    CB.chamber.hit = coneBand(X.cb, X.th0, function (x) { return x < X.cbi ? Rc : bodyInner(x); }, t);
    CB.throat.hit = band(X.th0, X.th1, E.d_th / 2 + t);
    CB.diffuser.hit = coneBand(X.th1, X.d1, bodyInner, t);
    CB.discharge.hit = coneBand(X.d1, X.end, bodyInner, t + fOut.W);
    // fluid-only regions for highlighting (tint the wetted volume of a component)
    CB.motive.region = band(0, X.n0, E.D_in / 2);
    CB.nozzle.region = coneBand(X.n0, X.tip, lanceInner, 0);
    CB.suction.region = [[xbL, yTop], [xbR, yTop], [xbR, Rc], [xbL, Rc]];
    CB.chamber.region = (function () {
      var a = [[X.cbi, Rc]], n = 18, i, x;
      for (i = 0; i <= n; i++) { x = X.e0 + (X.th0 - X.e0) * i / n; a.push([x, bodyInner(x)]); }
      var b = [];
      for (i = n; i >= 0; i--) { x = X.cbi + (X.th0 - X.cbi) * i / n; b.push([x, x <= X.tip ? lanceOuter(x) : E.d_n / 2]); }
      var upper = a.concat(b);
      return upper.concat(mirror(upper).reverse());
    })();
    CB.throat.region = band(X.th0, X.th1, E.d_th / 2);
    CB.diffuser.region = coneBand(X.th1, X.d1, bodyInner, 0);
    CB.discharge.region = coneBand(X.d1, X.end, bodyInner, 0);

    // Bernoulli stations (x positions for markers — same as the previous model)
    var stationX = { s1: 0.5 * X.n0, s2: X.tip, s2s: X.tip + 0.5 * E.s, s3: X.th1, s4: X.d1 };

    // Dimension definitions (world anchors); labels/placement belong to the renderer
    var xDin = 0.5 * Math.min(X.cb, X.n0) + 0.25 * fIn.T;
    var dims = [
      { id: 'D_in', kind: 'dia', comp: 'motive', x: xDin, r: E.D_in / 2, value: E.D_in, sym: 'D_{n,in}', name: 'Motive inlet bore', type: 'input', dim: 'len_mm' },
      { id: 'd_n', kind: 'dia', comp: 'nozzle', x: X.tip, r: E.d_n / 2, value: E.d_n, sym: 'd_{n,sel}', name: 'Nozzle exit', type: 'calculated', dim: 'len_mm' },
      { id: 'd_th', kind: 'dia', comp: 'throat', x: X.th0 + 0.35 * E.L_th, r: E.d_th / 2, value: E.d_th, sym: 'd_{th}', name: 'Throat', type: 'calculated', dim: 'len_mm' },
      { id: 'd_diff', kind: 'dia', comp: 'diffuser', x: X.d1, r: E.d_diff / 2, value: E.d_diff, sym: 'd_{diff}', name: 'Diffuser exit', type: 'calculated', dim: 'len_mm' },
      { id: 'D_d', kind: 'dia', comp: 'discharge', x: X.end - fOut.T - 0.35 * (X.end - fOut.T - X.r1), r: bodyInner(X.end), value: E.D_d, sym: 'D_d', name: 'Return pipe bore', type: 'input', dim: 'len_mm' },
      { id: 'D_s', kind: 'hdia', comp: 'suction', x0: xbL, x1: xbR, y: yTop - fS.T - 0.35 * Hb, value: E.D_s, sym: 'D_s', name: 'Suction bore', type: 'input', dim: 'len_mm' },
      { id: 'L_n', kind: 'len', comp: 'nozzle', x0: X.n0, x1: X.tip, value: E.L_n, sym: 'L_n', name: 'Nozzle length', type: 'calculated', dim: 'len_mm', row: 0 },
      { id: 's', kind: 'len', comp: 'chamber', x0: X.tip, x1: X.th0, value: E.s, sym: 's', name: 'Nozzle–throat gap', type: 'calculated', dim: 'len_mm', row: 0 },
      { id: 'L_th', kind: 'len', comp: 'throat', x0: X.th0, x1: X.th1, value: E.L_th, sym: 'L_{th}', name: 'Throat length', type: 'calculated', dim: 'len_mm', row: 0 },
      { id: 'L_d', kind: 'len', comp: 'diffuser', x0: X.th1, x1: X.d1, value: E.L_d, sym: 'L_d', name: 'Diffuser length', type: 'calculated', dim: 'len_mm', row: 0 },
      { id: 'L_all', kind: 'len', comp: null, x0: X.n0, x1: X.d1, value: E.L_n + E.s + E.L_th + E.L_d, sym: 'L_{total}', name: 'Nozzle inlet → diffuser exit', type: 'derived', dim: 'len_mm', row: 1 },
      { id: 'alpha_n', kind: 'angle', comp: 'nozzle', x0: X.n0, x1: X.tip, r0: E.D_in / 2, r1: E.d_n / 2, value: E.alpha_n, sym: 'α_n', name: 'Nozzle half-angle', type: 'assumed', dim: 'angle' },
      { id: 'alpha_d', kind: 'angle', comp: 'diffuser', x0: X.th1, x1: X.d1, r0: E.d_th / 2, r1: E.d_diff / 2, value: E.alpha_d, sym: 'α_d', name: 'Diffuser half-angle', type: 'assumed', dim: 'angle' }
    ];

    var maxR = Math.max(rLance + fIn.W, Rc + t, bodyInner(X.end) + t + fOut.W);
    return {
      E: E, RULES: RULES, x: X, t: t, tTip: tTip, Rc: Rc, Le: Le, redL: redL,
      branch: { x: X.b, x0: xbL, x1: xbR, top: yTop, H: Hb, rS: E.D_s / 2 },
      flange: { inlet: fIn, outlet: fOut, suction: fS },
      totalLength: X.end, maxR: maxR, top: yTop + 0.02 * dref, bottom: -maxR,
      stationX: stationX, components: comps, comp: CB, dims: dims, poly: P,
      lanceInner: lanceInner, lanceOuter: lanceOuter, bodyInner: bodyInner,
      wallRadius: wallRadius, pathRadius: pathRadius,
      componentAt: function (x) {
        if (!fin(x)) return null;
        for (var i = 0; i < comps.length; i++) { var c = comps[i]; if (!c.offAxis && x >= c.x0 && x <= c.x1) return c; }
        return null;
      }
    };
  }

  /* ---------------------------------------------------------------------------
   * 1-D PROFILES — sampled along the axis, anchored to the station values.
   * Physics preserved from the previous release; x positions now come from the
   * parametric model. Downstream of station 4 (outlet reducer + stub, display
   * construction) continuity sets V and the EGL is held at station 4 (lossless).
   * ------------------------------------------------------------------------- */
  function buildProfiles(R, geom, nPts) {
    nPts = nPts || 320;
    var sx = geom.stationX, L = geom.totalLength;
    var st = R.stations; // [s1, s2, s2s, s3, s4]
    var v_m = R.velocities.v_m, v_n = R.nozzle.v_n, s3V = st[3].V;
    var mu = R.slurry.mu_sl * 0.001; // Pa·s
    var Pin = st[0].P, P2 = st[1].P, Pchamber = R.inputs.Ps, P3 = st[3].P, P4 = st[4].P;
    var EGL4 = st[4].H_total, DECAY_END = Math.exp(-3.0);

    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

    // sample positions: uniform + every component boundary and station (exact anchors)
    var xs = [];
    for (var k = 0; k < nPts; k++) xs.push(L * k / (nPts - 1));
    geom.components.forEach(function (c) { if (!c.offAxis) { xs.push(c.x0); xs.push(c.x1); } });
    for (var key in sx) xs.push(sx[key]);
    xs.sort(function (a, b) { return a - b; });
    xs = xs.filter(function (x, i) { return i === 0 || x - xs[i - 1] > 1e-6; });

    var out = { x: [], D: [], V: [], Pstatic: [], EGL: [], HGL: [], Re: [], rho: [] };
    xs.forEach(function (xq) {
      var Dloc = 2 * geom.pathRadius(xq), rhoLoc, Vloc, Ploc, hs, hv;
      if (xq <= sx.s2) {
        // NOZZLE: continuity in the converging cone (motive only); static follows V²
        Vloc = R.motive.Qm_m3s / (PI / 4 * Math.pow(Dloc / 1000, 2));
        rhoLoc = R.inputs.rho_m;
        var fr = (Vloc * Vloc - v_m * v_m) / Math.max(1e-9, (v_n * v_n - v_m * v_m));
        Ploc = lerp(Pin, P2, clamp(fr, 0, 1));
      } else if (xq <= sx.s3) {
        // SUCTION CHAMBER + THROAT: jet decays to the fully mixed velocity; pressure dips
        // to the chamber (suction) pressure, then rises by momentum exchange to station 3.
        // Decay normalised so V = v_n at station 2 and V = V₃ exactly at station 3 (the
        // previous release reached V₃ only asymptotically — ~14 % high at the throat exit).
        var t = (xq - sx.s2) / Math.max(1e-6, (sx.s3 - sx.s2));
        Vloc = s3V + (v_n - s3V) * (Math.exp(-3.0 * t) - DECAY_END) / (1 - DECAY_END);
        rhoLoc = R.diffuser.rho_do;
        if (xq <= sx.s2s) Ploc = lerp(P2, Pchamber, smooth((xq - sx.s2) / Math.max(1e-6, sx.s2s - sx.s2)));
        else Ploc = lerp(Pchamber, P3, smooth((xq - sx.s2s) / Math.max(1e-6, (sx.s3 - sx.s2s))));
      } else if (xq <= sx.s4) {
        // DIFFUSER: continuity in the expanding cone; pressure recovery 3 → 4
        var t2 = (xq - sx.s3) / Math.max(1e-6, (sx.s4 - sx.s3));
        Vloc = R.operating.Qd_m3s / (PI / 4 * Math.pow(Dloc / 1000, 2));
        rhoLoc = R.diffuser.rho_do;
        Ploc = lerp(P3, P4, smooth(t2));
      } else {
        // OUTLET (display construction): continuity, EGL held at station 4
        Vloc = R.operating.Qd_m3s / (PI / 4 * Math.pow(Dloc / 1000, 2));
        rhoLoc = R.diffuser.rho_do;
        hv = Vloc * Vloc / (2 * G);
        Ploc = (EGL4 - hv) * rhoLoc * G / 1e5;
      }
      hs = Ploc * 1e5 / (rhoLoc * G);
      hv = Vloc * Vloc / (2 * G);
      out.x.push(xq); out.D.push(Dloc); out.V.push(Vloc);
      out.Pstatic.push(Ploc); out.HGL.push(hs); out.EGL.push(hs + hv);
      out.Re.push(rhoLoc * Vloc * (Dloc / 1000) / mu); out.rho.push(rhoLoc);
    });
    // exact station markers (engine values) for overlays
    out.stations = st.map(function (s0, idx) {
      var keyX = ['s1', 's2', 's2s', 's3', 's4'][idx];
      return { key: keyX, x: sx[keyX], P: s0.P, V: s0.V, hs: s0.h_static, H: s0.H_total, rho: s0.rho, name: s0.name, id: s0.id };
    });
    return out;
  }

  // Interpolate every profile quantity at an axial position (for synced readouts)
  function sampleAt(prof, x) {
    var xs = prof.x, n = xs.length;
    if (!n) return null;
    if (x <= xs[0]) x = xs[0]; if (x >= xs[n - 1]) x = xs[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    var t = xs[hi] > xs[lo] ? (x - xs[lo]) / (xs[hi] - xs[lo]) : 0;
    function f(a) { return a[lo] + (a[hi] - a[lo]) * t; }
    return { x: x, P: f(prof.Pstatic), V: f(prof.V), EGL: f(prof.EGL), HGL: f(prof.HGL), Re: f(prof.Re), D: f(prof.D) };
  }

  root.VJP = root.VJP || {};
  root.VJP.geometry = {
    RULES: RULES, COMPONENTS: COMPONENTS, COMP_BY_ID: COMP_BY_ID,
    buildModel: buildModel, buildGeometry: buildModel, buildProfiles: buildProfiles, sampleAt: sampleAt
  };
})(typeof window !== 'undefined' ? window : this);
