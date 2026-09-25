/* Input schema — the engineering metadata for every editable parameter.
 * Keys match engine.DEFAULT_INPUTS (the engine itself is not touched).
 *
 *  sym     symbol in mini-markup:  d_{p,max}  ->  d<sub>p,max</sub>
 *  dim     units.js dimension (canonical basis = the engine's units)
 *  type    value type shown to the user (assumption visibility):
 *            input | assumed | empirical | limit
 *  hard    physical validity limits (violations BLOCK the calculation):
 *            { gt, ge, lt, le, int }
 *  rec     recommended range (violations are engineering WARNINGS)
 *  low/high  specific engineering meaning of being below/above `rec`
 *  effect(R, f) -> the live consequence shown under the field (display only;
 *            reads the authoritative engine results, never recomputes).
 */
(function (root) {
  'use strict';

  var TYPES = {
    input:      { short: 'INPUT',     label: 'User input',            desc: 'Value supplied by the engineer (site data, duty point, pipe schedule).' },
    assumed:    { short: 'ASSUMED',   label: 'Design assumption',     desc: 'Proportioning or target value chosen by design practice.' },
    empirical:  { short: 'EMPIRICAL', label: 'Empirical coefficient', desc: 'Coefficient from a published correlation or test data.' },
    limit:      { short: 'LIMIT',     label: 'Limit / criterion',     desc: 'Threshold used as an acceptance criterion.' },
    calculated: { short: 'CALC',      label: 'Calculated',            desc: 'Output of the calculation engine (spreadsheet model v4).' },
    derived:    { short: 'DERIVED',   label: 'Derived',               desc: 'Simple ratio or combination of calculated values, for review.' }
  };

  var SECTIONS = [
    { id: 'soil', no: 1, title: 'Soil & Particle', short: 'Soil & particle',
      desc: 'Solids the jet pump must pass. Sets the particle-passage throat diameter and the solids-passage criterion.',
      fields: ['d_p_max', 'SF', 'MFPR', 'rec_dn_dth'] },
    { id: 'motive', no: 2, title: 'Motive Fluid / Supply Pump', short: 'Motive fluid',
      desc: 'Supply-pump duty at the nozzle inlet. Drives the motive jet velocity and power.',
      fields: ['Pm', 'Qm_Lmin', 'rho_m', 'Cd'] },
    { id: 'suction', no: 3, title: 'Suction & Discharge', short: 'Suction / discharge',
      desc: 'Pressure boundary conditions and target efficiency that fix the operating point (H, M).',
      fields: ['Ps', 'Pback', 'eta_jp'] },
    { id: 'geometry', no: 4, title: 'Throat & Nozzle Geometry', short: 'Geometry',
      desc: 'Proportioning rules for the throat, nozzle and diffuser.',
      fields: ['k_th', 'alpha_n', 'alpha_d', 'Ld_dth'],
      advanced: ['nozzleExitFactor'], advancedTitle: 'Empirical nozzle bore factor' },
    { id: 'pipes', no: 5, title: 'Pipe Connections', short: 'Connections',
      desc: 'Connection bores and the wear-limited velocity used by the velocity checks.',
      fields: ['motiveID', 'suctionID', 'dischargeID', 'Vmax'] },
    { id: 'pipeline', no: 6, title: 'Pipeline & Slurry', short: 'Pipeline & slurry',
      desc: 'Return-line length, slurry properties and friction basis.',
      fields: ['L_pipe', 'Cw', 'SG_s', 'pipeMaterial'],
      advanced: ['FL', 'n_bends', 'K_bend', 'K_exit'], advancedTitle: 'Settling coefficient & return-line minor losses' },
    { id: 'tunnel', no: 7, title: 'Tunnel & Cutterhead', short: 'Tunnel',
      desc: 'Drive geometry and excavation rate for static head and cuttings removal.',
      fields: ['gradient_G', 'H_shaft', 'D_ch', 'ROP', 'f_sw'] }
  ];

  function ok(b) { return b ? 'ok' : 'warn'; }

  var FIELDS = [
    /* ---------------- 1 · Soil & Particle ---------------- */
    { key: 'd_p_max', name: 'Maximum particle size', sym: 'd_{p,max}', dim: 'len_mm', step: 1,
      type: 'input', hard: { gt: 0 }, rec: [1, 60], component: 'throat',
      desc: 'Largest solid particle expected to pass through the throat.',
      help: 'Governs the particle-passage throat d_th,p = d_p,max · MFPR · SF (Eq. F2.1). Use the largest expected fragment at the cutterhead opening, not the median size.',
      source: 'Site investigation · cutterhead opening',
      low: 'very fine solids — particle passage will not govern the throat',
      high: 'coarse solids — the throat will be sized by particle passage; review wear',
      effect: function (R, f) {
        return [
          { k: 'Throat / particle ratio ' + f.sym('d_{th}/d_p'), v: f.n(R.validation.solidsPassage, 4) + ' (req. ≥ ' + f.n(R.inputs.MFPR, 3) + ')',
            s: R.validation.solidsPass ? 'ok' : (R.validation.solidsMarginal ? 'warn' : 'fail') },
          { k: 'Particle-passage throat ' + f.sym('d_{th,p}'), v: f.q(R.throat.d_th_p, 'len_mm') + (R.throat.d_th_p >= R.throat.d_th_h ? ' — governs' : ' — hydraulic governs') }
        ];
      } },
    { key: 'SF', name: 'Throat safety factor', sym: 'SF', dim: 'ratio', step: 0.05,
      type: 'input', hard: { gt: 0 }, rec: [1.2, 1.5], component: 'throat',
      desc: 'Clearance margin applied to the particle-passage throat diameter.',
      help: 'Multiplies the particle-passage throat size (Eq. F2.1). Solids / slurry practice is 1.2–1.5.',
      source: 'Design practice · slurry service 1.2–1.5',
      low: 'reduced clogging margin', high: 'conservative — larger throat, lower efficiency',
      effect: function (R, f) {
        return [{ k: f.sym('d_{th,p} = d_{p,max} · MFPR · SF'), v: f.q(R.throat.d_th_p, 'len_mm') }];
      } },
    { key: 'MFPR', name: 'Minimum free-passage ratio', sym: '(d_{th}/d_p)_{min}', dim: 'ratio', step: 0.5,
      type: 'limit', hard: { gt: 0 }, rec: [5, 10], component: 'throat',
      desc: 'Minimum throat-to-particle diameter ratio for solids passage.',
      help: 'Used to size d_th,p (Eq. F2.1) and as the pass/fail criterion for solids passage (sheet B63). Minimum 5.',
      source: 'Design rule · minimum 5',
      low: 'below the minimum free-passage rule — clogging risk', high: 'conservative passage requirement',
      effect: function (R, f) {
        return [{ k: 'Criterion ' + f.sym('d_{th}/d_p') + ' ≥ MFPR', v: 'current ' + f.n(R.validation.solidsPassage, 4), s: R.validation.solidsPass ? 'ok' : 'fail' }];
      } },
    { key: 'rec_dn_dth', name: 'Nozzle-to-throat diameter ratio', sym: 'r = d_n/d_{th}', dim: 'ratio', step: 0.01,
      type: 'assumed', hard: { gt: 0, lt: 1 }, rec: [0.3, 0.5], component: 'throat',
      desc: 'Target ratio of nozzle exit to throat diameter (hydraulic sizing).',
      help: 'Sets the hydraulic throat d_th,h = d_n,sel / r (Eq. F2.2). Typical 0.30–0.50; slurry service ≈ 0.35–0.40.',
      source: 'Mueller (1964) · ESDU 85032',
      low: 'large throat for the jet — reduced head ratio', high: 'small throat for the jet — high mixing losses',
      effect: function (R, f) {
        return [{ k: 'Hydraulic throat ' + f.sym('d_{th,h}'), v: f.q(R.throat.d_th_h, 'len_mm') + (R.throat.d_th_h >= R.throat.d_th_p ? ' — governs d_th' : ' — particle passage governs') }];
      } },

    /* ---------------- 2 · Motive fluid ---------------- */
    { key: 'Pm', name: 'Motive inlet pressure', sym: 'P_m', dim: 'pressure_g', step: 0.5,
      type: 'input', hard: { gt: -1.013 }, rec: [4, 25], component: 'nozzle',
      desc: 'Supply-pump pressure available at the nozzle inlet.',
      help: 'Drives the nozzle velocity v_n,th = C_d·√(2(P_m − P_s)/ρ_m) (Eq. F1.1) and sets the head ratio H (Eq. F3.1).',
      source: 'Supply pump duty point',
      low: 'low jet energy — check entrainment and head ratio', high: 'high jet velocity — check cavitation and nozzle wear',
      effect: function (R, f) {
        return [
          { k: 'Nozzle ΔP → ' + f.sym('v_{n,th}'), v: f.q(R.motive.dP_nozzle / 1e5, 'pressure_bar') + ' → ' + f.q(R.motive.v_n_th, 'vel') },
          { k: 'Head ratio H', v: f.n(R.operating.H, 3) + ' (0.05–0.50)', s: ok(R.operating.H_in_range) }
        ];
      } },
    { key: 'Qm_Lmin', name: 'Motive flow rate', sym: 'Q_m', dim: 'flow_Lmin', step: 50,
      type: 'input', hard: { gt: 0 }, rec: [100, 6000], component: 'nozzle',
      desc: 'Supply-pump flow delivered to the nozzle.',
      help: 'Sizes the nozzle exit by continuity (Eq. F1.2–F1.3); with M it sets the total discharge Q_d = Q_m(1 + M).',
      source: 'Supply pump duty point',
      low: 'small duty — check nozzle manufacturability', high: 'large duty — check supply-line velocity',
      effect: function (R, f) {
        return [{ k: 'Nozzle exit ' + f.sym('d_{n,sel}') + ' · total flow ' + f.sym('Q_d'), v: f.q(R.nozzle.d_n_sel, 'len_mm') + ' · ' + f.q(R.operating.Qd_Lmin, 'flow_Lmin') }];
      } },
    { key: 'rho_m', name: 'Motive fluid density', sym: 'ρ_m', dim: 'density', step: 10,
      type: 'input', hard: { gt: 0 }, rec: [1000, 1300],
      desc: 'Density of the motive (carrier) fluid, e.g. bentonite suspension.',
      help: 'Used in the nozzle velocity (Eq. F1.1) and as the slurry carrier density (Eq. F8.2).',
      source: 'Mud-balance test of the bentonite suspension',
      low: 'lighter than water — check fluid definition', high: 'heavy suspension — check pumpability',
      effect: function (R, f) {
        return [{ k: 'Slurry density ' + f.sym('ρ_{sl}'), v: f.q(R.slurry.rho_sl, 'density') }];
      } },
    { key: 'Cd', name: 'Nozzle discharge coefficient', sym: 'C_d', dim: 'ratio', step: 0.01,
      type: 'empirical', hard: { gt: 0, le: 1 }, rec: [0.93, 0.97], component: 'nozzle',
      desc: 'Velocity coefficient of the converging nozzle.',
      help: 'Reduces the ideal jet velocity for nozzle losses (Eq. F1.1). Well-finished conical nozzles achieve 0.93–0.97.',
      source: 'Cunningham (1974) · 0.93–0.97',
      low: 'rough or poorly profiled nozzle', high: 'optimistic — above typical nozzle performance',
      effect: function (R, f) {
        return [{ k: 'Theoretical jet velocity ' + f.sym('v_{n,th}'), v: f.q(R.motive.v_n_th, 'vel') }];
      } },

    /* ---------------- 3 · Suction & discharge ---------------- */
    { key: 'Ps', name: 'Suction pressure at TBM face', sym: 'P_s', dim: 'pressure_g', step: 0.1,
      type: 'input', hard: { gt: -0.99 }, rec: [0, 5], component: 'suction',
      desc: 'Slurry pressure at the jet pump suction inlet.',
      help: 'Suction boundary (station 2s) and the cavitation margin σ = (P_s,abs − P_vap)/(½ρ_m v_n²) (Eq. F9.1).',
      source: 'Slurry feed pump outlet / face pressure',
      low: 'sub-atmospheric suction — cavitation margin reduced', high: 'high suction pressure — check chamber rating',
      effect: function (R, f) {
        return [{ k: 'Cavitation number σ', v: f.n(R.cavitation.sigma, 3) + ' (req. ≥ 0.20)', s: R.cavitation.safe ? 'ok' : 'fail' }];
      } },
    { key: 'Pback', name: 'Back-pressure at jet pump outlet', sym: 'P_{back}', dim: 'pressure_g', step: 0.1,
      type: 'input', hard: {}, rec: [0, 10], component: 'discharge',
      desc: 'Pressure the jet pump must deliver against at its outlet. Manual input — not iterated.',
      help: 'Manual input exactly as in the spreadsheet (B18). Cross-check it against the computed return-line demand ΔP_req (B156) and adopt the computed value when appropriate.',
      source: 'Manual · cross-checked against ΔP_req',
      low: 'negative back-pressure — check sign convention', high: 'high back-pressure — reduces entrainment',
      pbackAction: true,
      effect: function (R, f) {
        var d = R.inputs.Pback - R.returnLine.dP_req;
        return [{ k: 'Computed return-line demand ' + f.sym('ΔP_{req}'), v: f.q(R.returnLine.dP_req, 'pressure_bar') + ' · input ' + (d >= 0 ? 'exceeds by ' : 'is below by ') + f.q(Math.abs(d), 'pressure_bar', 3), s: d >= 0 ? 'ok' : 'warn' }];
      } },
    { key: 'eta_jp', name: 'Target jet pump efficiency', sym: 'η_{jp}', dim: 'ratio', step: 0.01,
      type: 'assumed', hard: { gt: 0, lt: 1 }, rec: [0.18, 0.28],
      desc: 'Design efficiency assumed for the entrainment ratio.',
      help: 'Sets M = η_jp / H (Eq. F3.2–F3.3). Slurry jet pumps typically achieve 0.18–0.28.',
      source: 'Sanger (1970) · slurry practice 0.18–0.28',
      low: 'pessimistic efficiency', high: 'optimistic for slurry service',
      effect: function (R, f) {
        return [{ k: 'Entrainment M · suction flow ' + f.sym('Q_s'), v: f.n(R.operating.M, 3) + ' · ' + f.q(R.operating.Qs_Lmin, 'flow_Lmin'), s: ok(R.validation.M_ok) }];
      } },

    /* ---------------- 4 · Throat & nozzle geometry ---------------- */
    { key: 'k_th', name: 'Throat length multiplier', sym: 'k_{th} = L_{th}/d_{th}', dim: 'ratio', step: 1,
      type: 'assumed', hard: { gt: 0 }, rec: [6, 10], component: 'throat',
      desc: 'Throat (mixing tube) length in throat diameters.',
      help: 'L_th = k_th · d_th (Eq. F2.5). Slurry service ≈ 8; 6–10 typical for complete mixing.',
      source: 'Mueller (1964) · slurry ≈ 8',
      low: 'short throat — incomplete mixing', high: 'long throat — additional friction loss',
      effect: function (R, f) { return [{ k: 'Throat length ' + f.sym('L_{th}'), v: f.q(R.throat.L_th, 'len_mm') }]; } },
    { key: 'alpha_n', name: 'Nozzle convergence half-angle', sym: 'α_n', dim: 'angle', step: 0.5,
      type: 'assumed', hard: { gt: 0, lt: 90 }, rec: [10, 22.5], component: 'nozzle',
      desc: 'Half-angle of the converging nozzle cone.',
      help: 'Sets the nozzle length L_n = (D_n,in − d_n,sel)/(2·tan α_n) (Eq. F1.5). Typical 10°–22.5°.',
      source: 'Nozzle design practice · 10°–22.5°',
      low: 'long, slender nozzle', high: 'abrupt convergence — higher nozzle loss',
      effect: function (R, f) { return [{ k: 'Nozzle length ' + f.sym('L_n'), v: f.q(R.nozzle.L_n, 'len_mm'), s: R.nozzle.L_n > 0 ? undefined : 'fail' }]; } },
    { key: 'alpha_d', name: 'Diffuser half-angle', sym: 'α_d', dim: 'angle', step: 0.5,
      type: 'assumed', hard: { ge: 0, lt: 45 }, rec: [3, 6], component: 'diffuser',
      desc: 'Half-angle of the conical diffuser.',
      help: 'Sets the diffuser exit d_diff = d_th + 2·L_d·tan α_d (Eq. F4.2) and the recovery C_r. Slurry 3°–6°; larger angles risk separation.',
      source: 'ESDU 85032 · slurry 3°–6°',
      low: 'very gradual diffuser — little recovery per length', high: 'risk of flow separation and reduced recovery',
      effect: function (R, f) { return [{ k: 'Diffuser exit ' + f.sym('d_{diff}') + ' · recovery ' + f.sym('C_r'), v: f.q(R.diffuser.d_diff, 'len_mm') + ' · ' + f.n(R.diffuser.Cr, 3) }]; } },
    { key: 'Ld_dth', name: 'Diffuser length ratio', sym: 'L_d/d_{th}', dim: 'ratio', step: 0.5,
      type: 'assumed', hard: { gt: 0 }, rec: [4, 8], component: 'diffuser',
      desc: 'Diffuser length in throat diameters.',
      help: 'L_d = (L_d/d_th) · d_th (Eq. F4.1). Slurry service 4–8.',
      source: 'Sanger (1970) · slurry 4–8',
      low: 'short diffuser — incomplete recovery', high: 'long diffuser — friction and settling exposure',
      effect: function (R, f) { return [{ k: 'Diffuser length ' + f.sym('L_d'), v: f.q(R.diffuser.L_d, 'len_mm') }]; } },
    { key: 'nozzleExitFactor', name: 'Nozzle bore factor', sym: 'k_{bore} = d_{n,sel}/d_n', dim: 'ratio', step: 0.01,
      type: 'empirical', hard: { gt: 0 }, rec: [1.0, 1.3], component: 'nozzle', advanced: true,
      desc: 'Empirical enlargement from the flow-sized nozzle to the selected bore.',
      help: 'd_n,sel = d_n × k_bore (spreadsheet F28, default 1.15). Undocumented in the sheet; exposed here as an editable empirical coefficient.',
      source: 'Spreadsheet F28 · empirical, default 1.15',
      low: 'bore smaller than the flow size — velocity above design', high: 'large bore enlargement — reduced jet velocity',
      effect: function (R, f) { return [{ k: f.sym('d_{n,sel} = d_n × k_{bore}'), v:f.q(R.nozzle.d_n_flow, 'len_mm') + ' × ' + f.n(R.inputs.nozzleExitFactor, 3) + ' = ' + f.q(R.nozzle.d_n_sel, 'len_mm') }]; } },

    /* ---------------- 5 · Pipe connections ---------------- */
    { key: 'motiveID', name: 'Motive inlet pipe ID', sym: 'D_{n,in}', dim: 'len_mm', step: 5,
      type: 'input', hard: { gt: 0 }, rec: [50, 400], component: 'motive',
      desc: 'Bore of the motive supply connection (= nozzle inlet diameter).',
      help: 'Sets the nozzle inlet D_n,in (B33) and the motive inlet velocity v_m. Must exceed the nozzle exit bore for a convergent nozzle.',
      source: 'Pipe schedule / flange DN',
      low: 'small connection — high supply velocity', high: 'large connection — long nozzle',
      effect: function (R, f) { return [{ k: 'Inlet velocity ' + f.sym('v_m') + ' · nozzle ' + f.sym('L_n'), v: f.q(R.velocities.v_m, 'vel') + ' · ' + f.q(R.nozzle.L_n, 'len_mm'), s: R.nozzle.L_n > 0 ? (R.velocities.v_m <= R.inputs.Vmax ? 'ok' : 'warn') : 'fail' }]; } },
    { key: 'suctionID', name: 'Suction inlet pipe ID', sym: 'D_s', dim: 'len_mm', step: 5,
      type: 'input', hard: { gt: 0 }, rec: [50, 400], component: 'suction',
      desc: 'Bore of the suction (slurry) connection.',
      help: 'Sets the suction velocity v_s = Q_s / A_s (sheet F41).',
      source: 'Pipe schedule / flange DN',
      low: 'small suction bore — high suction velocity', high: 'large suction bore',
      effect: function (R, f) { return [{ k: 'Suction velocity ' + f.sym('v_s'), v: f.q(R.velocities.v_s, 'vel') + ' (≤ ' + f.q(R.inputs.Vmax, 'vel') + ')', s: ok(R.velocities.v_s <= R.inputs.Vmax) }]; } },
    { key: 'dischargeID', name: 'Discharge / return pipe ID', sym: 'D_d', dim: 'len_mm', step: 5,
      type: 'input', hard: { gt: 0 }, rec: [50, 400], component: 'discharge',
      desc: 'Bore of the return (discharge) pipeline.',
      help: 'Used for the return velocity, Reynolds number, friction and settling velocity (sheet B98–B116).',
      source: 'Pipe schedule / flange DN',
      low: 'small return line — high friction', high: 'large return line — settling risk',
      effect: function (R, f) { return [{ k: 'Return velocity · Reynolds', v: f.q(R.velocities.V_disch, 'vel') + ' · Re ' + f.sci(R.friction.Re, 3) }]; } },
    { key: 'Vmax', name: 'Maximum allowable velocity', sym: 'V_{max}', dim: 'vel', step: 0.5,
      type: 'limit', hard: { gt: 0 }, rec: [3, 6],
      desc: 'Wear-limited maximum velocity at the diffuser exit and in the connections.',
      help: 'Criterion for the diffuser exit velocity (part of the overall check B66) and advisory for connection velocities.',
      source: 'Abrasive-wear practice · 3–6 m/s',
      low: 'strict wear limit', high: 'permissive wear limit — check liner material',
      effect: function (R, f) { return [{ k: 'Diffuser exit velocity ' + f.sym('v_d'), v: f.q(R.velocities.v_d, 'vel') + ' (≤ ' + f.q(R.inputs.Vmax, 'vel') + ')', s: ok(R.velocities.v_d <= R.inputs.Vmax) }]; } },

    /* ---------------- 6 · Pipeline & slurry ---------------- */
    { key: 'L_pipe', name: 'Return pipe length', sym: 'L', dim: 'len_m', step: 10,
      type: 'input', hard: { ge: 0 }, rec: [10, 2000],
      desc: 'Length of the supply and return pipelines (the drive length).',
      help: 'Friction head h_f = f·(L/D)·V²/2g for supply and return lines (Eq. F6.4); also the drive length for the gradient rise.',
      source: 'Drive length',
      low: 'very short drive', high: 'long drive — friction dominates the return demand',
      effect: function (R, f) { return [{ k: 'Return friction ' + f.sym('h_{f,d}') + ' · ' + f.sym('ΔP_{f,d}'), v: f.q(R.friction.hf_disch, 'head_m') + ' · ' + f.q(R.friction.dPf_disch, 'pressure_bar') }]; } },
    { key: 'Cw', name: 'Slurry weight concentration', sym: 'C_w', dim: 'percent', step: 1,
      type: 'input', hard: { ge: 0, lt: 100 }, rec: [5, 25],
      desc: 'Solids concentration by weight in the entrained slurry.',
      help: 'Sets the slurry specific gravity, density and volume concentration (Eq. F8.1–F8.3).',
      source: 'Slurry sampling / separation plant',
      low: 'dilute slurry', high: 'dense slurry — check viscosity and settling',
      effect: function (R, f) { return [{ k: 'Volume conc. ' + f.sym('C_v') + ' · ' + f.sym('ρ_{sl}'), v: f.n(R.slurry.Cv, 3) + ' · ' + f.q(R.slurry.rho_sl, 'density') }]; } },
    { key: 'SG_s', name: 'Solid specific gravity', sym: 'SG_s', dim: 'ratio', step: 0.05,
      type: 'input', hard: { gt: 1 }, rec: [1.5, 2.8],
      desc: 'Specific gravity of the solid particles (quartz ≈ 2.65).',
      help: 'Used in the slurry properties (Eq. F8.1) and the settling velocities (Eq. F7.1–F7.2).',
      source: 'Soil laboratory (particle density)',
      low: 'light solids', high: 'dense solids — high settling velocity',
      effect: function (R, f) { return [{ k: 'Critical settling velocity ' + f.sym('V_c'), v: f.q(R.settling.Vc, 'vel') + (R.settling.Vc_W >= R.settling.Vc_D ? ' (Wasp governs)' : ' (Durand governs)') }]; } },
    { key: 'pipeMaterial', name: 'Pipe material', sym: '', type: 'input', select: true,
      options: ['MS Steel', 'HDPE', 'Cast Iron', 'GRP/FRP'],
      desc: 'Return pipe material; sets the wall roughness ε.',
      help: 'Moody roughness: MS steel 0.046, HDPE 0.007, cast iron 0.26, GRP/FRP 0.01 mm (Eq. F6.6).',
      source: 'Moody (1944) standard values',
      effect: function (R, f) { return [{ k: 'Roughness ε · friction factor f', v: f.q(R.friction.eps, 'rough_mm') + ' · ' + f.n(R.friction.f, 3) }]; } },
    { key: 'FL', name: 'Durand settling coefficient', sym: 'F_L', dim: 'ratio', step: 0.05,
      type: 'empirical', hard: { gt: 0 }, rec: [0.9, 1.34], advanced: true,
      desc: 'Durand coefficient for the critical settling velocity.',
      help: 'Vc_D = F_L·√(2gD(SG_s − 1)) (Eq. F7.1). 0.9 for fine sand up to 1.34 for coarse material.',
      source: 'Durand (1953)',
      low: 'fine-particle coefficient', high: 'coarse-particle coefficient',
      effect: function (R, f) { return [{ k: 'Durand ' + f.sym('Vc_D') + ' · design ' + f.sym('V_c'), v: f.q(R.settling.Vc_D, 'vel') + ' · ' + f.q(R.settling.Vc, 'vel') }]; } },
    { key: 'n_bends', name: 'Number of 90° bends', sym: 'n_b', dim: 'count', step: 1,
      type: 'input', hard: { ge: 0, int: true }, rec: [0, 12], advanced: true,
      desc: '90° bends in the return line.',
      help: 'Minor loss h_bends = n_b · K_b · V²/2g (Eq. F10.2).',
      source: 'Pipeline route',
      high: 'many bends — minor losses become significant',
      effect: function (R, f) { return [{ k: 'Bend losses ' + f.sym('h_{bends}'), v: f.q(R.minor.h_bends, 'head_m') }]; } },
    { key: 'K_bend', name: 'Loss coefficient per bend', sym: 'K_b', dim: 'ratio', step: 0.05,
      type: 'empirical', hard: { ge: 0 }, rec: [0.3, 1.0], advanced: true,
      desc: 'Minor-loss coefficient per 90° bend.',
      help: 'Long-radius bend (R/D ≈ 1) → 0.75.',
      source: 'Minor-loss tables · R/D ≈ 1 → 0.75',
      low: 'very smooth bends', high: 'sharp bends / mitres',
      effect: function (R, f) { return [{ k: 'Loss per bend ' + f.sym('h_{b1}'), v: f.q(R.minor.h_b1, 'head_m') }]; } },
    { key: 'K_exit', name: 'Exit loss coefficient', sym: 'K_{exit}', dim: 'ratio', step: 0.1,
      type: 'empirical', hard: { ge: 0 }, rec: [0.5, 1.0], advanced: true,
      desc: 'Loss coefficient at the return-pipe exit.',
      help: 'Sudden expansion / free discharge → 1.0.',
      source: 'Minor-loss tables · free discharge 1.0',
      low: 'partial recovery at exit', high: 'above free-discharge loss',
      effect: function (R, f) { return [{ k: 'Exit loss ' + f.sym('h_{exit}'), v: f.q(R.minor.h_exit, 'head_m') }]; } },

    /* ---------------- 7 · Tunnel & cutterhead ---------------- */
    { key: 'gradient_G', name: 'Drive gradient', sym: 'G', dim: 'percent', step: 0.5,
      type: 'input', hard: { ge: -100, le: 100 }, rec: [-10, 10],
      desc: 'Tunnel gradient: positive rising towards the shaft, negative downhill.',
      help: 'Rise = L · G/100 adds static head (Eq. F10.1); only a positive rise counts.',
      source: 'Alignment drawings',
      low: 'steep downhill drive', high: 'steep rising drive — large static head',
      effect: function (R, f) { return [{ k: 'Static head ' + f.sym('h_{static}'), v: f.q(R.static.staticHead, 'head_m') }]; } },
    { key: 'H_shaft', name: 'Launch shaft depth', sym: 'H_{shaft}', dim: 'len_m', step: 1,
      type: 'input', hard: { ge: 0 }, rec: [0, 60],
      desc: 'Vertical lift from the jet pump to the discharge point.',
      help: 'Static head Δz in the return-line requirement (Eq. F10.1, F10.3).',
      source: 'Shaft drawings',
      high: 'deep shaft — static head dominates',
      effect: function (R, f) { return [{ k: 'Required head ' + f.sym('H_{req}'), v: f.q(R.returnLine.H_req, 'head_m') }]; } },
    { key: 'D_ch', name: 'Cutterhead outside diameter', sym: 'D_{ch}', dim: 'len_mm', step: 10,
      type: 'input', hard: { gt: 0 }, rec: [300, 4000],
      desc: 'Excavated diameter of the MTBM cutterhead.',
      help: 'Face area for the excavation rate (sheet B134).',
      source: 'MTBM specification',
      low: 'very small bore', high: 'large bore — high cuttings volume',
      effect: function (R, f) { return [{ k: 'Excavation rate ' + f.sym('Q_{exc}'), v: f.q(R.cutterhead.Q_exc, 'flow_Lmin') }]; } },
    { key: 'ROP', name: 'Rate of penetration', sym: 'ROP', dim: 'rate_mmmin', step: 5,
      type: 'input', hard: { ge: 0 }, rec: [20, 80],
      desc: 'Advance rate of the machine.',
      help: 'Q_exc = A_face · ROP (sheet B135).',
      source: 'Production planning',
      low: 'slow advance', high: 'fast advance — check cuttings removal',
      effect: function (R, f) { return [{ k: 'Minimum flow ' + f.sym('Q_{min}') + ' vs ' + f.sym('Q_d'), v: f.q(R.cutterhead.Q_min, 'flow_Lmin') + ' vs ' + f.q(R.operating.Qd_Lmin, 'flow_Lmin'), s: R.cutterhead.cuttingsOK ? 'ok' : 'fail' }]; } },
    { key: 'f_sw', name: 'Swell / bulking factor', sym: 'f_{sw}', dim: 'ratio', step: 0.05,
      type: 'empirical', hard: { gt: 0 }, rec: [1.2, 1.7],
      desc: 'Volume increase of excavated material.',
      help: 'Soil 1.2–1.4; rock 1.5–1.7 (sheet B136).',
      source: 'Geotechnical practice · soil 1.2–1.4, rock 1.5–1.7',
      low: 'little bulking', high: 'high bulking (rock)',
      effect: function (R, f) { return [{ k: 'Bulked cuttings ' + f.sym('Q_{bulk}'), v: f.q(R.cutterhead.Q_bulk, 'flow_Lmin') }]; } }
  ];

  var BYKEY = {};
  FIELDS.forEach(function (fl) { BYKEY[fl.key] = fl; });
  SECTIONS.forEach(function (s) {
    s.fields.concat(s.advanced || []).forEach(function (k) { BYKEY[k].section = s.id; });
  });

  /* Symbol mini-markup -> HTML.  a_{bc} -> a<sub>bc</sub>, a^{2} -> a<sup>2</sup>,
   * single-char a_b / a^2 also supported. Input is trusted (authored here). */
  function symHTML(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>')
      .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>')
      .replace(/_([A-Za-zα-ωΔ0-9])/g, '<sub>$1</sub>')
      .replace(/\^([0-9⁻]+)/g, '<sup>$1</sup>');
  }
  // plain-text form for clipboard/CSV:  d_{p,max} -> d_p,max
  function symText(s) {
    return String(s || '').replace(/_\{([^}]*)\}/g, '_$1').replace(/\^\{([^}]*)\}/g, '^$1');
  }

  // Backward-compatible grouping (title + fields) used by exports and the report
  var GROUPS = SECTIONS.map(function (s) {
    return { id: s.id, title: s.no + ' · ' + s.title, fields: s.fields.concat(s.advanced || []).map(function (k) { return BYKEY[k]; }) };
  });

  root.VJP = root.VJP || {};
  root.VJP.schema = { TYPES: TYPES, SECTIONS: SECTIONS, FIELDS: FIELDS, BYKEY: BYKEY, GROUPS: GROUPS, symHTML: symHTML, symText: symText };
})(typeof window !== 'undefined' ? window : this);
