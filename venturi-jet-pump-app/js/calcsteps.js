/* CALCULATION AUDIT TRAIL — one step per engine computation, in the engine's
 * dependency order. Each step states the objective, governing equation, the
 * substitution with the values the engine actually used, the result, units,
 * spreadsheet cell, equation reference, inputs, assumptions and a unit trace.
 * Results are READ from the engine results object (never recomputed here), so
 * the audit trail can never disagree with the calculation.
 * Values are shown in the calculation basis (the sheet's metric units). */
(function (root) {
  'use strict';
  var GROUPS = [
    { id: 'A', title: 'Slurry properties' },
    { id: 'B', title: 'Motive jet duty' },
    { id: 'C', title: 'Operating point' },
    { id: 'D', title: 'Nozzle sizing' },
    { id: 'E', title: 'Throat sizing' },
    { id: 'F', title: 'Nozzle geometry' },
    { id: 'G', title: 'Diffuser geometry' },
    { id: 'H', title: 'Velocity checks' },
    { id: 'I', title: 'Pipeline friction' },
    { id: 'J', title: 'Critical settling velocity' },
    { id: 'K', title: 'Static head' },
    { id: 'L', title: 'Cutterhead & cuttings' },
    { id: 'M', title: 'Return-line demand' },
    { id: 'N', title: 'Bernoulli stations' },
    { id: 'O', title: 'Performance & acceptance values' }
  ];
  var STEPS = [];
  function S(id, g, title, o) { o.id = id; o.g = g; o.title = title; o.type = o.type || 'calculated'; STEPS.push(o); }

  /* ---- A · slurry */
  S('d50', 'A', 'Median particle size', { obj: 'Representative particle size for the Wasp settling correlation.',
    eq: 'd_{50} = 0.4 · d_{p,max}', sub: function (R, n) { return '0.4 × ' + n(R.inputs.d_p_max) + ' mm'; },
    res: function (R) { return R.slurry.d50; }, unit: 'mm', dim: 'len_mm', cell: 'B87', type: 'derived', inputs: ['d_p_max'],
    assume: ['d₅₀ assumed as 40 % of the largest particle (spreadsheet default gradation).'], trace: 'mm → mm' });
  S('SG_sl', 'A', 'Slurry specific gravity', { obj: 'Specific gravity of the entrained slurry from its weight concentration.',
    eq: 'SG_{sl} = SG_s / [SG_s − C_w·(SG_s − 1)]', sub: function (R, n) { var i = R.inputs; return n(i.SG_s) + ' / [' + n(i.SG_s) + ' − ' + n(i.Cw / 100) + ' × (' + n(i.SG_s) + ' − 1)]'; },
    res: function (R) { return R.slurry.SG_sl; }, unit: '—', dim: 'ratio', cell: 'B89', ref: 'F8.1', inputs: ['SG_s', 'Cw'], trace: 'dimensionless' });
  S('rho_sl', 'A', 'Slurry density', { obj: 'Density of the entrained slurry.',
    eq: 'ρ_{sl} = SG_{sl} · ρ_{carrier}', sub: function (R, n) { return n(R.slurry.SG_sl) + ' × ' + n(R.inputs.rho_m) + ' kg/m³'; },
    res: function (R) { return R.slurry.rho_sl; }, unit: 'kg/m³', dim: 'density', cell: 'B90', ref: 'F8.2', inputs: ['rho_m'], uses: ['SG_sl'],
    assume: ['Carrier fluid = motive fluid (ρ_carrier = ρ_m, sheet B88).'], trace: '— × kg/m³ → kg/m³' });
  S('Cv', 'A', 'Volume concentration', { obj: 'Solids concentration by volume.',
    eq: 'C_v = C_w · SG_{sl} / SG_s', sub: function (R, n) { return n(R.inputs.Cw / 100) + ' × ' + n(R.slurry.SG_sl) + ' / ' + n(R.inputs.SG_s); },
    res: function (R) { return R.slurry.Cv; }, unit: '—', dim: 'ratio', cell: 'B91', ref: 'F8.3', inputs: ['Cw', 'SG_s'], uses: ['SG_sl'], trace: 'dimensionless' });
  S('mu_sl', 'A', 'Slurry viscosity', { obj: 'Apparent viscosity of the slurry (Thomas 1965).',
    eq: 'μ_{sl} = μ_w · [1 + 2.5·C_v + 10.05·C_v² + 0.00273·e^{16.6·C_v}]',
    sub: function (R, n) { var c = n(R.slurry.Cv); return '1.002 × [1 + 2.5 × ' + c + ' + 10.05 × ' + c + '² + 0.00273 × e^(16.6 × ' + c + ')]'; },
    res: function (R) { return R.slurry.mu_sl; }, unit: 'mPa·s', dim: 'visc', cell: 'B92', ref: 'F8.4', type: 'empirical', uses: ['Cv'],
    assume: ['μ_w = 1.002 mPa·s (water, 20 °C).', 'Correlation valid for C_v < 0.60.'], trace: 'mPa·s × — → mPa·s' });

  /* ---- B · motive duty */
  S('Qm_m3s', 'B', 'Motive flow in SI', { obj: 'Convert the supply-pump flow to m³/s.',
    eq: 'Q_m = Q_{m,[L/min]} / 60 000', sub: function (R, n) { return n(R.inputs.Qm_Lmin) + ' / 60 000'; },
    res: function (R) { return R.motive.Qm_m3s; }, unit: 'm³/s', dim: 'flow_m3s', cell: 'F10', inputs: ['Qm_Lmin'], trace: 'L/min ÷ 60 000 → m³/s' });
  S('dP_nozzle', 'B', 'Available pressure difference', { obj: 'Pressure difference driving the motive jet through the nozzle.',
    eq: 'ΔP = (P_m − P_s) · 10⁵', sub: function (R, n) { return '(' + n(R.inputs.Pm) + ' − ' + n(R.inputs.Ps) + ') × 10⁵'; },
    res: function (R) { return R.motive.dP_nozzle; }, unit: 'Pa', dim: 'pressure_pa', cell: 'F11', inputs: ['Pm', 'Ps'], trace: 'bar × 10⁵ → Pa', comp: 'nozzle' });
  S('v_n_th', 'B', 'Theoretical nozzle velocity', { obj: 'Jet velocity from Bernoulli across the nozzle, reduced by the discharge coefficient.',
    eq: 'v_{n,th} = C_d · √(2·ΔP / ρ_m)', sub: function (R, n) { return n(R.inputs.Cd) + ' × √(2 × ' + n(R.motive.dP_nozzle) + ' / ' + n(R.inputs.rho_m) + ')'; },
    res: function (R) { return R.motive.v_n_th; }, unit: 'm/s', dim: 'vel', cell: 'F12', ref: 'F1.1', inputs: ['Cd', 'rho_m'], uses: ['dP_nozzle'],
    assume: ['Incompressible, steady flow through the nozzle.'], trace: '√(Pa ÷ kg/m³) = √(m²/s²) → m/s', comp: 'nozzle' });
  S('P_hyd', 'B', 'Hydraulic motive power', { obj: 'Hydraulic power delivered by the motive jet.',
    eq: 'P_{hyd} = Q_m · ΔP / 1000', sub: function (R, n) { return n(R.motive.Qm_m3s) + ' × ' + n(R.motive.dP_nozzle) + ' / 1000'; },
    res: function (R) { return R.motive.P_hyd_kW; }, unit: 'kW', dim: 'power', cell: 'F13', ref: 'F1.4', uses: ['Qm_m3s', 'dP_nozzle'], trace: 'm³/s × Pa = W → ÷1000 → kW', comp: 'motive' });

  /* ---- C · operating point */
  S('Pd', 'C', 'Discharge pressure', { obj: 'Pressure the jet pump must develop at its outlet.',
    eq: 'P_d = P_s + P_{back}', sub: function (R, n) { return n(R.inputs.Ps) + ' + ' + n(R.inputs.Pback) + ' bar'; },
    res: function (R) { return R.operating.Pd; }, unit: 'bar g', dim: 'pressure_g', cell: 'B19', ref: 'F10.5', inputs: ['Ps', 'Pback'],
    assume: ['P_back is a manual input (sheet B18), cross-checked against ΔP_req in step M5.'], trace: 'bar + bar → bar g' });
  S('H', 'C', 'Head ratio', { obj: 'Dimensionless head ratio of the jet pump.',
    eq: 'H = (P_d − P_s) / (P_m − P_d)', sub: function (R, n) { var i = R.inputs; return '(' + n(R.operating.Pd) + ' − ' + n(i.Ps) + ') / (' + n(i.Pm) + ' − ' + n(R.operating.Pd) + ')'; },
    res: function (R) { return R.operating.H; }, unit: '—', dim: 'ratio', cell: 'F16', ref: 'F3.1', inputs: ['Pm', 'Ps'], uses: ['Pd'], check: 'H', trace: 'bar ÷ bar → —' });
  S('rho_mix', 'C', 'Suction stream density', { obj: 'Density of the entrained (suction) stream.',
    eq: 'ρ_{mix} = ρ_{sl}', sub: function (R, n) { return n(R.slurry.rho_sl) + ' kg/m³'; },
    res: function (R) { return R.operating.rho_mix; }, unit: 'kg/m³', dim: 'density', cell: 'B17', uses: ['rho_sl'], trace: 'kg/m³', comp: 'suction' });
  S('M', 'C', 'Entrainment ratio', { obj: 'Suction-to-motive flow ratio from the target efficiency.',
    eq: 'M = η_{jp} / H', sub: function (R, n) { return n(R.inputs.eta_jp) + ' / ' + n(R.operating.H); },
    res: function (R) { return R.operating.M; }, unit: '—', dim: 'ratio', cell: 'F18', ref: 'F3.2', inputs: ['eta_jp'], uses: ['H'], check: 'M',
    assume: ['Target efficiency η_jp = M·H is a design assumption (slurry 0.18–0.28).'], trace: '— ÷ — → —', comp: 'chamber' });
  S('Qs', 'C', 'Suction (entrained) flow', { obj: 'Slurry flow entrained by the jet.',
    eq: 'Q_s = M · Q_m', sub: function (R, n) { return n(R.operating.M) + ' × ' + n(R.inputs.Qm_Lmin) + ' L/min'; },
    res: function (R) { return R.operating.Qs_Lmin; }, unit: 'L/min', dim: 'flow_Lmin', cell: 'F19', inputs: ['Qm_Lmin'], uses: ['M'], trace: '— × L/min → L/min', comp: 'suction' });
  S('Qd', 'C', 'Total discharge flow', { obj: 'Mixed flow leaving the diffuser (continuity).',
    eq: 'Q_d = Q_m + Q_s', sub: function (R, n) { return n(R.inputs.Qm_Lmin) + ' + ' + n(R.operating.Qs_Lmin) + ' L/min'; },
    res: function (R) { return R.operating.Qd_Lmin; }, unit: 'L/min', dim: 'flow_Lmin', cell: 'F21', ref: 'F3.4', inputs: ['Qm_Lmin'], uses: ['Qs'], trace: 'L/min + L/min → L/min', comp: 'discharge' });

  /* ---- D · nozzle sizing */
  S('A_n', 'D', 'Nozzle exit area (flow sizing)', { obj: 'Exit area that passes Q_m at the theoretical jet velocity.',
    eq: 'A_n = Q_m / v_{n,th}', sub: function (R, n) { return n(R.motive.Qm_m3s) + ' / ' + n(R.motive.v_n_th); },
    res: function (R) { return R.nozzle.A_n; }, unit: 'm²', dim: 'area_m2', cell: 'F24', ref: 'F1.2', uses: ['Qm_m3s', 'v_n_th'], trace: 'm³/s ÷ m/s → m²', comp: 'nozzle' });
  S('d_n_flow', 'D', 'Nozzle exit diameter (flow sizing)', { obj: 'Diameter corresponding to the flow-sized exit area.',
    eq: 'd_n = √(4·A_n / π) × 1000', sub: function (R, n) { return '√(4 × ' + n(R.nozzle.A_n) + ' / π) × 1000'; },
    res: function (R) { return R.nozzle.d_n_flow; }, unit: 'mm', dim: 'len_mm', cell: 'F25', ref: 'F1.3', uses: ['A_n'], trace: '√m² × 1000 → mm', comp: 'nozzle' });
  S('d_n_sel', 'D', 'Selected nozzle exit bore', { obj: 'Selected bore after the empirical enlargement factor.',
    eq: 'd_{n,sel} = d_n × k_{bore}', sub: function (R, n) { return n(R.nozzle.d_n_flow) + ' × ' + n(R.inputs.nozzleExitFactor); },
    res: function (R) { return R.nozzle.d_n_sel; }, unit: 'mm', dim: 'len_mm', cell: 'F28', type: 'empirical', inputs: ['nozzleExitFactor'], uses: ['d_n_flow'],
    assume: ['Empirical bore factor k_bore (spreadsheet default 1.15) — undocumented in the sheet.'], trace: 'mm × — → mm', comp: 'nozzle', dimId: 'd_n' });
  S('v_n', 'D', 'Nozzle exit velocity (selected bore)', { obj: 'Actual jet velocity at the selected exit bore.',
    eq: 'v_n = Q_m / (π/4 · d_{n,sel}²)', sub: function (R, n) { return n(R.motive.Qm_m3s) + ' / (π/4 × (' + n(R.nozzle.d_n_sel / 1000) + ' m)²)'; },
    res: function (R) { return R.nozzle.v_n; }, unit: 'm/s', dim: 'vel', cell: 'F29', uses: ['Qm_m3s', 'd_n_sel'], check: 'vn',
    assume: ['Uniform (plug-flow) velocity at the exit bore.'], trace: 'm³/s ÷ m² → m/s', comp: 'nozzle' });

  /* ---- E · throat sizing */
  S('d_th_p', 'E', 'Particle-passage throat', { obj: 'Minimum throat that passes the largest solid with margin.',
    eq: 'd_{th,p} = d_{p,max} · MFPR · SF', sub: function (R, n) { var i = R.inputs; return n(i.d_p_max) + ' × ' + n(i.MFPR) + ' × ' + n(i.SF); },
    res: function (R) { return R.throat.d_th_p; }, unit: 'mm', dim: 'len_mm', cell: 'B24', ref: 'F2.1', inputs: ['d_p_max', 'MFPR', 'SF'], trace: 'mm × — × — → mm', comp: 'throat' });
  S('d_th_h', 'E', 'Hydraulic throat', { obj: 'Throat from the recommended nozzle-to-throat ratio.',
    eq: 'd_{th,h} = d_{n,sel} / r', sub: function (R, n) { return n(R.nozzle.d_n_sel) + ' / ' + n(R.inputs.rec_dn_dth); },
    res: function (R) { return R.throat.d_th_h; }, unit: 'mm', dim: 'len_mm', cell: 'B25', ref: 'F2.2', inputs: ['rec_dn_dth'], uses: ['d_n_sel'], trace: 'mm ÷ — → mm', comp: 'throat' });
  S('d_th', 'E', 'Selected throat diameter', { obj: 'Governing throat diameter — the larger of the two requirements.',
    eq: 'd_{th} = max(d_{th,p}, d_{th,h})', sub: function (R, n) { return 'max(' + n(R.throat.d_th_p) + ', ' + n(R.throat.d_th_h) + ')'; },
    res: function (R) { return R.throat.d_th; }, unit: 'mm', dim: 'len_mm', cell: 'B26', ref: 'F2.3', uses: ['d_th_p', 'd_th_h'], check: 'solids',
    note: function (R) { return R.throat.d_th_p >= R.throat.d_th_h ? 'Particle passage governs.' : 'Hydraulic sizing governs.'; }, trace: 'mm', comp: 'throat', dimId: 'd_th' });
  S('A_th', 'E', 'Throat area', { obj: 'Cross-sectional area of the throat.',
    eq: 'A_{th} = π/4 · d_{th}²', sub: function (R, n) { return 'π/4 × (' + n(R.throat.d_th / 1000) + ' m)²'; },
    res: function (R) { return R.throat.A_th; }, unit: 'm²', dim: 'area_m2', cell: 'B29', ref: 'F2.4', uses: ['d_th'], trace: 'm² → m²', comp: 'throat' });
  S('R_ratio', 'E', 'Area ratio', { obj: 'Nozzle-to-throat area ratio.',
    eq: 'R = A_n / A_{th}', sub: function (R, n) { return n(R.nozzle.A_n) + ' / ' + n(R.throat.A_th); },
    res: function (R) { return R.throat.R_ratio; }, unit: '—', dim: 'ratio', cell: 'F26', ref: 'F2.6', uses: ['A_n', 'A_th'], check: 'R',
    assume: ['Uses the flow-sized nozzle area A_n, as in the spreadsheet.'], trace: 'm² ÷ m² → —', comp: 'throat' });
  S('L_th', 'E', 'Throat length', { obj: 'Mixing-tube length.',
    eq: 'L_{th} = k_{th} · d_{th}', sub: function (R, n) { return n(R.inputs.k_th) + ' × ' + n(R.throat.d_th); },
    res: function (R) { return R.throat.L_th; }, unit: 'mm', dim: 'len_mm', cell: 'B28', ref: 'F2.5', inputs: ['k_th'], uses: ['d_th'], trace: '— × mm → mm', comp: 'throat', dimId: 'L_th' });

  /* ---- F · nozzle geometry */
  S('D_n_in', 'F', 'Nozzle inlet diameter', { obj: 'Nozzle inlet equals the motive connection bore.',
    eq: 'D_{n,in} = D_{motive}', sub: function (R, n) { return n(R.inputs.motiveID) + ' mm'; },
    res: function (R) { return R.nozzle.D_n_in; }, unit: 'mm', dim: 'len_mm', cell: 'B33', type: 'input', inputs: ['motiveID'], trace: 'mm', comp: 'motive', dimId: 'D_in' });
  S('L_n', 'F', 'Nozzle length', { obj: 'Length of the converging cone from its half-angle.',
    eq: 'L_n = (D_{n,in} − d_{n,sel}) / (2·tan α_n)', sub: function (R, n) { return '(' + n(R.nozzle.D_n_in) + ' − ' + n(R.nozzle.d_n_sel) + ') / (2 × tan ' + n(R.inputs.alpha_n) + '°)'; },
    res: function (R) { return R.nozzle.L_n; }, unit: 'mm', dim: 'len_mm', cell: 'B36', ref: 'F1.5', inputs: ['alpha_n'], uses: ['D_n_in', 'd_n_sel'], check: 'convergent', trace: 'mm ÷ — → mm', comp: 'nozzle', dimId: 'L_n' });
  S('gap_s', 'F', 'Nozzle–throat gap', { obj: 'Spacing between the nozzle exit and the throat entry.',
    eq: 's = 0.5 · d_{th}', sub: function (R, n) { return '0.5 × ' + n(R.throat.d_th); },
    res: function (R) { return R.nozzle.gap_s; }, unit: 'mm', dim: 'len_mm', cell: 'B37', ref: 'F1.6', uses: ['d_th'],
    assume: ['s = 0.5·d_th (Mueller 1964; range 0.5–1.0 d_th).'], trace: '— × mm → mm', comp: 'chamber', dimId: 's' });

  /* ---- G · diffuser */
  S('L_d', 'G', 'Diffuser length', { obj: 'Diffuser length from the length ratio.',
    eq: 'L_d = (L_d/d_{th}) · d_{th}', sub: function (R, n) { return n(R.inputs.Ld_dth) + ' × ' + n(R.throat.d_th); },
    res: function (R) { return R.diffuser.L_d; }, unit: 'mm', dim: 'len_mm', cell: 'B42', ref: 'F4.1', inputs: ['Ld_dth'], uses: ['d_th'], check: 'Ld', trace: '— × mm → mm', comp: 'diffuser', dimId: 'L_d' });
  S('d_diff', 'G', 'Diffuser exit diameter', { obj: 'Outlet diameter of the conical diffuser.',
    eq: 'd_{diff} = d_{th} + 2·L_d·tan α_d', sub: function (R, n) { return n(R.throat.d_th) + ' + 2 × ' + n(R.diffuser.L_d) + ' × tan ' + n(R.inputs.alpha_d) + '°'; },
    res: function (R) { return R.diffuser.d_diff; }, unit: 'mm', dim: 'len_mm', cell: 'B43', ref: 'F4.2', inputs: ['alpha_d'], uses: ['d_th', 'L_d'], check: 'alpha_d', trace: 'mm + mm → mm', comp: 'diffuser', dimId: 'd_diff' });
  S('AR_d', 'G', 'Diffuser area ratio', { obj: 'Outlet-to-throat area ratio.',
    eq: 'AR_d = (d_{diff} / d_{th})²', sub: function (R, n) { return '(' + n(R.diffuser.d_diff) + ' / ' + n(R.throat.d_th) + ')²'; },
    res: function (R) { return R.diffuser.AR_d; }, unit: '—', dim: 'ratio', cell: 'B44', ref: 'F4.3', uses: ['d_diff', 'd_th'], check: 'ARd', trace: '(mm ÷ mm)² → —', comp: 'diffuser' });
  S('Cr', 'G', 'Pressure recovery coefficient', { obj: 'Ideal-flow estimate of diffuser pressure recovery.',
    eq: 'C_r = 1 − (d_{th} / d_{diff})⁴', sub: function (R, n) { return '1 − (' + n(R.throat.d_th) + ' / ' + n(R.diffuser.d_diff) + ')⁴'; },
    res: function (R) { return R.diffuser.Cr; }, unit: '—', dim: 'ratio', cell: 'B45', ref: 'F4.4', uses: ['d_th', 'd_diff'], check: 'Cr',
    assume: ['Ideal estimate; achieved recovery is typically 0.7–0.9.'], trace: 'dimensionless', comp: 'diffuser' });
  S('rho_do', 'G', 'Mixed discharge density', { obj: 'Mass-flow-weighted density of the mixed stream.',
    eq: 'ρ_{do} = (ρ_m·Q_m + ρ_{mix}·Q_s) / (Q_m + Q_s)',
    sub: function (R, n) { var i = R.inputs, o = R.operating, m = R.motive; return '(' + n(i.rho_m) + ' × ' + n(m.Qm_m3s) + ' + ' + n(o.rho_mix) + ' × ' + n(o.Qs_m3s) + ') / (' + n(m.Qm_m3s) + ' + ' + n(o.Qs_m3s) + ')'; },
    res: function (R) { return R.diffuser.rho_do; }, unit: 'kg/m³', dim: 'density', cell: 'B46', ref: 'F3.5', inputs: ['rho_m'], uses: ['rho_mix', 'Qm_m3s', 'Qs'], trace: '(kg/m³ · m³/s) ÷ m³/s → kg/m³', comp: 'diffuser' });

  /* ---- H · velocities */
  S('v_m', 'H', 'Motive inlet velocity', { obj: 'Velocity in the motive supply connection.',
    eq: 'v_m = Q_m / (π/4 · D_{motive}²)', sub: function (R, n) { return n(R.motive.Qm_m3s) + ' / (π/4 × (' + n(R.inputs.motiveID / 1000) + ' m)²)'; },
    res: function (R) { return R.velocities.v_m; }, unit: 'm/s', dim: 'vel', cell: 'F40', inputs: ['motiveID'], uses: ['Qm_m3s'], check: 'vm', trace: 'm³/s ÷ m² → m/s', comp: 'motive' });
  S('v_s', 'H', 'Suction inlet velocity', { obj: 'Velocity in the suction connection.',
    eq: 'v_s = Q_s / (π/4 · D_s²)', sub: function (R, n) { return n(R.operating.Qs_m3s) + ' / (π/4 × (' + n(R.inputs.suctionID / 1000) + ' m)²)'; },
    res: function (R) { return R.velocities.v_s; }, unit: 'm/s', dim: 'vel', cell: 'F41', inputs: ['suctionID'], uses: ['Qs'], check: 'vs', trace: 'm³/s ÷ m² → m/s', comp: 'suction' });
  S('v_d', 'H', 'Diffuser exit velocity', { obj: 'Velocity at the diffuser outlet (station 4).',
    eq: 'v_d = Q_d / (π/4 · d_{diff}²)', sub: function (R, n) { return n(R.operating.Qd_m3s) + ' / (π/4 × (' + n(R.diffuser.d_diff / 1000) + ' m)²)'; },
    res: function (R) { return R.velocities.v_d; }, unit: 'm/s', dim: 'vel', cell: 'F42', uses: ['Qd', 'd_diff'], check: 'settle',
    assume: ['Uses the diffuser exit diameter (sheet F42), not the return pipe ID.'], trace: 'm³/s ÷ m² → m/s', comp: 'diffuser' });

  /* ---- I · pipeline friction */
  S('eps', 'I', 'Pipe wall roughness', { obj: 'Absolute roughness for the selected pipe material.',
    eq: 'ε = ε(material)', sub: function (R) { return R.inputs.pipeMaterial + ' → ' + R.friction.eps + ' mm'; },
    res: function (R) { return R.friction.eps; }, unit: 'mm', dim: 'rough_mm', cell: 'B96', ref: 'F6.6', type: 'empirical', inputs: ['pipeMaterial'], trace: 'mm' });
  S('V_disch', 'I', 'Return pipe velocity', { obj: 'Velocity in the return (discharge) pipeline.',
    eq: 'V_{disch} = Q_d / (π/4 · D_d²)', sub: function (R, n) { return n(R.operating.Qd_m3s) + ' / (π/4 × (' + n(R.inputs.dischargeID / 1000) + ' m)²)'; },
    res: function (R) { return R.velocities.V_disch; }, unit: 'm/s', dim: 'vel', cell: 'B103', inputs: ['dischargeID'], uses: ['Qd'], check: 'vret', trace: 'm³/s ÷ m² → m/s', comp: 'discharge' });
  S('Re', 'I', 'Reynolds number (return pipe)', { obj: 'Flow regime in the return pipe.',
    eq: 'Re = ρ_{sl} · V_{disch} · D_d / μ_{sl}', sub: function (R, n) { return n(R.slurry.rho_sl) + ' × ' + n(R.velocities.V_disch) + ' × ' + n(R.inputs.dischargeID / 1000) + ' / (' + n(R.slurry.mu_sl) + ' × 10⁻³)'; },
    res: function (R) { return R.friction.Re; }, unit: '—', dim: 'ratio', sci: true, cell: 'B104', ref: 'F6.1', uses: ['rho_sl', 'V_disch', 'mu_sl'], check: 'Re',
    note: function (R) { return 'Regime: ' + R.friction.regime + ' (B105).'; }, trace: 'kg/m³ · m/s · m ÷ Pa·s → —', comp: 'discharge' });
  S('f', 'I', 'Darcy friction factor', { obj: 'Friction factor for the return line.',
    eq: 'f = 0.25 / [log₁₀(ε/(3.7·D_d) + 5.74 / Re^{0.9})]²',
    sub: function (R, n) { return R.friction.Re < 2300 ? '64 / ' + n(R.friction.Re) + '   (laminar, Eq. F6.3)' : '0.25 / [log₁₀(' + n(R.friction.eps) + ' / (3.7 × ' + n(R.inputs.dischargeID) + ') + 5.74 / ' + n(R.friction.Re) + '^0.9)]²'; },
    res: function (R) { return R.friction.f; }, unit: '—', dim: 'ratio', cell: 'B106', ref: 'F6.2', type: 'empirical', uses: ['eps', 'Re'],
    assume: ['Swamee & Jain (1976) explicit approximation of Colebrook–White; ε and D both in mm.', 'Valid for Re ≥ 4000 and 10⁻⁶ ≤ ε/D ≤ 10⁻².'], trace: 'dimensionless', comp: 'discharge' });
  S('hf_inlet', 'I', 'Supply-line friction head', { obj: 'Friction head in the motive supply line of length L.',
    eq: 'h_{f,in} = f · (L / D_{motive}) · V_{inlet}² / (2g)',
    sub: function (R, n) { return n(R.friction.f) + ' × (' + n(R.inputs.L_pipe) + ' / ' + n(R.inputs.motiveID / 1000) + ') × ' + n(R.velocities.V_inlet) + '² / (2 × 9.81)'; },
    res: function (R) { return R.friction.hf_inlet; }, unit: 'm', dim: 'head_m', cell: 'B107', ref: 'F6.4', inputs: ['L_pipe', 'motiveID'], uses: ['f', 'v_m'],
    assume: ['Uses the return-line friction factor f, as in the spreadsheet.', 'V_inlet = Q_m / A(D_motive) (sheet B102).'], trace: '— · m/m · (m/s)² ÷ m/s² → m', comp: 'motive' });
  S('dPf_inlet', 'I', 'Supply-line friction loss', { obj: 'Pressure loss upstream of the nozzle.',
    eq: 'ΔP_{f,in} = h_{f,in} · ρ_{carrier} · g / 10⁵', sub: function (R, n) { return n(R.friction.hf_inlet) + ' × ' + n(R.inputs.rho_m) + ' × 9.81 / 10⁵'; },
    res: function (R) { return R.friction.dPf_inlet; }, unit: 'bar', dim: 'pressure_bar', cell: 'B108', ref: 'F6.5', uses: ['hf_inlet'], trace: 'm · kg/m³ · m/s² = Pa → ÷10⁵ → bar', comp: 'motive' });
  S('hf_disch', 'I', 'Return-line friction head', { obj: 'Friction head in the return pipeline.',
    eq: 'h_{f,d} = f · (L / D_d) · V_{disch}² / (2g)', sub: function (R, n) { return n(R.friction.f) + ' × (' + n(R.inputs.L_pipe) + ' / ' + n(R.inputs.dischargeID / 1000) + ') × ' + n(R.velocities.V_disch) + '² / (2 × 9.81)'; },
    res: function (R) { return R.friction.hf_disch; }, unit: 'm', dim: 'head_m', cell: 'B109', ref: 'F6.4', inputs: ['L_pipe', 'dischargeID'], uses: ['f', 'V_disch'], trace: '— · m/m · (m/s)² ÷ m/s² → m', comp: 'discharge' });
  S('dPf_disch', 'I', 'Return-line friction loss', { obj: 'Pressure loss along the return pipeline.',
    eq: 'ΔP_{f,d} = h_{f,d} · ρ_{sl} · g / 10⁵', sub: function (R, n) { return n(R.friction.hf_disch) + ' × ' + n(R.slurry.rho_sl) + ' × 9.81 / 10⁵'; },
    res: function (R) { return R.friction.dPf_disch; }, unit: 'bar', dim: 'pressure_bar', cell: 'B110', ref: 'F6.5', uses: ['hf_disch', 'rho_sl'], trace: 'Pa → bar', comp: 'discharge' });

  /* ---- J · settling */
  S('Vc_D', 'J', 'Critical velocity — Durand', { obj: 'Deposition velocity by Durand (1953).',
    eq: 'V_{c,D} = F_L · √(2g · D_d · (SG_s − 1))', sub: function (R, n) { return n(R.inputs.FL) + ' × √(2 × 9.81 × ' + n(R.inputs.dischargeID / 1000) + ' × (' + n(R.inputs.SG_s) + ' − 1))'; },
    res: function (R) { return R.settling.Vc_D; }, unit: 'm/s', dim: 'vel', cell: 'B114', ref: 'F7.1', type: 'empirical', inputs: ['FL', 'dischargeID', 'SG_s'], trace: '√(m/s² · m) → m/s' });
  S('Vc_W', 'J', 'Critical velocity — Wasp', { obj: 'Deposition velocity by Wasp / Zandi–Govatos.',
    eq: 'V_{c,W} = 3.93 · d_{50}^{1/6} · D_d^{1/3} · (SG_s − 1)^{0.5}', sub: function (R, n) { return '3.93 × ' + n(R.slurry.d50) + '^(1/6) × ' + n(R.inputs.dischargeID / 1000) + '^(1/3) × (' + n(R.inputs.SG_s) + ' − 1)^0.5'; },
    res: function (R) { return R.settling.Vc_W; }, unit: 'm/s', dim: 'vel', cell: 'B115', ref: 'F7.2', type: 'empirical', inputs: ['dischargeID', 'SG_s'], uses: ['d50'],
    assume: ['Empirical correlation with d₅₀ in mm and D in m, exactly as in the sheet.'], trace: 'empirical → m/s' });
  S('Vc', 'J', 'Design critical velocity', { obj: 'Conservative settling velocity.',
    eq: 'V_c = max(V_{c,D}, V_{c,W})', sub: function (R, n) { return 'max(' + n(R.settling.Vc_D) + ', ' + n(R.settling.Vc_W) + ')'; },
    res: function (R) { return R.settling.Vc; }, unit: 'm/s', dim: 'vel', cell: 'B116', ref: 'F7.3', uses: ['Vc_D', 'Vc_W'], check: 'settle', trace: 'm/s' });
  S('V_over_Vc', 'J', 'Return velocity margin', { obj: 'Return-pipe velocity relative to the critical velocity.',
    eq: 'V_{disch} / V_c', sub: function (R, n) { return n(R.velocities.V_disch) + ' / ' + n(R.settling.Vc); },
    res: function (R) { return R.settling.V_over_Vc; }, unit: '—', dim: 'ratio', cell: 'B118', uses: ['V_disch', 'Vc'], trace: 'm/s ÷ m/s → —', comp: 'discharge' });

  /* ---- K · static head */
  S('rise', 'K', 'Drive rise', { obj: 'Elevation gain along the drive.',
    eq: 'Δz_{rise} = L · G / 100', sub: function (R, n) { return n(R.inputs.L_pipe) + ' × ' + n(R.inputs.gradient_G) + ' / 100'; },
    res: function (R) { return R.static.rise; }, unit: 'm', dim: 'len_m', cell: 'B125', inputs: ['L_pipe', 'gradient_G'], trace: 'm × % → m' });
  S('staticHead', 'K', 'Static head', { obj: 'Total static lift on the return side.',
    eq: 'h_{static} = H_{shaft} + max(0, Δz_{rise})', sub: function (R, n) { return n(R.inputs.H_shaft) + ' + max(0, ' + n(R.static.rise) + ')'; },
    res: function (R) { return R.static.staticHead; }, unit: 'm', dim: 'head_m', cell: 'B126', ref: 'F10.1', inputs: ['H_shaft'], uses: ['rise'], trace: 'm + m → m' });
  S('staticP', 'K', 'Static pressure', { obj: 'Static head as pressure.',
    eq: 'P_{static} = h_{static} · ρ_{sl} · g / 10⁵', sub: function (R, n) { return n(R.static.staticHead) + ' × ' + n(R.slurry.rho_sl) + ' × 9.81 / 10⁵'; },
    res: function (R) { return R.static.staticP; }, unit: 'bar', dim: 'pressure_bar', cell: 'B127', uses: ['staticHead', 'rho_sl'], trace: 'Pa → bar' });
  S('totalBackP', 'K', 'Static + friction back-pressure', { obj: 'Back-pressure from static head and return friction.',
    eq: 'P_{back,sf} = P_{static} + ΔP_{f,d}', sub: function (R, n) { return n(R.static.staticP) + ' + ' + n(R.friction.dPf_disch); },
    res: function (R) { return R.static.totalBackP; }, unit: 'bar', dim: 'pressure_bar', cell: 'B128', uses: ['staticP', 'dPf_disch'], trace: 'bar + bar → bar' });

  /* ---- L · cutterhead */
  S('A_face', 'L', 'Cutterhead face area', { obj: 'Excavated face area.',
    eq: 'A_{face} = π/4 · D_{ch}²', sub: function (R, n) { return 'π/4 × (' + n(R.inputs.D_ch / 1000) + ' m)²'; },
    res: function (R) { return R.cutterhead.A_face; }, unit: 'm²', dim: 'area_m2L', cell: 'B134', inputs: ['D_ch'], trace: 'm² → m²' });
  S('Q_exc', 'L', 'Excavation rate', { obj: 'In-situ volume excavated per minute.',
    eq: 'Q_{exc} = A_{face} · ROP', sub: function (R, n) { return n(R.cutterhead.A_face) + ' m² × ' + n(R.inputs.ROP) + ' mm/min'; },
    res: function (R) { return R.cutterhead.Q_exc; }, unit: 'L/min', dim: 'flow_Lmin', cell: 'B135', inputs: ['ROP'], uses: ['A_face'], trace: 'm² × mm/min = L/min' });
  S('Q_bulk', 'L', 'Bulked cuttings volume', { obj: 'Cuttings volume after swell.',
    eq: 'Q_{bulk} = Q_{exc} · f_{sw}', sub: function (R, n) { return n(R.cutterhead.Q_exc) + ' × ' + n(R.inputs.f_sw); },
    res: function (R) { return R.cutterhead.Q_bulk; }, unit: 'L/min', dim: 'flow_Lmin', cell: 'B136', type: 'empirical', inputs: ['f_sw'], uses: ['Q_exc'], trace: 'L/min × — → L/min' });
  S('Q_min', 'L', 'Minimum flow for cuttings', { obj: 'Flow that carries the cuttings at 5 % volume concentration.',
    eq: 'Q_{min} = Q_{bulk} / 0.05', sub: function (R, n) { return n(R.cutterhead.Q_bulk) + ' / 0.05'; },
    res: function (R) { return R.cutterhead.Q_min; }, unit: 'L/min', dim: 'flow_Lmin', cell: 'B137', uses: ['Q_bulk'], check: 'cuttings',
    assume: ['Cuttings transported at C_v = 5 % (sheet B137).'], trace: 'L/min ÷ — → L/min' });
  S('solidVolFrac', 'L', 'Cuttings fraction in the discharge', { obj: 'Share of the discharge flow that is cuttings.',
    eq: 'C_{v,cut} = Q_{bulk} / Q_d', sub: function (R, n) { return n(R.cutterhead.Q_bulk) + ' / ' + n(R.operating.Qd_Lmin); },
    res: function (R) { return R.cutterhead.solidVolFrac; }, unit: '—', dim: 'ratio', cell: 'B138', uses: ['Q_bulk', 'Qd'], trace: 'L/min ÷ L/min → —' });

  /* ---- M · return line */
  S('h_b1', 'M', 'Loss per bend', { obj: 'Minor loss of one 90° bend.',
    eq: 'h_{b1} = K_b · V_{disch}² / (2g)', sub: function (R, n) { return n(R.inputs.K_bend) + ' × ' + n(R.velocities.V_ret) + '² / (2 × 9.81)'; },
    res: function (R) { return R.minor.h_b1; }, unit: 'm', dim: 'head_m', cell: 'B145', inputs: ['K_bend'], uses: ['V_disch'], trace: '(m/s)² ÷ m/s² → m' });
  S('h_bends', 'M', 'Bend losses', { obj: 'Minor loss of all bends.',
    eq: 'h_{bends} = n_b · h_{b1}', sub: function (R, n) { return n(R.inputs.n_bends) + ' × ' + n(R.minor.h_b1); },
    res: function (R) { return R.minor.h_bends; }, unit: 'm', dim: 'head_m', cell: 'B146', ref: 'F10.2', inputs: ['n_bends'], uses: ['h_b1'], trace: '— × m → m' });
  S('h_exit', 'M', 'Exit loss', { obj: 'Minor loss at the pipe exit.',
    eq: 'h_{exit} = K_{exit} · V_{disch}² / (2g)', sub: function (R, n) { return n(R.inputs.K_exit) + ' × ' + n(R.velocities.V_ret) + '² / (2 × 9.81)'; },
    res: function (R) { return R.minor.h_exit; }, unit: 'm', dim: 'head_m', cell: 'B148', ref: 'F10.2', inputs: ['K_exit'], uses: ['V_disch'], trace: '(m/s)² ÷ m/s² → m' });
  S('H_req', 'M', 'Required head at diffuser exit', { obj: 'Head the jet pump must deliver to push Q_d through the return line.',
    eq: 'H_{req} = Δz + h_{f,d} + h_{bends} + h_{exit}', sub: function (R, n) { return n(R.returnLine.dz) + ' + ' + n(R.friction.hf_disch) + ' + ' + n(R.minor.h_bends) + ' + ' + n(R.minor.h_exit); },
    res: function (R) { return R.returnLine.H_req; }, unit: 'm', dim: 'head_m', cell: 'B155', ref: 'F10.3', inputs: ['H_shaft'], uses: ['hf_disch', 'h_bends', 'h_exit'],
    assume: ['Δz = H_shaft (sheet B151).'], trace: 'm + m + m + m → m', comp: 'discharge' });
  S('dP_req', 'M', 'Computed return-line demand', { obj: 'Required head as pressure — cross-check for the manual P_back.',
    eq: 'ΔP_{req} = H_{req} · ρ_{sl} · g / 10⁵', sub: function (R, n) { return n(R.returnLine.H_req) + ' × ' + n(R.slurry.rho_sl) + ' × 9.81 / 10⁵'; },
    res: function (R) { return R.returnLine.dP_req; }, unit: 'bar', dim: 'pressure_bar', cell: 'B156', ref: 'F10.4', uses: ['H_req', 'rho_sl'], check: 'pback', trace: 'Pa → bar', comp: 'discharge' });

  /* ---- N · Bernoulli stations */
  function stTable(R, idx) { var s = R.stations[idx]; return [['P', s.P, 'bar g', 'pressure_g'], ['V', s.V, 'm/s', 'vel'], ['h_s', s.h_static, 'm', 'head_m'], ['h_v', s.h_velocity, 'm', 'head_m'], ['H', s.H_total, 'm', 'head_m']]; }
  S('st1', 'N', 'Station 1 — motive inlet', { obj: 'Motive stream energy upstream of the nozzle.',
    eq: 'P_1 = P_m − ΔP_{f,in};   V_1 = v_m;   H_1 = P_1·10⁵/(ρ_m g) + V_1²/(2g)',
    sub: function (R, n) { var s = R.stations[0]; return 'P₁ = ' + n(R.inputs.Pm) + ' − ' + n(R.friction.dPf_inlet) + ';  H₁ = ' + n(s.P) + '×10⁵/(' + n(s.rho) + '×9.81) + ' + n(s.V) + '²/(2×9.81)'; },
    res: function (R) { return R.stations[0].H_total; }, unit: 'm', dim: 'head_m', cell: 'B70–G70', ref: 'F5.3', uses: ['dPf_inlet', 'v_m'], table: function (R) { return stTable(R, 0); },
    assume: ['Gauge basis, z = 0 datum (Formulas §5).'], trace: 'Pa ÷ (kg/m³ · m/s²) → m', comp: 'motive' });
  S('st2', 'N', 'Station 2 — nozzle exit', { obj: 'Jet static pressure and energy at the nozzle exit.',
    eq: 'P_2 = P_1 − ρ_m · (v_n / C_d)² / (2·10⁵);   V_2 = v_n',
    sub: function (R, n) { return n(R.stations[0].P) + ' − ' + n(R.inputs.rho_m) + ' × (' + n(R.nozzle.v_n) + ' / ' + n(R.inputs.Cd) + ')² / (2 × 10⁵)'; },
    res: function (R) { return R.stations[1].P; }, unit: 'bar g', dim: 'pressure_g', cell: 'B71–G71', uses: ['st1', 'v_n'], table: function (R) { return stTable(R, 1); }, trace: 'kg/m³ · (m/s)² = Pa → bar', comp: 'nozzle' });
  S('st2s', 'N', 'Station 2s — suction inlet', { obj: 'Entrained stream at the suction boundary.',
    eq: 'P_{2s} = P_s;   V_{2s} = v_s;   ρ_{2s} = ρ_{mix}', sub: function (R, n) { return 'P = ' + n(R.inputs.Ps) + ' bar g;  V = ' + n(R.velocities.v_s) + ' m/s;  ρ = ' + n(R.operating.rho_mix) + ' kg/m³'; },
    res: function (R) { return R.stations[2].H_total; }, unit: 'm', dim: 'head_m', cell: 'B72–G72', inputs: ['Ps'], uses: ['v_s', 'rho_mix'], table: function (R) { return stTable(R, 2); }, trace: 'm', comp: 'suction' });
  S('A_ann', 'N', 'Suction annulus at throat entry', { obj: 'Area left for the entrained flow around the jet.',
    eq: 'A_{ann} = A_{th} − π/4 · d_{n,sel}²', sub: function (R, n) { return n(R.throat.A_th) + ' − π/4 × (' + n(R.nozzle.d_n_sel / 1000) + ' m)²'; },
    res: function (R) { return R.throat.A_ann; }, unit: 'm²', dim: 'area_m2', cell: 'B73 (term)', uses: ['A_th', 'd_n_sel'], check: 'annulus', trace: 'm² − m² → m²', comp: 'chamber' });
  S('st3', 'N', 'Station 3 — throat exit (momentum balance)', { obj: 'Mixed-stream pressure after momentum exchange in the throat.',
    eq: 'P_3 = [P_2·A_{n,sel} + P_s·A_{ann} + ρ_m Q_m v_n + ρ_{mix} Q_s (Q_s/A_{ann}) − ρ_{do} Q_d V_3] / A_{th};   V_3 = Q_d / A_{th}',
    sub: function (R, n) { var st = R.stations, o = R.operating; return '[' + n(st[1].P) + '×10⁵ × ' + n(R.nozzle.A_nsel) + ' + ' + n(R.inputs.Ps) + '×10⁵ × ' + n(R.throat.A_ann) + ' + ' + n(R.inputs.rho_m) + ' × ' + n(R.motive.Qm_m3s) + ' × ' + n(R.nozzle.v_n) + ' + ' + n(o.rho_mix) + ' × ' + n(o.Qs_m3s) + ' × (' + n(o.Qs_m3s) + '/' + n(R.throat.A_ann) + ') − ' + n(R.diffuser.rho_do) + ' × ' + n(o.Qd_m3s) + ' × ' + n(st[3].V) + '] / ' + n(R.throat.A_th) + ' / 10⁵'; },
    res: function (R) { return R.stations[3].P; }, unit: 'bar g', dim: 'pressure_g', cell: 'B73–G73', uses: ['st2', 'A_ann', 'rho_do', 'Qd'], table: function (R) { return stTable(R, 3); },
    assume: ['One-dimensional momentum balance over the throat; wall friction neglected.'], trace: '(Pa·m² + kg/m³·m³/s·m/s) ÷ m² → Pa → bar', comp: 'throat' });
  S('st4', 'N', 'Station 4 — diffuser exit', { obj: 'Recovered static pressure at the diffuser outlet.',
    eq: 'P_4 = P_3 + C_r · ½ ρ_{do} (V_3² − V_4²) / 10⁵;   V_4 = v_d',
    sub: function (R, n) { var st = R.stations; return n(st[3].P) + ' + ' + n(R.diffuser.Cr) + ' × 0.5 × ' + n(R.diffuser.rho_do) + ' × (' + n(st[3].V) + '² − ' + n(st[4].V) + '²) / 10⁵'; },
    res: function (R) { return R.stations[4].P; }, unit: 'bar g', dim: 'pressure_g', cell: 'B74–G74', ref: 'F4.5', uses: ['st3', 'Cr', 'v_d'], table: function (R) { return stTable(R, 4); }, check: 'head', trace: 'kg/m³ · (m/s)² = Pa → bar', comp: 'diffuser' });

  /* ---- O · performance */
  S('dH_margin', 'O', 'Static-head margin', { obj: 'Recovered static head against the return-line requirement.',
    eq: 'ΔH = h_{s,4} − H_{req}', sub: function (R, n) { return n(R.stations[4].h_static) + ' − ' + n(R.returnLine.H_req); },
    res: function (R) { return R.diffuserHead.dH_margin; }, unit: 'm', dim: 'head_m', cell: 'B79', uses: ['st4', 'H_req'], check: 'head', trace: 'm − m → m', comp: 'discharge' });
  S('sigma', 'O', 'Cavitation number', { obj: 'Margin against vapour-cavity formation in the jet.',
    eq: 'σ = ((P_s + P_{atm})·10⁵ − P_{vap}) / (½ · ρ_m · v_n²)', sub: function (R, n) { return '((' + n(R.inputs.Ps) + ' + 1.013) × 10⁵ − 2340) / (0.5 × ' + n(R.inputs.rho_m) + ' × ' + n(R.nozzle.v_n) + '²)'; },
    res: function (R) { return R.cavitation.sigma; }, unit: '—', dim: 'ratio', cell: 'B60', ref: 'F9.1', inputs: ['Ps', 'rho_m'], uses: ['v_n'], check: 'sigma',
    assume: ['P_atm = 1.013 bar; P_vap = 2340 Pa (water, 20 °C).'], trace: 'Pa ÷ Pa → —', comp: 'nozzle' });
  S('solidsPassage', 'O', 'Throat-to-particle ratio', { obj: 'Free-passage ratio achieved by the selected throat.',
    eq: 'd_{th} / d_{p,max}', sub: function (R, n) { return n(R.throat.d_th) + ' / ' + n(R.inputs.d_p_max); },
    res: function (R) { return R.validation.solidsPassage; }, unit: '—', dim: 'ratio', cell: 'B62', inputs: ['d_p_max'], uses: ['d_th'], check: 'solids', trace: 'mm ÷ mm → —', comp: 'throat' });
  S('headloss', 'O', 'Component head losses (motive stream)', { obj: 'Energy dissipated in the nozzle, mixing section and diffuser.',
    eq: 'h_{L,n} = H_1 − H_2;  h_{L,mix} = (Q_m/Q_d)·H_2 + (Q_s/Q_d)·H_{2s} − H_3;  h_{L,d} = H_3 − H_4;  h_{L,tot} = H_1 − H_4',
    sub: function (R, n) { var st = R.stations, o = R.operating; return 'h_L,mix = (' + n(R.inputs.Qm_Lmin) + '/' + n(o.Qd_Lmin) + ') × ' + n(st[1].H_total) + ' + (' + n(o.Qs_Lmin) + '/' + n(o.Qd_Lmin) + ') × ' + n(st[2].H_total) + ' − ' + n(st[3].H_total); },
    res: function (R) { return R.headLoss.total; }, unit: 'm', dim: 'head_m', cell: 'Profile B13–B16', uses: ['st1', 'st2', 'st2s', 'st3', 'st4'],
    table: function (R) { var L = R.headLoss; return [['h_{L,n}', L.nozzle, 'm', 'head_m'], ['h_{L,mix}', L.mixing, 'm', 'head_m'], ['h_{L,d}', L.diffuser, 'm', 'head_m'], ['h_{L,tot}', L.total, 'm', 'head_m']]; },
    assume: ['Total drop of the motive stream includes the energy transferred to the entrained stream.'], trace: 'm − m → m' });

  var BYID = {}; STEPS.forEach(function (s, i) { s.no = i + 1; BYID[s.id] = s; });
  root.VJP = root.VJP || {};
  root.VJP.calcsteps = { GROUPS: GROUPS, STEPS: STEPS, BYID: BYID };
})(typeof window !== 'undefined' ? window : this);
