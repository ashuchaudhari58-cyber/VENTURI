/* AUTHORITATIVE DESIGN STATE
 * -----------------------------------------------------------------------------
 *   USER INPUTS ─► VALIDATED INPUT MODEL ─► CALCULATION ENGINE ─► DESIGN STATE
 *                                                                    │
 *     Results · Schematic · Profiles · Flow · Validation · Equations · Compare · Report
 *
 * evaluate(inputs, invalid) is the ONE place the engine is called. Its result
 * (memoized by input content) is consumed by every page, so no view ever holds
 * independent engineering values. METRICS is the single registry of reported
 * quantities (label, symbol, unit dimension, value type, sheet cell, equation).
 * ========================================================================== */
(function (root) {
  'use strict';
  var VJP = root.VJP;

  var cache = new Map(), seq = 0, CACHE_MAX = 32;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function evaluate(inputs, invalid) {
    var key = JSON.stringify(inputs) + '|' + JSON.stringify(invalid || {});
    if (cache.has(key)) { var hit = cache.get(key); cache.delete(key); cache.set(key, hit); return hit; }

    var R = VJP.engine.compute(inputs);
    var V = VJP.validation.evaluate(R, inputs, invalid || {});
    var model = null, prof = null;
    if (V.status.state !== 'blocked') {
      model = VJP.geometry.buildModel(R);
      if (!model) {
        V.blockers.push({
          id: 'geometry', kind: 'geometry', params: [], title: 'Geometry cannot be generated',
          problem: function () { return 'The calculated dimensions do not define a buildable venturi (non-positive length or diameter).'; },
          why: 'The schematic, profiles and flow visualization need a valid geometry.',
          action: function () { return 'Review the inputs flagged as warnings and return them toward the recommended ranges.'; }
        });
        V.checks = [];
        V.status = VJP.validation.summarize([], V.blockers);
      } else {
        prof = VJP.geometry.buildProfiles(R, model);
      }
    }
    var byId = {};
    V.checks.forEach(function (c) { byId[c.id] = c; });
    var D = {
      id: ++seq, key: key, inputs: clone(inputs), invalid: clone(invalid || {}),
      R: R, V: V, status: V.status, blocked: V.status.state === 'blocked',
      checks: V.checks, check: byId, model: model, prof: prof, t: Date.now()
    };
    cache.set(key, D);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return D;
  }

  /* ---------------------------------------------------------------------------
   * METRICS — every reported quantity, defined once.
   *   g: group · sym: symbol markup · dim: units.js dimension · type: value type
   *   comp: schematic component · ref: spreadsheet cell · eq: equation id
   * ------------------------------------------------------------------------- */
  var GROUPS = [
    { id: 'geometry',  title: 'Geometry' },
    { id: 'operating', title: 'Operating point & velocities' },
    { id: 'slurry',    title: 'Slurry properties' },
    { id: 'pipeline',  title: 'Pipeline friction & settling' },
    { id: 'return',    title: 'Return line & back-pressure' },
    { id: 'cutter',    title: 'Cutterhead & cuttings' },
    { id: 'energy',    title: 'Energy, losses & cavitation' }
  ];
  function m(id, g, label, sym, dim, get, o) {
    o = o || {};
    return { id: id, g: g, label: label, sym: sym, dim: dim, get: get, type: o.type || 'calculated', comp: o.comp || null,
      ref: o.ref || '', eq: o.eq || '', sig: o.sig, sci: !!o.sci, text: !!o.text, step: o.step === undefined ? id : o.step, note: o.note || '' };
  }
  var METRICS = [
    // geometry
    m('D_n_in', 'geometry', 'Nozzle inlet (motive bore)', 'D_{n,in}', 'len_mm', function (R) { return R.nozzle.D_n_in; }, { type: 'input', comp: 'motive', ref: 'B33', step: 'D_n_in' }),
    m('d_n_flow', 'geometry', 'Nozzle exit — flow sizing', 'd_n', 'len_mm', function (R) { return R.nozzle.d_n_flow; }, { comp: 'nozzle', ref: 'F25', eq: 'F1.3' }),
    m('d_n_sel', 'geometry', 'Nozzle exit — selected bore', 'd_{n,sel}', 'len_mm', function (R) { return R.nozzle.d_n_sel; }, { comp: 'nozzle', ref: 'F28', eq: 'F1.3' }),
    m('L_n', 'geometry', 'Nozzle length', 'L_n', 'len_mm', function (R) { return R.nozzle.L_n; }, { comp: 'nozzle', ref: 'B36', eq: 'F1.5' }),
    m('gap_s', 'geometry', 'Nozzle–throat gap', 's', 'len_mm', function (R) { return R.nozzle.gap_s; }, { comp: 'chamber', ref: 'B37', eq: 'F1.6' }),
    m('d_th_p', 'geometry', 'Throat — particle-passage size', 'd_{th,p}', 'len_mm', function (R) { return R.throat.d_th_p; }, { comp: 'throat', ref: 'B24', eq: 'F2.1' }),
    m('d_th_h', 'geometry', 'Throat — hydraulic size', 'd_{th,h}', 'len_mm', function (R) { return R.throat.d_th_h; }, { comp: 'throat', ref: 'B25', eq: 'F2.2' }),
    m('d_th', 'geometry', 'Throat diameter (selected)', 'd_{th}', 'len_mm', function (R) { return R.throat.d_th; }, { comp: 'throat', ref: 'B26', eq: 'F2.3' }),
    m('L_th', 'geometry', 'Throat length', 'L_{th}', 'len_mm', function (R) { return R.throat.L_th; }, { comp: 'throat', ref: 'B28', eq: 'F2.5' }),
    m('A_th', 'geometry', 'Throat area', 'A_{th}', 'area_m2', function (R) { return R.throat.A_th; }, { comp: 'throat', ref: 'B29', eq: 'F2.4' }),
    m('R_ratio', 'geometry', 'Area ratio A_n/A_th', 'R', 'ratio', function (R) { return R.throat.R_ratio; }, { comp: 'throat', ref: 'F26', eq: 'F2.6' }),
    m('r_act', 'geometry', 'Diameter ratio d_n,sel/d_th', 'r', 'ratio', function (R) { return R.nozzle.d_n_sel / R.throat.d_th; }, { type: 'derived', comp: 'throat', ref: 'F30', step: null }),
    m('L_d', 'geometry', 'Diffuser length', 'L_d', 'len_mm', function (R) { return R.diffuser.L_d; }, { comp: 'diffuser', ref: 'B42', eq: 'F4.1' }),
    m('d_diff', 'geometry', 'Diffuser exit diameter', 'd_{diff}', 'len_mm', function (R) { return R.diffuser.d_diff; }, { comp: 'diffuser', ref: 'B43', eq: 'F4.2' }),
    m('AR_d', 'geometry', 'Diffuser area ratio', 'AR_d', 'ratio', function (R) { return R.diffuser.AR_d; }, { comp: 'diffuser', ref: 'B44', eq: 'F4.3' }),
    m('Cr', 'geometry', 'Pressure recovery coefficient', 'C_r', 'ratio', function (R) { return R.diffuser.Cr; }, { comp: 'diffuser', ref: 'B45', eq: 'F4.4', sig: 3 }),
    m('L_total', 'geometry', 'Overall length (nozzle inlet → diffuser exit)', 'L_{total}', 'len_mm', function (R) { return R.nozzle.L_n + R.nozzle.gap_s + R.throat.L_th + R.diffuser.L_d; }, { type: 'derived', step: null }),
    // operating point
    m('dP_nozzle', 'operating', 'Available ΔP across nozzle', 'ΔP', 'pressure_bar', function (R) { return R.motive.dP_nozzle / 1e5; }, { comp: 'nozzle', ref: 'F11' }),
    m('v_n_th', 'operating', 'Theoretical nozzle velocity', 'v_{n,th}', 'vel', function (R) { return R.motive.v_n_th; }, { comp: 'nozzle', ref: 'F12', eq: 'F1.1' }),
    m('v_n', 'operating', 'Nozzle exit velocity (selected bore)', 'v_n', 'vel', function (R) { return R.nozzle.v_n; }, { comp: 'nozzle', ref: 'F29', eq: 'F1.2' }),
    m('P_hyd', 'operating', 'Hydraulic motive power', 'P_{hyd}', 'power', function (R) { return R.motive.P_hyd_kW; }, { comp: 'motive', ref: 'F13', eq: 'F1.4' }),
    m('Pd', 'operating', 'Discharge pressure', 'P_d', 'pressure_g', function (R) { return R.operating.Pd; }, { comp: 'discharge', ref: 'B19', eq: 'F10.5' }),
    m('H', 'operating', 'Head ratio', 'H', 'ratio', function (R) { return R.operating.H; }, { ref: 'F16', eq: 'F3.1', sig: 3 }),
    m('M', 'operating', 'Entrainment ratio', 'M', 'ratio', function (R) { return R.operating.M; }, { comp: 'chamber', ref: 'F18', eq: 'F3.2', sig: 3 }),
    m('Qs', 'operating', 'Suction (entrained) flow', 'Q_s', 'flow_Lmin', function (R) { return R.operating.Qs_Lmin; }, { comp: 'suction', ref: 'F19' }),
    m('Qd', 'operating', 'Total discharge flow', 'Q_d', 'flow_Lmin', function (R) { return R.operating.Qd_Lmin; }, { comp: 'discharge', ref: 'F21', eq: 'F3.4' }),
    m('rho_mix', 'operating', 'Suction slurry density', 'ρ_{mix}', 'density', function (R) { return R.operating.rho_mix; }, { comp: 'suction', ref: 'B17' }),
    m('rho_do', 'operating', 'Mixed discharge density', 'ρ_{do}', 'density', function (R) { return R.diffuser.rho_do; }, { comp: 'diffuser', ref: 'B46', eq: 'F3.5' }),
    m('v_m', 'operating', 'Motive inlet velocity', 'v_m', 'vel', function (R) { return R.velocities.v_m; }, { comp: 'motive', ref: 'F40' }),
    m('v_s', 'operating', 'Suction inlet velocity', 'v_s', 'vel', function (R) { return R.velocities.v_s; }, { comp: 'suction', ref: 'F41' }),
    m('V_th', 'operating', 'Throat (mixed) velocity', 'V_3', 'vel', function (R) { return R.stations[3].V; }, { comp: 'throat', ref: 'C73', step: 'st3' }),
    m('v_d', 'operating', 'Diffuser exit velocity', 'v_d', 'vel', function (R) { return R.velocities.v_d; }, { comp: 'diffuser', ref: 'F42' }),
    // slurry
    m('d50', 'slurry', 'Median particle size (assumed 0.4·d_p,max)', 'd_{50}', 'len_mm', function (R) { return R.slurry.d50; }, { type: 'derived', ref: 'B87' }),
    m('SG_sl', 'slurry', 'Slurry specific gravity', 'SG_{sl}', 'ratio', function (R) { return R.slurry.SG_sl; }, { ref: 'B89', eq: 'F8.1' }),
    m('rho_sl', 'slurry', 'Slurry density', 'ρ_{sl}', 'density', function (R) { return R.slurry.rho_sl; }, { ref: 'B90', eq: 'F8.2' }),
    m('Cv', 'slurry', 'Volume concentration', 'C_v', 'ratio', function (R) { return R.slurry.Cv; }, { ref: 'B91', eq: 'F8.3', sig: 3 }),
    m('mu_sl', 'slurry', 'Slurry viscosity (Thomas)', 'μ_{sl}', 'visc', function (R) { return R.slurry.mu_sl; }, { ref: 'B92', eq: 'F8.4' }),
    // pipeline
    m('eps', 'pipeline', 'Pipe wall roughness', 'ε', 'rough_mm', function (R) { return R.friction.eps; }, { type: 'empirical', ref: 'B96', eq: 'F6.6' }),
    m('V_disch', 'pipeline', 'Return pipe velocity', 'V_{disch}', 'vel', function (R) { return R.velocities.V_disch; }, { comp: 'discharge', ref: 'B103' }),
    m('Re', 'pipeline', 'Reynolds number (return pipe)', 'Re', 'ratio', function (R) { return R.friction.Re; }, { comp: 'discharge', ref: 'B104', eq: 'F6.1', sci: true }),
    m('regime', 'pipeline', 'Flow regime', '', 'ratio', function (R) { return R.friction.regime; }, { comp: 'discharge', ref: 'B105', text: true, step: 'Re' }),
    m('f', 'pipeline', 'Darcy friction factor', 'f', 'ratio', function (R) { return R.friction.f; }, { ref: 'B106', eq: 'F6.2' }),
    m('hf_inlet', 'pipeline', 'Supply-line friction head', 'h_{f,in}', 'head_m', function (R) { return R.friction.hf_inlet; }, { comp: 'motive', ref: 'B107', eq: 'F6.4' }),
    m('dPf_inlet', 'pipeline', 'Supply-line friction ΔP', 'ΔP_{f,in}', 'pressure_bar', function (R) { return R.friction.dPf_inlet; }, { comp: 'motive', ref: 'B108', eq: 'F6.5' }),
    m('hf_disch', 'pipeline', 'Return-line friction head', 'h_{f,d}', 'head_m', function (R) { return R.friction.hf_disch; }, { comp: 'discharge', ref: 'B109', eq: 'F6.4' }),
    m('dPf_disch', 'pipeline', 'Return-line friction ΔP', 'ΔP_{f,d}', 'pressure_bar', function (R) { return R.friction.dPf_disch; }, { comp: 'discharge', ref: 'B110', eq: 'F6.5' }),
    m('Vc_D', 'pipeline', 'Critical velocity — Durand', 'V_{c,D}', 'vel', function (R) { return R.settling.Vc_D; }, { ref: 'B114', eq: 'F7.1', type: 'calculated' }),
    m('Vc_W', 'pipeline', 'Critical velocity — Wasp', 'V_{c,W}', 'vel', function (R) { return R.settling.Vc_W; }, { ref: 'B115', eq: 'F7.2' }),
    m('Vc', 'pipeline', 'Design critical settling velocity', 'V_c', 'vel', function (R) { return R.settling.Vc; }, { ref: 'B116', eq: 'F7.3' }),
    m('V_over_Vc', 'pipeline', 'Return velocity / critical velocity', 'V/V_c', 'ratio', function (R) { return R.settling.V_over_Vc; }, { ref: 'B118', sig: 3 }),
    // return line & back-pressure
    m('staticHead', 'return', 'Static head (shaft + rise)', 'h_{static}', 'head_m', function (R) { return R.static.staticHead; }, { ref: 'B126', eq: 'F10.1' }),
    m('staticP', 'return', 'Static pressure', 'P_{static}', 'pressure_bar', function (R) { return R.static.staticP; }, { ref: 'B127' }),
    m('totalBackP', 'return', 'Static + friction back-pressure', 'P_{back,sf}', 'pressure_bar', function (R) { return R.static.totalBackP; }, { ref: 'B128' }),
    m('h_bends', 'return', 'Bend losses', 'h_{bends}', 'head_m', function (R) { return R.minor.h_bends; }, { ref: 'B146', eq: 'F10.2' }),
    m('h_exit', 'return', 'Exit loss', 'h_{exit}', 'head_m', function (R) { return R.minor.h_exit; }, { ref: 'B148', eq: 'F10.2' }),
    m('H_req', 'return', 'Required head at diffuser exit', 'H_{req}', 'head_m', function (R) { return R.returnLine.H_req; }, { comp: 'discharge', ref: 'B155', eq: 'F10.3' }),
    m('dP_req', 'return', 'Computed return-line demand', 'ΔP_{req}', 'pressure_bar', function (R) { return R.returnLine.dP_req; }, { comp: 'discharge', ref: 'B156', eq: 'F10.4' }),
    m('Pback', 'return', 'Back-pressure (manual input)', 'P_{back}', 'pressure_g', function (R) { return R.inputs.Pback; }, { type: 'input', comp: 'discharge', ref: 'B18', step: null }),
    m('h_s4', 'return', 'Static head at diffuser exit', 'h_{s,4}', 'head_m', function (R) { return R.stations[4].h_static; }, { comp: 'diffuser', ref: 'E74', step: 'st4' }),
    m('H4', 'return', 'Total head at diffuser exit', 'H_4', 'head_m', function (R) { return R.diffuserHead.H4; }, { comp: 'diffuser', ref: 'B77', step: 'st4' }),
    m('dH_margin', 'return', 'Static-head margin h_s,4 − H_req', 'ΔH', 'head_m', function (R) { return R.diffuserHead.dH_margin; }, { ref: 'B79' }),
    // cutterhead
    m('A_face', 'cutter', 'Cutterhead face area', 'A_{face}', 'area_m2L', function (R) { return R.cutterhead.A_face; }, { ref: 'B134' }),
    m('Q_exc', 'cutter', 'Excavation rate (in situ)', 'Q_{exc}', 'flow_Lmin', function (R) { return R.cutterhead.Q_exc; }, { ref: 'B135' }),
    m('Q_bulk', 'cutter', 'Bulked cuttings volume', 'Q_{bulk}', 'flow_Lmin', function (R) { return R.cutterhead.Q_bulk; }, { ref: 'B136' }),
    m('Q_min', 'cutter', 'Minimum flow for cuttings (C_v 5 %)', 'Q_{min}', 'flow_Lmin', function (R) { return R.cutterhead.Q_min; }, { ref: 'B137' }),
    m('solidVolFrac', 'cutter', 'Cuttings volume fraction in Q_d', 'C_{v,cut}', 'ratio', function (R) { return R.cutterhead.solidVolFrac; }, { ref: 'B138', sig: 3 }),
    // energy
    m('hl_nozzle', 'energy', 'Head loss — nozzle (1 → 2)', 'h_{L,n}', 'head_m', function (R) { return R.headLoss.nozzle; }, { comp: 'nozzle', ref: 'Prof B13', step: 'headloss' }),
    m('hl_mixing', 'energy', 'Head loss — mixing (2, 2s → 3)', 'h_{L,mix}', 'head_m', function (R) { return R.headLoss.mixing; }, { comp: 'throat', ref: 'Prof B14', step: 'headloss' }),
    m('hl_diffuser', 'energy', 'Head loss — diffuser (3 → 4)', 'h_{L,d}', 'head_m', function (R) { return R.headLoss.diffuser; }, { comp: 'diffuser', ref: 'Prof B15', step: 'headloss' }),
    m('hl_total', 'energy', 'Total head drop, motive stream (1 → 4)', 'h_{L,tot}', 'head_m', function (R) { return R.headLoss.total; }, { ref: 'Prof B16', step: 'headloss' }),
    m('sigma', 'energy', 'Cavitation number at nozzle exit', 'σ', 'ratio', function (R) { return R.cavitation.sigma; }, { comp: 'nozzle', ref: 'B60', eq: 'F9.1', sig: 3 })
  ];
  var METRIC = {}; METRICS.forEach(function (x) { METRIC[x.id] = x; });

  // Key results (Results cards) — ids into METRICS, with the check that qualifies them
  var KEY_RESULTS = [
    { id: 'd_th', label: 'Throat diameter', check: 'solids' },
    { id: 'L_th', label: 'Throat length' },
    { id: 'd_n_sel', label: 'Nozzle exit diameter' },
    { id: 'd_diff', label: 'Diffuser exit diameter', check: 'diffPipe' },
    { id: 'H', label: 'Head ratio', check: 'H' },
    { id: 'M', label: 'Entrainment ratio', check: 'M' },
    { id: 'Qd', label: 'Total flow', check: 'cuttings' },
    { id: 'v_n', label: 'Nozzle exit velocity', check: 'vn' },
    { id: 'Cr', label: 'Recovery coefficient', check: 'Cr' },
    { id: 'sigma', label: 'Cavitation index', check: 'sigma' },
    { id: 'P_hyd', label: 'Motive power' },
    { id: 'Re', label: 'Reynolds number', check: 'Re' }
  ];
  // Persistent design summary (Inputs page)
  var SUMMARY = ['d_th', 'L_th', 'd_n_sel', 'Qd', 'P_hyd', 'sigma', 'H', 'M'];

  function metricValue(D, id) {
    var x = METRIC[id]; if (!x || !D || !D.R) return NaN;
    try { return x.get(D.R); } catch (e) { return NaN; }
  }

  root.VJP.design = {
    evaluate: evaluate, GROUPS: GROUPS, METRICS: METRICS, METRIC: METRIC,
    KEY_RESULTS: KEY_RESULTS, SUMMARY: SUMMARY, metricValue: metricValue
  };
})(typeof window !== 'undefined' ? window : this);
