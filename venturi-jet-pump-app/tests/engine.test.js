/* Regression test: compute(DEFAULT_INPUTS) must reproduce the spreadsheet's
 * stored (cached) values. Expected values are the exact cached results read
 * from VENTURI_JET_PUMP_CALCULATOR_v4.xlsx. Tolerance: 1e-6 relative. */
(function (root) {
  'use strict';

  // dotted path -> expected value (from the workbook's stored cell values)
  var EXPECT = {
    'slurry.SG_sl': 1.0714285714285714,
    'slurry.rho_sl': 1125,
    'slurry.Cv': 0.089285714285714274,
    'slurry.mu_sl': 1.3179814398801455,

    'motive.Qm_m3s': 0.041666666666666664,
    'motive.dP_nozzle': 1100000,
    'motive.v_n_th': 43.485082280621029,
    'motive.P_hyd_kW': 45.833333333333329,

    'operating.Pd': 4.0999999999999996,
    'operating.H': 0.39240506329113917,
    'operating.M': 0.63709677419354849,
    'operating.Qs_Lmin': 1592.7419354838712,
    'operating.Qd_Lmin': 4092.7419354838712,

    'nozzle.A_n': 0.00095818300165055148,
    'nozzle.d_n_flow': 34.928448130349565,
    'nozzle.d_n_sel': 40.167715349901997,
    'nozzle.v_n': 32.880969588371293,
    'nozzle.L_n': 132.57929559434444,
    'nozzle.gap_s': 50.209644187377492,

    'throat.d_th': 100.41928837475498,
    'throat.A_th': 0.0079199813730178384,
    'throat.R_ratio': 0.12098298676748584,
    'throat.L_th': 803.35430699803987,

    'diffuser.L_d': 401.67715349901994,
    'diffuser.d_diff': 156.59529392421604,
    'diffuser.AR_d': 2.4317735689254825,
    'diffuser.Cr': 0.83089605767433161,
    'diffuser.rho_do': 1079.1871921182269,

    'velocities.v_m': 2.3578510087688196,
    'velocities.v_s': 3.3799033613601432,
    'velocities.v_d': 3.5417329924686469,

    'friction.Re': 494225.55593118531,
    'friction.f': 0.016438898398970721,
    'friction.hf_inlet': 9.3161489063668945,
    'friction.dPf_inlet': 0.95960991810032215,
    'friction.hf_disch': 24.968078842512572,
    'friction.dPf_disch': 2.7555396012567939,

    'settling.Vc_D': 1.99472704899693,
    'settling.Vc_W': 2.3531230001017924,
    'settling.Vc': 2.3531230001017924,

    'static.staticHead': 0,
    'static.staticP': 0,
    'static.totalBackP': 2.7555396012567939,

    'cutterhead.A_face': 3.6643536711471349,
    'cutterhead.Q_exc': 164.89591520162108,
    'cutterhead.Q_bulk': 197.8750982419453,
    'cutterhead.Q_min': 3957.5019648389057,

    'minor.h_bends': 1.1391310218850743,
    'minor.h_exit': 0.75942068125671625,

    'returnLine.H_req': 26.866630545654363,
    'returnLine.dP_req': 2.9650685135947796,

    'cavitation.sigma': 0.35052357945101975,

    'diffuserHead.dH_margin': 1.8746691874137014,

    'headLoss.nozzle': 6.2365179179765704,
    'headLoss.mixing': 35.675950197161242,
    'headLoss.diffuser': 0.5312260083053566,
    'headLoss.total': 78.085766167083747
  };

  // Station-array expectations: [P, V, h_static, h_velocity, H_total]
  var STATIONS = {
    0: [11.040390081899679, 2.3578510087688196, 107.18305016163951, 0.28335684911071052, 107.46640701075023],
    1: [4.7511043803763124, 32.880969588371293, 46.124987916861436, 55.104901175912225, 101.22988909277366],
    2: [1, 3.3799033613601432, 9.0610488164004988, 0.58225008828407721, 9.6432989046845758],
    3: [2.7664551012943486, 8.612692679276611, 26.13110868746292, 3.7807581645089159, 29.911866851971837],
    4: [3.0427914948179668, 3.5417329924686469, 28.741299733068065, 0.6393411105984157, 29.38064084366648]
  };

  function getPath(obj, path) {
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) { cur = cur[parts[i]]; if (cur === undefined) return undefined; }
    return cur;
  }

  function relClose(a, b, tol) {
    if (a === b) return true;
    var denom = Math.max(Math.abs(a), Math.abs(b), 1e-12);
    return Math.abs(a - b) / denom <= tol;
  }

  function run() {
    var TOL = 1e-6;
    var R = root.VJP.engine.compute();
    var results = [], pass = 0, fail = 0;

    for (var path in EXPECT) {
      var got = getPath(R, path);
      var exp = EXPECT[path];
      var ok = (typeof got === 'number') && relClose(got, exp, TOL);
      if (ok) pass++; else fail++;
      results.push({ path: path, expected: exp, got: got, ok: ok });
    }
    var stKeys = ['P', 'V', 'h_static', 'h_velocity', 'H_total'];
    for (var s in STATIONS) {
      var st = R.stations[+s], exp = STATIONS[s];
      for (var c = 0; c < 5; c++) {
        var got2 = st[stKeys[c]], ok2 = relClose(got2, exp[c], 1e-5);
        if (ok2) pass++; else fail++;
        results.push({ path: 'stations[' + s + '].' + stKeys[c], expected: exp[c], got: got2, ok: ok2 });
      }
    }
    return { results: results, pass: pass, fail: fail, total: pass + fail };
  }

  root.VJP = root.VJP || {};
  root.VJP.test = { run: run };
})(typeof window !== 'undefined' ? window : this);
