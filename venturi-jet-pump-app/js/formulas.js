/* GOVERNING EQUATIONS — the equations used by the calculation engine,
 * transcribed from the "Formulas" sheet of VENTURI_JET_PUMP_CALCULATOR_v4 and
 * organised for engineering reference. Ids follow the sheet numbering (F1.1 …)
 * where one exists. `steps` lists calculation steps (js/calcsteps.js) that
 * apply the equation; steps whose `ref` equals the id are found automatically.
 * Nothing here is evaluated by the engine — this is documentation. */
(function (root) {
  'use strict';
  var CATS = [
    { id: 'fundamental', title: 'Fundamental equations', tag: 'FUNDAMENTAL', desc: 'Conservation laws applied along the flow path.' },
    { id: 'hydraulic', title: 'Hydraulic equations', tag: 'HYDRAULIC', desc: 'Jet-pump performance, nozzle and return-line relations.' },
    { id: 'empirical', title: 'Empirical correlations', tag: 'EMPIRICAL', desc: 'Correlations fitted to test data — valid only within their stated ranges.' },
    { id: 'criteria', title: 'Design criteria', tag: 'CRITERION', desc: 'Acceptance limits used by Validation.' },
    { id: 'derived', title: 'Derived relationships', tag: 'DERIVED', desc: 'Geometry and property relations that follow from the inputs.' },
    { id: 'assumptions', title: 'Engineering assumptions', tag: 'ASSUMPTION', desc: 'Modelling assumptions behind every result.' }
  ];
  function E(id, cat, name, eq, o) { o = o || {}; o.id = id; o.cat = cat; o.name = name; o.eq = eq; return o; }
  var EQUATIONS = [
    /* ---------------- fundamental ---------------- */
    E('C.1', 'fundamental', 'Continuity (incompressible)', 'Q = V · A = constant', { vars: [['Q', 'volumetric flow', 'm³/s'], ['V', 'mean velocity', 'm/s'], ['A', 'flow area', 'm²']],
      assume: 'Steady, incompressible flow; no storage.', steps: ['v_n', 'v_m', 'v_s', 'v_d', 'V_disch', 'A_n', 'Qd'], refs: ['Fundamental'] }),
    E('F5.3', 'fundamental', 'Bernoulli total head (gauge basis)', 'H = P_g·10⁵ / (ρ·g) + V² / (2g) + z', { vars: [['H', 'total head', 'm'], ['P_g', 'gauge pressure', 'bar g'], ['ρ', 'density', 'kg/m³'], ['V', 'velocity', 'm/s'], ['z', 'elevation (datum 0)', 'm']],
      assume: 'Incompressible, steady; z = 0 datum through the pump; losses appear as a drop in H.', steps: ['st1', 'st2', 'st2s', 'st3', 'st4'], refs: ['Formulas §5'] }),
    E('F5.1', 'fundamental', 'Static (pressure) head', 'h_p = P_g · 10⁵ / (ρ · g)', { vars: [['h_p', 'static head', 'm'], ['P_g', 'gauge pressure', 'bar g'], ['ρ', 'density', 'kg/m³'], ['g', '9.81', 'm/s²']], steps: ['st1', 'st4'] }),
    E('F5.2', 'fundamental', 'Velocity head', 'h_v = V² / (2g)', { vars: [['h_v', 'velocity head', 'm'], ['V', 'velocity', 'm/s']], steps: ['st1', 'st4'] }),
    E('M.1', 'fundamental', 'Throat momentum balance (station 3)', 'P_3·A_{th} = P_2·A_{n,sel} + P_s·A_{ann} + ρ_m Q_m v_n + ρ_{mix} Q_s (Q_s/A_{ann}) − ρ_{do} Q_d V_3', {
      vars: [['P_2, P_s, P_3', 'nozzle-exit, suction, throat-exit pressure', 'Pa'], ['A_{n,sel}, A_{ann}, A_{th}', 'nozzle-exit, annulus, throat area', 'm²'], ['ρ_m, ρ_{mix}, ρ_{do}', 'motive, suction, mixed density', 'kg/m³'], ['Q_m, Q_s, Q_d', 'motive, suction, discharge flow', 'm³/s'], ['v_n, V_3', 'jet and mixed velocity', 'm/s']],
      assume: 'One-dimensional control volume over the throat; wall friction neglected; fully mixed at station 3.', steps: ['A_ann', 'st3'], refs: ['Sheet B73 · Cunningham (1974)'] }),
    E('F6.1', 'fundamental', 'Reynolds number', 'Re = ρ · V · D / μ', { vars: [['ρ', 'density', 'kg/m³'], ['V', 'velocity', 'm/s'], ['D', 'pipe bore', 'm'], ['μ', 'dynamic viscosity (mPa·s × 10⁻³)', 'Pa·s']], refs: ['Fundamental'] }),
    E('F6.4', 'fundamental', 'Darcy–Weisbach friction head', 'h_f = f · (L / D) · V² / (2g)', { vars: [['h_f', 'friction head', 'm'], ['f', 'Darcy friction factor', '—'], ['L', 'pipe length', 'm'], ['D', 'pipe bore', 'm'], ['V', 'velocity', 'm/s']], refs: ['Darcy–Weisbach'] }),
    E('F6.5', 'fundamental', 'Friction pressure drop', 'ΔP_f = h_f · ρ · g / 10⁵', { vars: [['ΔP_f', 'pressure drop', 'bar'], ['ρ', 'density of the pipe content', 'kg/m³']] }),
    E('F6.3', 'fundamental', 'Laminar friction factor', 'f = 64 / Re', { vars: [['f', 'Darcy friction factor', '—']], range: 'Re < 2300', steps: ['f'], refs: ['Hagen–Poiseuille'] }),

    /* ---------------- hydraulic ---------------- */
    E('F1.1', 'hydraulic', 'Theoretical nozzle exit velocity', 'v_{n,th} = C_d · √(2 · ΔP / ρ_m),   ΔP = P_m − P_s', { vars: [['v_{n,th}', 'theoretical jet velocity', 'm/s'], ['C_d', 'nozzle discharge coefficient', '—'], ['ΔP', 'available pressure difference', 'Pa'], ['ρ_m', 'motive density', 'kg/m³']],
      range: 'C_d ≈ 0.93–0.97', refs: ['Cunningham (1974)'] }),
    E('F1.2', 'hydraulic', 'Nozzle exit area (continuity)', 'A_n = Q_m / v_{n,th}', { vars: [['A_n', 'flow-sized exit area', 'm²'], ['Q_m', 'motive flow', 'm³/s']] }),
    E('F1.4', 'hydraulic', 'Hydraulic power of the motive jet', 'P_{hyd} = Q_m · ΔP', { vars: [['P_{hyd}', 'hydraulic power (W ÷ 1000 → kW)', 'kW']] }),
    E('F3.1', 'hydraulic', 'Dimensionless head ratio', 'H = (P_d − P_s) / (P_m − P_d)', { vars: [['P_d', 'discharge pressure', 'bar g'], ['P_s', 'suction pressure', 'bar g'], ['P_m', 'motive pressure', 'bar g']], range: 'Typ. 0.05–0.50', refs: ['Cunningham (1974)'] }),
    E('F3.2', 'hydraulic', 'Entrainment (flow) ratio', 'M = Q_s / Q_m = η_{jp} / H', { vars: [['M', 'entrainment ratio', '—'], ['η_{jp}', 'jet-pump efficiency (design target)', '—']], range: 'Slurry M ≈ 0.5–5', refs: ['Sanger (1970)'] }),
    E('F3.3', 'hydraulic', 'Jet pump efficiency', 'η_{jp} = M · H', { vars: [['η_{jp}', 'efficiency', '—']], range: 'Slurry 0.18–0.28', steps: ['M'] }),
    E('F3.4', 'hydraulic', 'Total discharge flow', 'Q_d = Q_m + Q_s = Q_m · (1 + M)', { vars: [['Q_d', 'discharge flow', 'L/min']] }),
    E('F3.5', 'hydraulic', 'Mixed stream density', 'ρ_{do} = (ρ_m · Q_m + ρ_{mix} · Q_s) / (Q_m + Q_s)', { vars: [['ρ_{do}', 'mass-flow-weighted density', 'kg/m³']] }),
    E('F4.5', 'hydraulic', 'Diffuser exit pressure', 'P_4 = P_3 + C_r · ½ · ρ_{do} · (V_3² − V_4²)', { vars: [['C_r', 'pressure recovery coefficient', '—'], ['V_3, V_4', 'throat and diffuser-exit velocity', 'm/s']], refs: ['Sanger (1970) · ESDU 85032'] }),
    E('F9.1', 'hydraulic', 'Cavitation number', 'σ = (P_{s,abs} − P_{vap}) / (½ · ρ_m · v_n²)', { vars: [['P_{s,abs}', 'absolute suction pressure (P_s + 1.013 bar)', 'Pa'], ['P_{vap}', 'vapour pressure', 'Pa'], ['v_n', 'jet velocity', 'm/s']] }),
    E('F10.1', 'hydraulic', 'Static head (return side)', 'h_{static} = H_{shaft} + max(0, L · G / 100)', { vars: [['H_{shaft}', 'shaft depth', 'm'], ['L', 'drive length', 'm'], ['G', 'drive gradient', '%']], steps: ['rise', 'staticHead'] }),
    E('F10.2', 'hydraulic', 'Minor losses', 'h_{minor} = (n_b · K_b + K_{exit}) · V_d² / (2g)', { vars: [['n_b', 'number of 90° bends', '—'], ['K_b, K_{exit}', 'loss coefficients', '—']], steps: ['h_b1', 'h_bends', 'h_exit'] }),
    E('F10.3', 'hydraulic', 'Required head at the diffuser exit', 'H_{req} = Δz + h_{f,d} + h_{bends} + h_{exit}', { vars: [['H_{req}', 'head required by the return line', 'm']] }),
    E('F10.4', 'hydraulic', 'Return-line back-pressure', 'ΔP_{req} = H_{req} · ρ_{sl} · g / 10⁵', { vars: [['ΔP_{req}', 'computed demand (cross-checks the manual P_back)', 'bar']] }),
    E('F10.5', 'hydraulic', 'Required discharge pressure', 'P_d = P_s + P_{back}', { vars: [['P_{back}', 'back-pressure (manual input)', 'bar g']] }),

    /* ---------------- empirical ---------------- */
    E('F6.2', 'empirical', 'Swamee–Jain friction factor (turbulent)', 'f = 0.25 / [log₁₀(ε / (3.7·D) + 5.74 / Re^{0.9})]²', { vars: [['ε', 'wall roughness', 'mm'], ['D', 'pipe bore', 'mm'], ['Re', 'Reynolds number', '—']],
      range: 'Re ≥ 4000; 10⁻⁶ ≤ ε/D ≤ 10⁻²', refs: ['Swamee & Jain (1976)'] }),
    E('F6.6', 'empirical', 'Pipe wall roughness', 'ε: MS steel 0.046 | HDPE 0.007 | cast iron 0.26 | GRP/FRP 0.01 mm', { vars: [['ε', 'absolute roughness', 'mm']], refs: ['Moody (1944)'] }),
    E('F7.1', 'empirical', 'Durand critical settling velocity', 'V_{c,D} = F_L · √(2 · g · D · (SG_s − 1))', { vars: [['F_L', 'Durand coefficient (0.9 fine → 1.34 coarse)', '—'], ['D', 'pipe bore', 'm'], ['SG_s', 'solid specific gravity', '—']], refs: ['Durand (1953)'] }),
    E('F7.2', 'empirical', 'Wasp / Zandi–Govatos critical velocity', 'V_{c,W} = 3.93 · d_{50}^{1/6} · D^{1/3} · (SG_s − 1)^{0.5}', { vars: [['d_{50}', 'median particle size (mm, as in the correlation)', 'mm'], ['D', 'pipe bore', 'm']], range: 'Dimensional correlation — units as stated', refs: ['Wasp, Kenny & Gandhi (1977)'] }),
    E('F8.4', 'empirical', 'Slurry viscosity (Thomas)', 'μ_{sl} = μ_w · [1 + 2.5·C_v + 10.05·C_v² + 0.00273·e^{16.6·C_v}]', { vars: [['μ_w', 'carrier viscosity 1.002', 'mPa·s'], ['C_v', 'volume concentration', '—']], range: 'C_v < 0.60', refs: ['Thomas (1965)'] }),
    E('F28', 'empirical', 'Nozzle bore factor', 'd_{n,sel} = k_{bore} · d_n,   k_{bore} = 1.15 (default)', { vars: [['k_{bore}', 'bore enlargement factor', '—']], range: 'Undocumented in the sheet — exposed as an editable coefficient', steps: ['d_n_sel'], refs: ['Spreadsheet F28'] }),
    E('F1.6', 'empirical', 'Nozzle–throat spacing', 's ≈ 0.5 · d_{th}', { vars: [['s', 'nozzle exit to throat entry', 'mm']], range: '0.5–1.0 · d_th', refs: ['Mueller (1964)'] }),

    /* ---------------- criteria ---------------- */
    E('F9.2', 'criteria', 'Cavitation criterion', 'σ ≥ 0.20', { vars: [['σ', 'cavitation number', '—']], steps: ['sigma'], check: 'sigma', refs: ['Jet-pump industry practice'] }),
    E('B63', 'criteria', 'Solids passage', 'd_{th} / d_{p,max} ≥ MFPR (min 5)', { vars: [['MFPR', 'minimum free-passage ratio', '—']], steps: ['solidsPassage'], check: 'solids', refs: ['Design rule'] }),
    E('F17', 'criteria', 'Head-ratio window', '0.05 ≤ H ≤ 0.50', { check: 'H', steps: ['H'] }),
    E('B64', 'criteria', 'Entrainment plausibility', '0.5 ≤ M ≤ 5', { check: 'M', steps: ['M'] }),
    E('F27', 'criteria', 'Area-ratio window', '0.01 ≤ R ≤ 0.16', { check: 'R', steps: ['R_ratio'], refs: ['Mueller (1964)'] }),
    E('F33', 'criteria', 'Diffuser half-angle window', '3° ≤ α_d ≤ 6°', { check: 'alpha_d', refs: ['ESDU 85032'] }),
    E('F35', 'criteria', 'Diffuser length window', '4 ≤ L_d / d_{th} ≤ 8', { check: 'Ld', refs: ['Sanger (1970)'] }),
    E('F51', 'criteria', 'Nozzle erosion limit', 'v_n ≤ 35 m/s', { check: 'vn', steps: ['v_n'] }),
    E('F7.4', 'criteria', 'Settling margin', 'V ≥ 1.2 · V_c', { check: 'settle', steps: ['Vc', 'v_d'] }),
    E('B80', 'criteria', 'Head adequacy', 'h_{s,4} ≥ H_{req}', { check: 'head', steps: ['dH_margin'] }),
    E('B139', 'criteria', 'Cuttings removal', 'Q_d ≥ Q_{min} = Q_{bulk} / 0.05', { check: 'cuttings', steps: ['Q_min'] }),

    /* ---------------- derived ---------------- */
    E('F1.3', 'derived', 'Nozzle exit diameter', 'd_n = √(4 · A_n / π)', { vars: [['d_n', 'flow-sized exit diameter (× 1000 → mm)', 'mm']] }),
    E('F1.5', 'derived', 'Nozzle convergence length', 'L_n = (D_{n,in} − d_{n,sel}) / (2 · tan α_n)', { vars: [['α_n', 'nozzle half-angle', '°']], range: 'α_n typ. 10°–22.5°' }),
    E('F2.1', 'derived', 'Particle-passage throat', 'd_{th,p} = d_{p,max} · MFPR · SF', { vars: [['SF', 'safety factor (1.2–1.5)', '—']] }),
    E('F2.2', 'derived', 'Hydraulic throat', 'd_{th,h} = d_{n,sel} / r,   r = d_n / d_{th}', { vars: [['r', 'nozzle-to-throat ratio (0.30–0.50)', '—']] }),
    E('F2.3', 'derived', 'Selected throat diameter', 'd_{th} = max(d_{th,p}, d_{th,h})', {}),
    E('F2.4', 'derived', 'Throat area', 'A_{th} = (π/4) · d_{th}²', {}),
    E('F2.5', 'derived', 'Throat length', 'L_{th} = k_{th} · d_{th}', { vars: [['k_{th}', 'throat length multiplier (6–10)', '—']] }),
    E('F2.6', 'derived', 'Area ratio', 'R = A_n / A_{th}', {}),
    E('F4.1', 'derived', 'Diffuser length', 'L_d = (L_d / d_{th}) · d_{th}', {}),
    E('F4.2', 'derived', 'Diffuser outlet diameter', 'd_{diff} = d_{th} + 2 · L_d · tan α_d', { vars: [['α_d', 'diffuser half-angle', '°']] }),
    E('F4.3', 'derived', 'Diffuser area ratio', 'AR_d = (d_{diff} / d_{th})²', { range: 'Typ. 1.5–4.0' }),
    E('F4.4', 'derived', 'Pressure recovery coefficient (ideal estimate)', 'C_r ≈ 1 − (d_{th} / d_{diff})⁴', { range: 'Ideal C_r = 1; achieved 0.7–0.9' }),
    E('F7.3', 'derived', 'Design critical velocity', 'V_c = max(V_{c,D}, V_{c,W})', {}),
    E('F8.1', 'derived', 'Slurry specific gravity', 'SG_{sl} = SG_s / [SG_s − C_w · (SG_s − 1)]', { vars: [['C_w', 'weight concentration (fraction)', '—']] }),
    E('F8.2', 'derived', 'Slurry density', 'ρ_{sl} = SG_{sl} · ρ_{carrier}', {}),
    E('F8.3', 'derived', 'Volume concentration', 'C_v = C_w · SG_{sl} / SG_s', {}),

    /* ---------------- assumptions ---------------- */
    E('A.1', 'assumptions', 'Flow model', 'Steady · incompressible · one-dimensional', { assume: 'Bernoulli station analysis on a gauge basis with a z = 0 datum through the pump.' }),
    E('A.2', 'assumptions', 'Physical constants', 'g = 9.81 m/s² · P_{atm} = 1.013 bar · P_{vap} = 2340 Pa', { assume: 'Water vapour pressure at 20 °C.' }),
    E('A.3', 'assumptions', 'Carrier fluid', 'ρ_{carrier} = ρ_m · μ_w = 1.002 mPa·s', { assume: 'The suction slurry is carried in the motive fluid (bentonite).' }),
    E('A.4', 'assumptions', 'Particle gradation', 'd_{50} = 0.4 · d_{p,max}', { assume: 'Used only in the Wasp settling correlation.', steps: ['d50'] }),
    E('A.5', 'assumptions', 'Cuttings transport', 'Q_{min} at C_v = 5 %', { assume: 'Minimum flow that carries the bulked cuttings.', steps: ['Q_min'] }),
    E('A.6', 'assumptions', 'Back-pressure', 'P_{back} manual — not iterated', { assume: 'Cross-checked against ΔP_req; adopt the computed value when appropriate.' }),
    E('A.7', 'assumptions', 'Visualization', 'Profiles & flow visualization ≠ CFD', { assume: 'Physics-based reconstructions anchored to the calculated station values; no turbulence, multiphase or transient simulation.' })
  ];
  var BYID = {}; EQUATIONS.forEach(function (e) { BYID[e.id] = e; });

  var REFERENCES = [
    'Cunningham, R.G. (1974). "Gas Compression with the Liquid Jet Pump." ASME J. Fluids Eng.',
    'Mueller, N.H.G. (1964). "Water Jet Pump." ASCE J. Hydraulics Div., 90(3): 83–113.',
    'Sanger, N.L. (1970). "An Experimental Investigation of Several Low-Area-Ratio Water Jet Pumps." ASME J. Basic Eng.',
    'ESDU 85032: "Ejectors and jet pumps — design for steady flow with incompressible liquid as primary fluid."',
    'Durand, R. (1953). "Basic Relationships of the Transportation of Solids in Pipes." Proc. Minnesota Int. Hydraulics Conv.',
    'Wasp, E.J., Kenny, J.P., Gandhi, R.L. (1977). "Solid–Liquid Flow Slurry Pipeline Transportation." Trans Tech Publ.',
    'Thomas, D.G. (1965). "Transport Characteristics of Suspensions VIII." J. Colloid Sci. 20: 267–277.',
    'Swamee, P.K., Jain, A.K. (1976). "Explicit Equations for Pipe-Flow Problems." ASCE J. Hydraulics Div., 102(5): 657–664.',
    'Moody, L.F. (1944). "Friction Factors for Pipe Flow." Trans. ASME 66: 671–684.',
    'Wilson, K.C., Addie, G.R., Sellgren, A., Clift, R. (2006). "Slurry Transport Using Centrifugal Pumps." 3rd Ed., Springer.'
  ];

  root.VJP = root.VJP || {};
  root.VJP.formulas = { CATS: CATS, EQUATIONS: EQUATIONS, BYID: BYID, REFERENCES: REFERENCES };
})(typeof window !== 'undefined' ? window : this);
