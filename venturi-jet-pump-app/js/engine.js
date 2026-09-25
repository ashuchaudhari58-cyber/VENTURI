/* =============================================================================
 * VENTURI JET PUMP (EJECTOR) — MTBM SLURRY CIRCUIT DESIGN ENGINE
 * -----------------------------------------------------------------------------
 * Faithful port of VENTURI_JET_PUMP_CALCULATOR_v4.xlsx (authoritative model).
 * Every formula below maps 1:1 to a cell on the "Jet Pump Design" sheet; the
 * cell reference is given in a comment (e.g. // B26). The "Formulas" sheet
 * numbering (e.g. F2.3) is cited where a governing equation applies.
 *
 * Pure, dependency-free, deterministic. compute(inputs) -> results object.
 * No UI, no side effects — this module is unit-testable on its own
 * (see tests/engine.test.js which regression-checks it against the sheet's
 * stored values).
 *
 * Units: all internal math is SI-consistent with the sheet (bar g for gauge
 * pressure, L/min for volumetric flow, mm for geometry, kg/m^3, m/s, m).
 * Imperial is a *display* conversion only (js/units.js) — the model is metric.
 * ========================================================================== */
(function (root) {
  'use strict';

  var PI = Math.PI;
  var G = 9.81;              // gravitational acceleration, m/s^2
  var P_ATM_BAR = 1.013;     // atmospheric pressure, bar (for absolute conversion, B60)
  var P_VAP = 2340;          // water vapour pressure @20C, Pa (B60 / F9.1)

  function rad(deg) { return deg * PI / 180; }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function areaFromDia_mm(d_mm) { return PI / 4 * Math.pow(d_mm / 1000, 2); } // m^2 from mm dia

  /* ---------------------------------------------------------------------------
   * DEFAULT INPUTS — exactly the values stored in the workbook (Design A).
   * Grouped by the sheet's section headings. Every value here is an *input*
   * cell (no formula) in the spreadsheet.
   * ------------------------------------------------------------------------- */
  var DEFAULT_INPUTS = {
    // 1 — Soil type & application  +  2 — Design parameters
    d_p_max:    10,     // B4  Max particle size d_p_max (mm)
    SF:         1.2,    // B5  Throat safety factor
    MFPR:       5,      // B6  Min free passage ratio d_th/d_p
    rec_dn_dth: 0.4,    // B7  Recommended d_n/d_th

    // 3 — Motive fluid (supply pump)
    Pm:         12,     // B10 Motive inlet pressure (bar g)
    Qm_Lmin:    2500,   // B11 Motive flow rate (L/min)
    rho_m:      1050,   // B12 Motive fluid density (kg/m^3)
    Cd:         0.95,   // B13 Nozzle discharge coefficient

    // 5 — Suction & discharge conditions
    Ps:         1,      // B16 Suction pressure at TBM face (bar g)
    Pback:      3.1,    // B18 Back-pressure at jet pump outlet (bar g) — MANUAL input
    eta_jp:     0.25,   // B20 Target jet pump efficiency

    // 7 — Throat sizing
    k_th:       8,      // B27 Throat length multiplier

    // 9 — Nozzle geometry
    alpha_n:    22.5,   // B34 Nozzle convergence half-angle (deg)

    // 11 — Diffuser geometry
    alpha_d:    4,      // B40 Diffuser half-angle (deg)
    Ld_dth:     4,      // B41 Diffuser length ratio L_d/d_th

    // 13 — Pipe connections
    motiveID:   150,    // B48 Motive inlet pipe ID (mm)
    suctionID:  100,    // B49 Suction inlet pipe ID (mm)
    dischargeID:150,    // B50 Discharge / return pipe ID (mm)
    Vmax:       5,      // B51 Max allowable velocity (m/s)

    // 15 — Pipeline operating conditions
    L_pipe:     300,    // B54 Return pipe length (m)

    // A — Slurry properties
    Cw:         15,     // B85 Slurry weight concentration (%)
    SG_s:       1.8,    // B86 Solid particle specific gravity

    // B — Pipeline friction
    pipeMaterial: 'MS Steel', // B95 (MS Steel | HDPE | Cast Iron | GRP/FRP)

    // C — Critical settling velocity
    FL:         1.3,    // B113 Durand F_L factor

    // D — Tunnel geometry & static head
    gradient_G: 0,      // B122 Drive gradient (%)
    H_shaft:    0,      // B124 Launch shaft depth (m)

    // E — Cutterhead slurry generation
    D_ch:       2160,   // B131 Cutterhead OD (mm)
    ROP:        45,     // B132 Rate of penetration (mm/min)
    f_sw:       1.2,    // B133 Swell / bulking factor

    // F — Return pipe minor losses
    n_bends:    2,      // B142 Number of 90-deg bends
    K_bend:     0.75,   // B143 Loss coefficient per bend
    K_exit:     1,      // B147 Pipe exit loss coefficient

    // Advanced / empirical
    nozzleExitFactor: 1.15 // F28 multiplier: d_n,sel = d_n(flow) x 1.15 (undocumented in sheet;
                           //   exposed here as an editable coefficient, default 1.15)
  };

  // Pipe wall roughness lookup, mm (B96 / F6.6). Moody standard values.
  function roughness_mm(material) {
    switch (material) {
      case 'MS Steel':  return 0.046;
      case 'HDPE':      return 0.007;
      case 'Cast Iron': return 0.26;
      case 'GRP/FRP':   return 0.01;
      default:          return 0.046;
    }
  }

  function applicationClass(dp) { // F4
    if (dp > 50) return 'Heavy rock — high wear';
    if (dp > 20) return 'Coarse — abrasive';
    if (dp > 5)  return 'Medium — moderate';
    return 'Fine — low wear';
  }

  /* ---------------------------------------------------------------------------
   * compute(inputs) — returns a deeply-structured results object mirroring the
   * sheet. Computation order follows the sheet's dependency graph.
   * ------------------------------------------------------------------------- */
  function compute(userInputs) {
    var i = {};
    for (var k in DEFAULT_INPUTS) i[k] = DEFAULT_INPUTS[k];
    if (userInputs) for (var k2 in userInputs) if (userInputs[k2] !== undefined && userInputs[k2] !== null && userInputs[k2] !== '') i[k2] = userInputs[k2];

    // Coerce numerics (UI hands us strings)
    var NUMS = ['d_p_max','SF','MFPR','rec_dn_dth','Pm','Qm_Lmin','rho_m','Cd','Ps','Pback','eta_jp',
      'k_th','alpha_n','alpha_d','Ld_dth','motiveID','suctionID','dischargeID','Vmax','L_pipe','Cw','SG_s',
      'FL','gradient_G','H_shaft','D_ch','ROP','f_sw','n_bends','K_bend','K_exit','nozzleExitFactor'];
    for (var n = 0; n < NUMS.length; n++) i[NUMS[n]] = Number(i[NUMS[n]]);

    var R = {}; // results

    /* --- A — SLURRY PROPERTIES (needed early: rho_mix feeds operating point) -- */
    var d50      = 0.4 * i.d_p_max;                                            // B87 (F auto)
    var rho_carrier = i.rho_m;                                                  // B88
    var SG_sl    = i.SG_s / (i.SG_s - (i.Cw / 100) * (i.SG_s - 1));             // B89 (F8.1)
    var rho_sl   = SG_sl * rho_carrier;                                         // B90 (F8.2)
    var Cv       = (i.Cw / 100) * SG_sl / i.SG_s;                               // B91 (F8.3)
    var mu_sl    = 1.002 * (1 + 2.5 * Cv + 10.05 * Cv * Cv + 0.00273 * Math.exp(16.6 * Cv)); // B92 mPa·s (F8.4)

    /* --- 2 / 4 — MOTIVE DUTY --------------------------------------------------- */
    var Qm_m3s   = i.Qm_Lmin / 60000;                                          // F10
    var dP_nozzle= (i.Pm - i.Ps) * 1e5;                                        // F11  ΔP = (Pm − Ps) [Pa]
    var v_n_th   = i.Cd * Math.sqrt(2 * dP_nozzle / i.rho_m);                  // F12 (F1.1)
    var P_hyd_kW = Qm_m3s * dP_nozzle / 1000;                                  // F13 (F1.4)

    /* --- 6 — OPERATING POINT --------------------------------------------------- */
    var Pd       = i.Ps + i.Pback;                                            // B19
    var H        = (i.Pm - Pd > 0.001) ? (Pd - i.Ps) / (i.Pm - Pd) : 999;     // F16 (F3.1)
    var rho_mix  = rho_sl;                                                     // B17 = B90
    var M        = (H > 0) ? i.eta_jp / H : 0;                                // F18 (F3.2 -> M=η/H)
    var Qs_Lmin  = M * i.Qm_Lmin;                                             // F19
    var Qs_m3s   = Qs_Lmin / 60000;                                           // F20
    var Qd_Lmin  = i.Qm_Lmin + Qs_Lmin;                                       // F21 (F3.4)
    var Qd_m3s   = Qd_Lmin / 60000;

    /* --- 8 — NOZZLE SIZING (before throat: hydraulic throat needs d_n,sel) ----- */
    var A_n      = Qm_m3s / v_n_th;                                           // F24 (F1.2)
    var d_n_flow = Math.sqrt(4 * A_n / PI) * 1000;                            // F25 (F1.3) mm
    var d_n_sel  = d_n_flow * i.nozzleExitFactor;                            // F28  = d_n × 1.15
    var v_n      = Qm_m3s / (PI / 4 * Math.pow(d_n_sel / 1000, 2));           // F29 actual nozzle exit velocity

    /* --- 7 — THROAT SIZING ----------------------------------------------------- */
    var d_th_p   = i.d_p_max * i.MFPR * i.SF;                                 // F5 = B24 (F2.1)
    var d_th_h   = d_n_sel / i.rec_dn_dth;                                    // B25 (F2.2)
    var d_th     = Math.max(d_th_p, d_th_h);                                  // B26 (F2.3)
    var A_th     = areaFromDia_mm(d_th);                                      // B29 (F2.4)
    var R_ratio  = A_n / A_th;                                                // F26 (F2.6)
    var L_th     = i.k_th * d_th;                                             // B28 (F2.5)

    /* --- 9 — NOZZLE GEOMETRY --------------------------------------------------- */
    var D_n_in   = i.motiveID;                                                // B33 = B48
    var L_n      = (D_n_in - d_n_sel) / (2 * Math.tan(rad(i.alpha_n)));       // B36 (F1.5)
    var gap_s    = 0.5 * d_th;                                                // B37 (F1.6)

    /* --- 11 — DIFFUSER GEOMETRY ------------------------------------------------ */
    var L_d      = i.Ld_dth * d_th;                                           // B42 (F4.1)
    var d_diff   = d_th + 2 * L_d * Math.tan(rad(i.alpha_d));                 // B43 (F4.2)
    var AR_d     = d_th > 0 ? Math.pow(d_diff / d_th, 2) : 0;                 // B44 (F4.3)
    var Cr       = d_diff > 0 ? 1 - Math.pow(d_th / d_diff, 4) : 0;           // B45 (F4.4)
    var rho_do   = ((i.rho_m * Qm_m3s) + (rho_mix * Qs_m3s)) / (Qm_m3s + Qs_m3s); // B46

    /* --- 12 — VELOCITY CHECKS -------------------------------------------------- */
    var v_m      = i.motiveID  > 0 ? Qm_m3s / areaFromDia_mm(i.motiveID)   : 0; // F40
    var v_s      = i.suctionID > 0 ? Qs_m3s / areaFromDia_mm(i.suctionID)  : 0; // F41
    var v_d      = d_diff > 0     ? Qd_m3s / areaFromDia_mm(d_diff)       : 0; // F42 (uses diffuser exit dia B43, NOT pipe ID)

    /* --- B — PIPELINE FRICTION & HYDRAULICS ------------------------------------ */
    var eps      = roughness_mm(i.pipeMaterial);                              // B96
    var D_in_pipe= i.motiveID;                                               // B97
    var D_ds_pipe= i.dischargeID;                                            // B98
    var V_inlet  = (i.Qm_Lmin / 1000 / 60) / areaFromDia_mm(D_in_pipe);      // B102
    var V_disch  = (Qd_Lmin   / 1000 / 60) / areaFromDia_mm(D_ds_pipe);      // B103
    var Re       = rho_sl * V_disch * (D_ds_pipe / 1000) / (mu_sl * 0.001);  // B104 (F6.1)
    var regime   = Re < 2300 ? 'Laminar' : (Re < 4000 ? 'Transitional' : 'Turbulent'); // B105
    var f        = Re < 2300 ? 64 / Re                                       // B106 (F6.3 / F6.2)
                             : 0.25 / Math.pow(log10(eps / (3.7 * D_ds_pipe) + 5.74 / Math.pow(Re, 0.9)), 2);
    var hf_inlet = f * (i.L_pipe / (D_in_pipe / 1000)) * V_inlet * V_inlet / (2 * G); // B107 (F6.4)
    var dPf_inlet= hf_inlet * rho_carrier * G / 1e5;                         // B108 (F6.5)
    var hf_disch = f * (i.L_pipe / (D_ds_pipe / 1000)) * V_disch * V_disch / (2 * G); // B109
    var dPf_disch= hf_disch * rho_sl * G / 1e5;                              // B110

    /* --- C — CRITICAL SETTLING VELOCITY ---------------------------------------- */
    var Vc_D     = i.FL * Math.sqrt(2 * G * (D_ds_pipe / 1000) * (i.SG_s - 1)); // B114 (F7.1)
    var Vc_W     = 3.93 * Math.pow(d50, 1 / 6) * Math.pow(D_ds_pipe / 1000, 1 / 3) * Math.pow(i.SG_s - 1, 0.5); // B115 (F7.2)
    var Vc       = Math.max(Vc_D, Vc_W);                                      // B116 (F7.3)
    var V_over_Vc= Vc > 0 ? V_disch / Vc : 0;                                 // B118

    /* --- D — TUNNEL GEOMETRY & STATIC HEAD ------------------------------------- */
    var rise     = i.L_pipe * i.gradient_G / 100;                            // B125 (uses L_drive=B54)
    var staticHead = i.H_shaft + Math.max(0, rise);                          // B126
    var staticP  = staticHead * rho_sl * G / 1e5;                            // B127
    var totalBackP = staticP + dPf_disch;                                    // B128 (cross-check vs Pback)

    /* --- E — CUTTERHEAD SLURRY GENERATION -------------------------------------- */
    var A_face   = PI / 4 * Math.pow(i.D_ch / 1000, 2);                       // B134
    var Q_exc    = A_face * i.ROP;                                            // B135 (m²·mm/min = L/min)
    var Q_bulk   = Q_exc * i.f_sw;                                            // B136
    var Q_min    = Q_bulk / 0.05;                                            // B137 (at Cv=5%)
    var solidVolFrac = Q_bulk / Qd_Lmin;                                     // B138
    var cuttingsOK = Qd_Lmin >= Q_min;                                       // B139

    /* --- F — RETURN PIPE MINOR LOSSES ------------------------------------------ */
    var V_ret    = V_disch;                                                   // B144
    var h_b1     = i.K_bend * V_ret * V_ret / (2 * G);                       // B145
    var h_bends  = i.n_bends * h_b1;                                         // B146 (F10.2)
    var h_exit   = i.K_exit * V_ret * V_ret / (2 * G);                      // B148

    /* --- G — RETURN LINE HEAD REQUIREMENT AT DIFFUSER EXIT --------------------- */
    var dz       = i.H_shaft;                                                 // B151
    var H_req    = dz + hf_disch + h_bends + h_exit;                          // B155 (F10.3)
    var dP_req   = H_req * rho_sl * G / 1e5;                                  // B156 (F10.4)

    /* --- 17 — BERNOULLI STATION PROFILE (gauge basis) -------------------------- */
    // Station 1 — Motive inlet (body, pre-nozzle)
    var s1_P = i.Pm - dPf_inlet;                                             // B70
    var s1_V = v_m;                                                          // C70
    var s1_rho = i.rho_m;                                                    // D70
    var s1_hs = s1_P * 1e5 / (s1_rho * G);                                   // E70 (F5.1)
    var s1_hv = s1_V * s1_V / (2 * G);                                       // F70 (F5.2)
    var s1_H = s1_hs + s1_hv;                                                // G70 (F5.3)

    // Station 2 — Nozzle exit (Bernoulli-corrected)
    var s2_P = s1_P - i.rho_m * Math.pow(v_n / i.Cd, 2) / (2 * 1e5);         // B71
    var s2_V = v_n;                                                          // C71
    var s2_rho = i.rho_m;                                                    // D71
    var s2_hs = s2_P * 1e5 / (s2_rho * G);                                   // E71
    var s2_hv = s2_V * s2_V / (2 * G);                                       // F71
    var s2_H = s2_hs + s2_hv;                                                // G71

    // Station 2s — Suction inlet (entrained slurry side)
    var s2s_P = i.Ps;                                                        // B72
    var s2s_V = v_s;                                                         // C72
    var s2s_rho = rho_mix;                                                   // D72
    var s2s_hs = s2s_P * 1e5 / (s2s_rho * G);                                // E72
    var s2s_hv = s2s_V * s2s_V / (2 * G);                                    // F72
    var s2s_H = s2s_hs + s2s_hv;                                             // G72

    // Station 3 — Throat exit (momentum balance)
    var A_nsel = PI / 4 * Math.pow(d_n_sel / 1000, 2);                       // nozzle exit area (m²)
    var A_ann  = A_th - A_nsel;                                              // annular (suction) area at throat entry
    var s3_V = Qd_m3s / A_th;                                                // C73
    var s3_rho = rho_do;                                                     // D73
    // B73 momentum balance (verbatim from sheet):
    var s3_P = (
        s2_P * 1e5 * A_nsel
      + i.Ps * 1e5 * A_ann
      + i.rho_m * Qm_m3s * v_n
      + rho_mix * Qs_m3s * (Qs_m3s / A_ann)
      - s3_rho * Qd_m3s * s3_V
    ) / A_th / 1e5;                                                          // B73
    var s3_hs = s3_P * 1e5 / (s3_rho * G);                                   // E73
    var s3_hv = s3_V * s3_V / (2 * G);                                       // F73
    var s3_H = s3_hs + s3_hv;                                                // G73

    // Station 4 — Diffuser exit (forward-calculated, Cr-corrected)
    var s4_V = v_d;                                                          // C74
    var s4_rho = rho_do;                                                     // D74
    var s4_P = s3_P + Cr * 0.5 * s3_rho * (s3_V * s3_V - s4_V * s4_V) / 1e5; // B74 (F4.5)
    var s4_hs = s4_P * 1e5 / (s4_rho * G);                                   // E74
    var s4_hv = s4_V * s4_V / (2 * G);                                       // F74
    var s4_H = s4_hs + s4_hv;                                                // G74

    var stations = [
      { id: 1,   key: 's1',  name: 'Motive Inlet (pre-nozzle)',   P: s1_P,  V: s1_V,  rho: s1_rho, h_static: s1_hs, h_velocity: s1_hv, H_total: s1_H },
      { id: 2,   key: 's2',  name: 'Nozzle Exit (motive jet)',    P: s2_P,  V: s2_V,  rho: s2_rho, h_static: s2_hs, h_velocity: s2_hv, H_total: s2_H },
      { id: '2s',key: 's2s', name: 'Suction Inlet (entrained)',   P: s2s_P, V: s2s_V, rho: s2s_rho,h_static: s2s_hs,h_velocity: s2s_hv,H_total: s2s_H },
      { id: 3,   key: 's3',  name: 'Throat Exit (post-mixing)',   P: s3_P,  V: s3_V,  rho: s3_rho, h_static: s3_hs, h_velocity: s3_hv, H_total: s3_H },
      { id: 4,   key: 's4',  name: 'Diffuser Exit (recovered)',   P: s4_P,  V: s4_V,  rho: s4_rho, h_static: s4_hs, h_velocity: s4_hv, H_total: s4_H }
    ];

    /* --- 18 — DIFFUSER EXIT HEAD vs RETURN LINE -------------------------------- */
    var H4       = s4_H;                                                     // B77
    var dH_margin= s4_hs - H_req;                                            // B79 (h_static_4 − H_req)
    var headAdequate = dH_margin >= 0;

    /* --- 16 — DESIGN VALIDATION CHECKS ----------------------------------------- */
    var cav_sigma = ((i.Ps + P_ATM_BAR) * 1e5 - P_VAP) / (0.5 * i.rho_m * v_n * v_n); // B60 (F9.1)
    var cav_safe  = cav_sigma >= 0.2;                                        // B61 (F9.2)
    var solidsPassage = d_th / i.d_p_max;                                    // B62
    var solidsPass = solidsPassage >= i.MFPR;                                // B63
    var solidsMarginal = !solidsPass && solidsPassage >= i.MFPR * 0.8;
    var M_ok      = M >= 0.5 && M <= 5;                                      // B64
    var settlingSafe = v_d >= Vc;                                           // B65 (design critical vel = Vc)
    var settlingGood = v_d >= Vc * 1.2;

    var H_in_range = H >= 0.05 && H <= 0.5;                                  // F16/F17
    var R_in_range = R_ratio >= 0.01 && R_ratio <= 0.16;                    // F27
    var overallOK = solidsPass && H_in_range && cav_safe && M_ok
                    && v_d >= Vc && v_d <= i.Vmax;                          // B66

    // Component head losses (Hydraulic Profile sheet, motive stream)
    var hl_nozzle = s1_H - s2_H;                                             // Prof B13
    var hl_mixing = (i.Qm_Lmin / Qd_Lmin * s2_H + Qs_Lmin / Qd_Lmin * s2s_H) - s3_H; // Prof B14
    var hl_diffuser = s3_H - s4_H;                                           // Prof B15
    var hl_total  = s1_H - s4_H;                                             // Prof B16

    /* ---- assemble results ---------------------------------------------------- */
    R.inputs = i;
    R.slurry = { d50: d50, rho_carrier: rho_carrier, SG_sl: SG_sl, rho_sl: rho_sl, Cv: Cv, mu_sl: mu_sl };
    R.motive = { Qm_m3s: Qm_m3s, dP_nozzle: dP_nozzle, v_n_th: v_n_th, P_hyd_kW: P_hyd_kW, applicationClass: applicationClass(i.d_p_max) };
    R.operating = { Pd: Pd, H: H, rho_mix: rho_mix, M: M, Qs_Lmin: Qs_Lmin, Qs_m3s: Qs_m3s, Qd_Lmin: Qd_Lmin, Qd_m3s: Qd_m3s,
                    eta_jp: i.eta_jp, H_in_range: H_in_range };
    R.nozzle = { A_n: A_n, d_n_flow: d_n_flow, d_n_sel: d_n_sel, v_n: v_n, D_n_in: D_n_in, L_n: L_n, alpha_n: i.alpha_n, gap_s: gap_s,
                 A_nsel: A_nsel };
    R.throat = { d_th_p: d_th_p, d_th_h: d_th_h, d_th: d_th, A_th: A_th, R_ratio: R_ratio, L_th: L_th, k_th: i.k_th, R_in_range: R_in_range, A_ann: A_ann };
    R.diffuser = { L_d: L_d, d_diff: d_diff, AR_d: AR_d, Cr: Cr, rho_do: rho_do, alpha_d: i.alpha_d, Ld_dth: i.Ld_dth };
    R.velocities = { v_m: v_m, v_s: v_s, v_d: v_d, Vc: Vc, V_inlet: V_inlet, V_disch: V_disch, V_ret: V_ret };
    R.friction = { eps: eps, Re: Re, regime: regime, f: f, hf_inlet: hf_inlet, dPf_inlet: dPf_inlet, hf_disch: hf_disch, dPf_disch: dPf_disch };
    R.settling = { Vc_D: Vc_D, Vc_W: Vc_W, Vc: Vc, V_over_Vc: V_over_Vc };
    R.static = { rise: rise, staticHead: staticHead, staticP: staticP, totalBackP: totalBackP };
    R.cutterhead = { A_face: A_face, Q_exc: Q_exc, Q_bulk: Q_bulk, Q_min: Q_min, solidVolFrac: solidVolFrac, cuttingsOK: cuttingsOK };
    R.minor = { h_b1: h_b1, h_bends: h_bends, h_exit: h_exit };
    R.returnLine = { dz: dz, hf_disch: hf_disch, h_bends: h_bends, h_exit: h_exit, H_req: H_req, dP_req: dP_req };
    R.stations = stations;
    R.headLoss = { nozzle: hl_nozzle, mixing: hl_mixing, diffuser: hl_diffuser, total: hl_total };
    R.diffuserHead = { H4: H4, H_req: H_req, dH_margin: dH_margin, headAdequate: headAdequate, dP_req: dP_req,
                       PbackAdequate: s4_P >= dP_req };
    R.cavitation = { sigma: cav_sigma, safe: cav_safe };
    R.validation = {
      solidsPassage: solidsPassage, solidsPass: solidsPass, solidsMarginal: solidsMarginal,
      cav_safe: cav_safe, M_ok: M_ok, settlingSafe: settlingSafe, settlingGood: settlingGood,
      H_in_range: H_in_range, R_in_range: R_in_range, overallOK: overallOK
    };

    // Warnings/flags list for the UI (mirrors the sheet's IF(...) status strings)
    R.flags = buildFlags(R, i);
    return R;
  }

  function fmt(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  function buildFlags(R, i) {
    var f = [];
    function add(level, msg) { f.push({ level: level, msg: msg }); } // level: ok | warn | fail
    // H range (F17)
    if (R.operating.H_in_range) add('ok', 'H = ' + fmt(R.operating.H, 2) + ' (in 0.05–0.50)');
    else add('warn', 'H = ' + fmt(R.operating.H, 2) + ' outside 0.05–0.50 → adjust Pm');
    // R ratio (F27)
    if (R.throat.R_in_range) add('ok', 'R = ' + fmt(R.throat.R_ratio, 3) + ' in 0.01–0.16');
    else add('warn', 'R = ' + fmt(R.throat.R_ratio, 3) + ' — adjust Qm or pipe');
    // r vs recommended (F30)
    var r_act = R.nozzle.d_n_sel / R.throat.d_th;
    if (Math.abs(r_act - i.rec_dn_dth) <= 0.05) add('ok', 'r ≈ recommended (' + fmt(i.rec_dn_dth, 2) + ')');
    else add('warn', 'r = ' + fmt(r_act, 2) + ' vs rec ' + fmt(i.rec_dn_dth, 2) + ' — adjust Pm/Qm');
    // alpha_d range (F33)
    if (i.alpha_d >= 3 && i.alpha_d <= 6) add('ok', 'α_d in 3°–6°');
    else add('warn', 'α_d = ' + fmt(i.alpha_d, 0) + '° outside 3°–6°');
    // L/d_th (F35)
    if (i.Ld_dth >= 4 && i.Ld_dth <= 8) add('ok', 'L/d_th = ' + fmt(i.Ld_dth, 1));
    else add('warn', 'L/d_th = ' + fmt(i.Ld_dth, 1) + ' outside 4–8');
    // Cavitation (B61)
    if (R.cavitation.safe) add('ok', 'Cavitation SAFE (σ = ' + fmt(R.cavitation.sigma, 2) + ' ≥ 0.2)');
    else add('fail', 'CAVITATION RISK (σ = ' + fmt(R.cavitation.sigma, 2) + ' < 0.2) — reduce Pm or raise Ps');
    // Solids passage (B63)
    if (R.validation.solidsPass) add('ok', 'Solids passage PASS — d_th sufficient (' + fmt(R.validation.solidsPassage, 1) + '×)');
    else if (R.validation.solidsMarginal) add('warn', 'Solids passage MARGINAL');
    else add('fail', 'Solids passage FAIL — clogging risk');
    // M plausibility (B64)
    if (R.validation.M_ok) add('ok', 'M = ' + fmt(R.operating.M, 2) + ' (0.5–5)');
    else if (R.operating.M < 0.5) add('warn', 'M = ' + fmt(R.operating.M, 2) + ' — under-entrained');
    else add('warn', 'M = ' + fmt(R.operating.M, 2) + ' — over-entrained');
    // Nozzle exit velocity (F51)
    if (R.nozzle.v_n <= 35) add('ok', 'Nozzle exit v_n = ' + fmt(R.nozzle.v_n, 1) + ' m/s OK');
    else add('warn', 'Nozzle exit v_n = ' + fmt(R.nozzle.v_n, 1) + ' m/s HIGH — use tungsten carbide nozzle');
    // Return velocity settling (B65)
    if (R.velocities.v_d >= R.velocities.Vc * 1.2) add('ok', 'Return v_d > 1.2·Vc — no settling');
    else if (R.velocities.v_d >= R.velocities.Vc) add('warn', 'Return v_d margin < 20% above Vc');
    else add('fail', 'Return v_d < Vc — SETTLING RISK');
    // Head adequacy (B80)
    if (R.diffuserHead.headAdequate) add('ok', 'Diffuser exit head ≥ return-line demand');
    else if (R.diffuserHead.dH_margin >= -0.1 * R.returnLine.H_req) add('warn', 'Head deficit within 10% — review Pm/Pback');
    else add('fail', 'Head DEFICIT — increase Pm or reduce Pback');
    // Cuttings removal (B139)
    if (R.cutterhead.cuttingsOK) add('ok', 'Qd ≥ Q_min — sufficient cuttings removal');
    else add('fail', 'Qd < Q_min — increase Qm or reduce ROP');
    // Overall (B66)
    if (R.validation.overallOK) add('ok', 'OVERALL: DESIGN ACCEPTABLE — proceed to fabrication');
    else add('warn', 'OVERALL: REVIEW WARNINGS');
    return f;
  }

  root.VJP = root.VJP || {};
  root.VJP.engine = {
    compute: compute,
    DEFAULT_INPUTS: DEFAULT_INPUTS,
    roughness_mm: roughness_mm,
    applicationClass: applicationClass,
    constants: { G: G, P_ATM_BAR: P_ATM_BAR, P_VAP: P_VAP }
  };
})(typeof window !== 'undefined' ? window : this);
