/* Model-consistency tests for the presentation layer (the engine itself is
 * covered by engine.test.js against the spreadsheet):
 *   A. Validation ↔ engine: every structured criterion reports exactly the
 *      level of the corresponding engine flag (buildFlags), over a seeded
 *      sweep of random designs — so the UI can never disagree with the model.
 *   B. Geometry + profiles: the parametric model stays finite, ordered and
 *      collision-free; profiles reproduce the engine's station values.
 *   C. Units: display ↔ canonical conversions round-trip. */
(function (root) {
  'use strict';
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function randomInputs(r) {
    var S = root.VJP.schema, inp = JSON.parse(JSON.stringify(root.VJP.engine.DEFAULT_INPUTS));
    S.FIELDS.forEach(function (f) {
      if (f.select) { inp[f.key] = f.options[Math.floor(r() * f.options.length)]; return; }
      if (!f.rec || r() < 0.35) return;                          // keep some defaults
      var lo = f.rec[0], hi = f.rec[1], span = hi - lo;
      var v = lo - 0.35 * span + r() * 1.7 * span;               // include out-of-range values
      if (f.hard) { if (f.hard.gt !== undefined) v = Math.max(v, f.hard.gt + Math.abs(span) * 0.02 + 1e-6); if (f.hard.ge !== undefined) v = Math.max(v, f.hard.ge); if (f.hard.lt !== undefined) v = Math.min(v, f.hard.lt - Math.abs(span) * 0.02); if (f.hard.le !== undefined) v = Math.min(v, f.hard.le); if (f.hard.int) v = Math.round(v); }
      inp[f.key] = Number(v.toPrecision(5));
    });
    return inp;
  }
  var MAP = [['H', 0], ['R', 1], ['r', 2], ['alpha_d', 3], ['Ld', 4], ['sigma', 5], ['solids', 6], ['M', 7], ['vn', 8], ['settle', 9], ['head', 10], ['cuttings', 11]];
  var LEVEL = { ok: 'pass', warn: 'review', fail: 'fail' };

  function run() {
    var VJP = root.VJP, results = [], pass = 0, fail = 0;
    function check(name, ok, detail) { if (ok) pass++; else fail++; if (!ok || results.length < 400) results.push({ path: name, ok: ok, expected: '', got: detail || '' }); }

    /* A — validation mirrors engine flags */
    var r = rng(4242), evaluated = 0, blocked = 0, mism = 0;
    for (var n = 0; n < 400; n++) {
      var inp = randomInputs(r), D = VJP.design.evaluate(inp, {});
      if (D.blocked) { blocked++; continue; }
      evaluated++;
      var flags = D.R.flags;
      MAP.forEach(function (m) {
        var k = D.check[m[0]], want = LEVEL[flags[m[1]].level];
        if (!k || k.status !== want) { mism++; check('A · case ' + n + ' · ' + m[0], false, (k ? k.status : 'missing') + ' vs engine ' + want + ' (' + flags[m[1]].msg + ')'); }
      });
      // overall: engine B66 true ⇒ none of its components fail in our criteria
      var b66 = D.R.validation.overallOK, comp = ['solids', 'H', 'sigma', 'M'].every(function (id) { return D.check[id].status === 'pass'; }) && D.R.velocities.v_d >= D.R.velocities.Vc && D.R.velocities.v_d <= D.R.inputs.Vmax;
      if (b66 !== comp) { mism++; check('A · case ' + n + ' · B66 components', false, 'engine ' + b66 + ' vs derived ' + comp); }
      // status is acceptable only when every criterion passes
      var allCrit = D.checks.filter(function (k) { return k.kind === 'criterion' || k.kind === 'validity'; }).every(function (k) { return k.status === 'pass'; });
      if ((D.status.state === 'acceptable') !== allCrit) { mism++; check('A · case ' + n + ' · status', false, D.status.state + ' vs criteria ' + allCrit); }
    }
    check('A · validation criteria equal engine flag levels (' + evaluated + ' designs, ' + blocked + ' blocked)', mism === 0, mism + ' mismatches');

    /* B — geometry & profiles */
    var r2 = rng(777), gBad = 0, gN = 0;
    function fin(x) { return typeof x === 'number' && isFinite(x); }
    for (var q = 0; q < 250; q++) {
      var D2 = VJP.design.evaluate(randomInputs(r2), {});
      if (D2.blocked) continue;
      var M = D2.model, P = D2.prof, X = M.x, bad = [];
      gN++;
      if (!M || !P) { bad.push('no model/profile'); }
      else {
        // construction constraints (the back plate may sit upstream OR downstream of the nozzle inlet)
        var cons = [['flange', 'cb'], ['flange', 'n0'], ['cb', 'cbi'], ['n0', 'tip'], ['tip', 'th0'], ['e0', 'th0'], ['th0', 'th1'], ['th1', 'd1'], ['d1', 'r1'], ['r1', 'end']];
        cons.forEach(function (pr) { if (!(X[pr[1]] >= X[pr[0]] - 1e-9)) bad.push('x order ' + pr[0] + '>' + pr[1]); });
        if (!(X.cbi < X.tip)) bad.push('nozzle tip outside chamber');
        if (!(X.e0 > M.branch.x1 + M.t)) bad.push('branch overlaps entry cone');
        for (var j = 0; j <= 60; j++) {
          var x = X.cbi + (X.tip - X.cbi) * j / 60;
          if (!(M.lanceOuter(x) < M.bodyInner(x))) { bad.push('lance/body collision at x=' + x.toFixed(1)); break; }
        }
        if (!(M.E.d_n / 2 + M.tTip < M.E.d_th / 2)) bad.push('nozzle tip wall reaches throat');
        ['fluid', 'bodyAU', 'bodyBU', 'bodyL', 'lanceU', 'lanceL'].forEach(function (k) { M.poly[k].forEach(function (p) { if (!fin(p[0]) || !fin(p[1])) bad.push('NaN in ' + k); }); });
        ['Pstatic', 'V', 'EGL', 'HGL', 'Re'].forEach(function (k) { if (!P[k].every(fin)) bad.push('non-finite profile ' + k); });
        P.stations.forEach(function (s, i) {
          var smp = VJP.geometry.sampleAt(P, s.x);
          if (Math.abs(smp.P - s.P) > 1e-6 * Math.max(1, Math.abs(s.P))) bad.push('station ' + s.id + ' P ' + smp.P + ' vs ' + s.P);
          if (i !== 2 && Math.abs(smp.V - s.V) > 1e-6 * Math.max(1, s.V)) bad.push('station ' + s.id + ' V ' + smp.V + ' vs ' + s.V);
        });
      }
      if (bad.length) { gBad++; check('B · design ' + q, false, bad.slice(0, 3).join('; ')); }
    }
    check('B · parametric geometry valid and profiles anchored (' + gN + ' designs)', gBad === 0, gBad + ' invalid');

    /* C — units */
    var U = VJP.units, uBad = 0;
    Object.keys(U.DIM).forEach(function (dim) { [0.00123, 1, 42.5, 98765].forEach(function (v) { var d = U.conv(v, dim, 'imp').value, back = U.toSI(d, dim, 'imp'); if (Math.abs(back - v) > 1e-9 * Math.max(1, v)) uBad++; }); });
    check('C · unit conversions round-trip (' + Object.keys(U.DIM).length + ' dimensions)', uBad === 0, uBad + ' failures');
    return { results: results, pass: pass, fail: fail, total: pass + fail };
  }
  root.VJP = root.VJP || {};
  root.VJP.modelTest = { run: run, randomInputs: randomInputs };
})(typeof window !== 'undefined' ? window : this);
