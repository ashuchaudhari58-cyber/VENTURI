/* ENGINEERING VALIDATION — structured, explainable checks derived from the
 * authoritative engine results (js/engine.js). Nothing here changes the model:
 *
 *  1. Field validation   hard physical limits (block) vs recommended ranges (warn)
 *  2. Blockers           conditions under which the calculation cannot proceed
 *  3. Checks             every engine acceptance criterion (same thresholds as
 *                        engine buildFlags — verified by tests/model.test.js), plus
 *                        geometry-validity items, advisory checks and the
 *                        modelling assumptions, each with value / requirement /
 *                        basis / responsible parameters / recommended action.
 *
 * Status of the design is decided ONLY by blockers and criteria — advisories
 * are review items; notes are never pass/fail.
 * ========================================================================== */
(function (root) {
  'use strict';
  var S = root.VJP.schema;

  var CATEGORIES = [
    { id: 'geometry',    title: 'Geometry validity',          desc: 'Buildable, internally consistent geometry and proportioning ratios.' },
    { id: 'particle',    title: 'Particle passage',           desc: 'Clearance for the largest solids through the throat.' },
    { id: 'hydraulic',   title: 'Hydraulic limits',           desc: 'Operating point, entrainment and cuttings-removal capacity.' },
    { id: 'velocity',    title: 'Velocity constraints',       desc: 'Settling and wear limits at the diffuser exit.' },
    { id: 'cavitation',  title: 'Cavitation',                 desc: 'Vapour-cavity margin in the high-velocity motive jet.' },
    { id: 'recovery',    title: 'Pressure recovery',          desc: 'Diffuser proportions and head delivered against the return line.' },
    { id: 'reynolds',    title: 'Reynolds regime',            desc: 'Flow regime and friction-correlation validity in the return line.' },
    { id: 'pipes',       title: 'Pipe / connection compatibility', desc: 'Connection velocities and bore matching at the outlet.' },
    { id: 'limits',      title: 'Material / design limits',   desc: 'Erosion limits and correlation validity ranges.' },
    { id: 'assumptions', title: 'Engineering assumptions',    desc: 'Modelling assumptions behind every result — informational, not pass/fail.' }
  ];

  var KINDS = {
    validity:  { label: 'Validity',  desc: 'Physical validity — a failure blocks the calculation.' },
    criterion: { label: 'Criterion', desc: 'Design acceptance criterion from the spreadsheet model — decides the design status.' },
    advisory:  { label: 'Advisory',  desc: 'Engineering review item — does not change the design status.' },
    note:      { label: 'Assumption', desc: 'Modelling assumption — informational.' }
  };

  /* ---------------------------------------------------------------- fields */
  // returns { status: 'ok'|'warn'|'error', code, rec, hard }
  function validateField(fld, value, rawInvalid) {
    if (fld.select) return { status: 'ok', code: 'ok' };
    if (rawInvalid !== undefined) {
      var t = String(rawInvalid).trim();
      return { status: 'error', code: t === '' ? 'empty' : 'nan' };
    }
    var v = Number(value);
    if (value === '' || value === null || value === undefined) return { status: 'error', code: 'empty' };
    if (!isFinite(v)) return { status: 'error', code: 'nan' };
    var h = fld.hard || {};
    if ((h.gt !== undefined && !(v > h.gt)) || (h.ge !== undefined && !(v >= h.ge)) ||
        (h.lt !== undefined && !(v < h.lt)) || (h.le !== undefined && !(v <= h.le)))
      return { status: 'error', code: 'hard' };
    if (h.int && Math.abs(v - Math.round(v)) > 1e-9) return { status: 'error', code: 'int' };
    if (fld.rec) {
      if (v < fld.rec[0]) return { status: 'warn', code: 'low' };
      if (v > fld.rec[1]) return { status: 'warn', code: 'high' };
      return { status: 'ok', code: 'ok' };
    }
    return { status: 'ok', code: 'valid' };
  }

  // Human-readable hard-limit statement, units-aware via formatter f
  function hardText(fld, f) {
    var h = fld.hard || {}, parts = [];
    function v(x) { return f.q(x, fld.dim, 4); }
    if (h.gt !== undefined) parts.push('greater than ' + v(h.gt));
    if (h.ge !== undefined) parts.push('at least ' + v(h.ge));
    if (h.lt !== undefined) parts.push('less than ' + v(h.lt));
    if (h.le !== undefined) parts.push('at most ' + v(h.le));
    if (h.int) parts.push('a whole number');
    return parts.length ? 'Must be ' + parts.join(' and ') : 'Must be a finite number';
  }

  function validateInputs(inputs, invalid) {
    var out = {}, errors = [], warns = [];
    S.FIELDS.forEach(function (fld) {
      var r = validateField(fld, inputs[fld.key], invalid ? invalid[fld.key] : undefined);
      out[fld.key] = r;
      if (r.status === 'error') errors.push(fld.key);
      else if (r.status === 'warn') warns.push(fld.key);
    });
    return { fields: out, errors: errors, warns: warns };
  }

  /* -------------------------------------------------------------- blockers */
  function fin(x) { return typeof x === 'number' && isFinite(x); }

  function findBlockers(R, i, fv) {
    var B = [];
    fv.errors.forEach(function (k) {
      var fld = S.BYKEY[k], code = fv.fields[k].code;
      B.push({
        id: 'field:' + k, kind: 'input', params: [k],
        title: fld.name + (code === 'empty' ? ' — value required' : ' — outside physical limits'),
        problem: function (f) {
          if (code === 'empty') return fld.name + ' (' + S.symText(fld.sym) + ') has no value.';
          if (code === 'nan') return fld.name + ' (' + S.symText(fld.sym) + ') is not a number.';
          return fld.name + ' = ' + f.q(Number(i[k]), fld.dim) + ' is not physically valid. ' + hardText(fld, f) + '.';
        },
        why: 'The engine would otherwise fall back to a default or produce a meaningless result, so no result is shown.',
        action: function (f) {
          return code === 'empty' || code === 'nan' ? 'Enter a numeric value' + (fld.rec ? ' (recommended ' + f.range(fld.rec, fld.dim) + ').' : '.')
            : hardText(fld, f) + (fld.rec ? '; recommended ' + f.range(fld.rec, fld.dim) + '.' : '.');
        }
      });
    });
    if (fv.errors.length) return B; // downstream checks meaningless until inputs are valid

    var Pd = i.Ps + i.Pback;
    if (!(i.Pm - Pd > 0.001)) {
      B.push({
        id: 'pd', kind: 'operating', params: ['Pm', 'Ps', 'Pback'],
        title: 'Motive pressure does not exceed discharge pressure',
        problem: function (f) { return 'Motive pressure P_m = ' + f.q(i.Pm, 'pressure_g') + ' does not exceed the discharge pressure P_d = P_s + P_back = ' + f.q(Pd, 'pressure_g') + '.'; },
        why: 'The head ratio H = (P_d − P_s)/(P_m − P_d) is undefined: the motive jet cannot pump against this back-pressure.',
        action: function (f) { return 'Raise P_m above ' + f.q(Pd, 'pressure_g') + ', or reduce P_back / P_s.'; }
      });
      return B;
    }
    if (!(R.nozzle.L_n > 0)) {
      B.push({
        id: 'nozzle', kind: 'geometry', params: ['motiveID', 'Qm_Lmin', 'Pm', 'Cd', 'nozzleExitFactor'],
        title: 'Nozzle cannot converge',
        problem: function (f) { return 'The computed nozzle exit bore d_n,sel = ' + f.q(R.nozzle.d_n_sel, 'len_mm') + ' is not smaller than the motive inlet pipe ID D_n,in = ' + f.q(i.motiveID, 'len_mm') + ' (L_n = ' + f.q(R.nozzle.L_n, 'len_mm') + ').'; },
        why: 'A converging nozzle is required to accelerate the motive flow; this geometry cannot be built.',
        action: function (f) { return 'Increase the motive inlet pipe ID well above ' + f.q(R.nozzle.d_n_sel, 'len_mm') + ', or reduce Q_m.'; }
      });
    }
    if (!(R.throat.d_th > R.nozzle.d_n_sel) || !(R.throat.A_ann > 0)) {
      B.push({
        id: 'annulus', kind: 'geometry', params: ['rec_dn_dth', 'd_p_max', 'SF', 'MFPR'],
        title: 'No suction annulus at the throat entry',
        problem: function (f) { return 'The throat d_th = ' + f.q(R.throat.d_th, 'len_mm') + ' is not larger than the nozzle exit d_n,sel = ' + f.q(R.nozzle.d_n_sel, 'len_mm') + '.'; },
        why: 'The momentum balance (station 3) needs a positive annular area A_ann = A_th − A_n,sel for the entrained flow.',
        action: function () { return 'Reduce the nozzle-to-throat ratio r below 1 (typ. 0.30–0.50).'; }
      });
    }
    var KEY = [
      ['Throat diameter', R.throat.d_th], ['Nozzle exit velocity', R.nozzle.v_n], ['Head ratio', R.operating.H],
      ['Entrainment ratio', R.operating.M], ['Total discharge', R.operating.Qd_Lmin], ['Diffuser exit diameter', R.diffuser.d_diff],
      ['Throat exit pressure', R.stations[3].P], ['Diffuser exit pressure', R.stations[4].P], ['Cavitation number', R.cavitation.sigma],
      ['Reynolds number', R.friction.Re], ['Friction factor', R.friction.f], ['Critical settling velocity', R.settling.Vc],
      ['Required head', R.returnLine.H_req]
    ];
    var bad = KEY.filter(function (k) { return !fin(k[1]); }).map(function (k) { return k[0]; });
    if (bad.length) {
      B.push({
        id: 'nonfinite', kind: 'numeric', params: [],
        title: 'Non-finite result',
        problem: function () { return 'The calculation produced a non-finite value for: ' + bad.join(', ') + '.'; },
        why: 'A division by zero or square root of a negative number occurred — the input combination is outside the model’s domain.',
        action: function () { return 'Review the inputs listed as warnings; return them toward the recommended ranges.'; }
      });
    }
    return B;
  }

  /* ---------------------------------------------------------------- checks */
  // req: { min?, max?, dim, sym } -> margin to the nearest limit (fraction)
  function margin(value, req) {
    if (!fin(value)) return null;
    var m = [];
    if (req.min !== undefined && req.min !== 0) m.push((value - req.min) / Math.abs(req.min));
    if (req.min === 0) m.push(value > 0 ? Infinity : -Infinity);
    if (req.max !== undefined && req.max !== 0) m.push((req.max - value) / Math.abs(req.max));
    return m.length ? Math.min.apply(null, m) : null;
  }

  function buildChecks(R, i) {
    var C = [];
    function add(c) {
      c.margin = c.req ? margin(c.value, c.req) : null;
      C.push(c);
    }
    var lvl = function (b) { return b ? 'pass' : 'review'; };
    var v_d = R.velocities.v_d, Vc = R.velocities.Vc;
    var r_act = R.nozzle.d_n_sel / R.throat.d_th; // same expression as engine buildFlags (F30)

    /* ---- Geometry validity (blocking when failed) ---- */
    add({ id: 'convergent', cat: 'geometry', kind: 'validity', name: 'Nozzle convergence',
      what: 'Motive inlet bore exceeds the selected nozzle exit bore, giving a positive nozzle length.',
      value: R.nozzle.L_n, dim: 'len_mm', sym: 'L_n', req: { min: 0, dim: 'len_mm', op: '>' },
      reqText: function (f) { return 'D_{n,in} > d_{n,sel}   (L_n > 0)'; },
      status: R.nozzle.L_n > 0 ? 'pass' : 'fail', basis: 'Geometric validity · Eq. F1.5 (sheet B36)',
      params: ['motiveID', 'alpha_n'], component: 'nozzle' });
    add({ id: 'annulus', cat: 'geometry', kind: 'validity', name: 'Suction annulus at throat entry',
      what: 'Throat area exceeds the nozzle exit area, leaving an annulus for the entrained flow.',
      value: R.throat.A_ann, dim: 'area_m2', sym: 'A_{ann}', req: { min: 0, dim: 'area_m2', op: '>' },
      reqText: function () { return 'A_{ann} = A_{th} − A_{n,sel} > 0'; },
      status: R.throat.A_ann > 0 ? 'pass' : 'fail', basis: 'Momentum balance validity · sheet B73',
      params: ['rec_dn_dth'], component: 'chamber' });

    /* ---- Criteria (mirror engine buildFlags exactly) ---- */
    add({ id: 'R', cat: 'geometry', kind: 'criterion', name: 'Area ratio',
      what: 'Nozzle-to-throat area ratio R = A_n / A_th within the slurry jet-pump range.',
      value: R.throat.R_ratio, dim: 'ratio', sym: 'R', req: { min: 0.01, max: 0.16, dim: 'ratio' },
      status: lvl(R.throat.R_in_range), basis: 'Mueller (1964) slurry range · sheet F27', ref: 'F2.6',
      why: 'Area ratio controls the head–flow characteristic; outside the range the pump operates far from its efficient region.',
      action: function () { return 'Adjust Q_m or the pipe / throat sizing (r, d_p,max) to bring R into 0.01–0.16.'; },
      params: ['Qm_Lmin', 'Pm', 'rec_dn_dth', 'd_p_max'], component: 'throat' });
    add({ id: 'r', cat: 'geometry', kind: 'criterion', name: 'Nozzle-to-throat diameter ratio',
      what: 'Achieved r = d_n,sel / d_th against the recommended design ratio.',
      value: r_act, dim: 'ratio', sym: 'r', req: { min: i.rec_dn_dth - 0.05, max: i.rec_dn_dth + 0.05, dim: 'ratio' },
      reqText: function (f) { return '|r − r_{rec}| ≤ 0.05   (r_{rec} = ' + f.n(i.rec_dn_dth, 3) + ')'; },
      status: lvl(Math.abs(r_act - i.rec_dn_dth) <= 0.05), basis: 'Design ratio check · sheet F30', ref: 'F2.2',
      why: 'When particle passage enlarges the throat, the achieved ratio falls below the hydraulic optimum.',
      action: function () { return 'Particle passage governs the throat: raise P_m / Q_m to enlarge d_n, or accept the lower ratio after review.'; },
      params: ['rec_dn_dth', 'Pm', 'Qm_Lmin', 'd_p_max', 'SF', 'MFPR'], component: 'throat' });
    add({ id: 'solids', cat: 'particle', kind: 'criterion', name: 'Throat-to-particle ratio',
      what: 'Throat diameter relative to the largest particle (free-passage ratio).',
      value: R.validation.solidsPassage, dim: 'ratio', sym: 'd_{th}/d_{p,max}', req: { min: i.MFPR, dim: 'ratio' },
      status: R.validation.solidsPass ? 'pass' : (R.validation.solidsMarginal ? 'review' : 'fail'),
      basis: 'Design rule · minimum free-passage ratio · sheet B62–B63', ref: 'F2.1',
      why: 'With insufficient clearance the largest solids can bridge the throat and block the pump.',
      action: function () { return 'Increase SF / MFPR so particle passage sizes the throat, or screen the solids to reduce d_p,max.'; },
      params: ['d_p_max', 'SF', 'MFPR'], component: 'throat' });
    add({ id: 'H', cat: 'hydraulic', kind: 'criterion', name: 'Head ratio',
      what: 'Dimensionless head ratio H = (P_d − P_s)/(P_m − P_d) within the jet-pump operating range.',
      value: R.operating.H, dim: 'ratio', sym: 'H', req: { min: 0.05, max: 0.5, dim: 'ratio' },
      status: lvl(R.operating.H_in_range), basis: 'Cunningham (1974) · sheet F16–F17', ref: 'F3.1',
      why: 'High H means the jet cannot develop the discharge pressure economically; very low H wastes motive energy.',
      action: function () { return R.operating.H > 0.5 ? 'Increase motive pressure P_m or reduce back-pressure P_back.' : 'Reduce motive pressure P_m — excess motive energy.'; },
      params: ['Pm', 'Ps', 'Pback'], component: 'nozzle' });
    add({ id: 'M', cat: 'hydraulic', kind: 'criterion', name: 'Entrainment ratio',
      what: 'Suction-to-motive flow ratio M = η_jp / H plausible for slurry service.',
      value: R.operating.M, dim: 'ratio', sym: 'M', req: { min: 0.5, max: 5, dim: 'ratio' },
      status: lvl(R.validation.M_ok), basis: 'Slurry jet-pump practice · sheet B64', ref: 'F3.2',
      why: 'Outside 0.5–5 the assumed efficiency and head ratio are not consistent with slurry jet-pump performance data.',
      action: function () { return R.operating.M < 0.5 ? 'Under-entrained: reduce H (lower P_back or raise P_m) or review η_jp.' : 'Over-entrained: review η_jp and H.'; },
      params: ['eta_jp', 'Pm', 'Ps', 'Pback'], component: 'chamber' });
    add({ id: 'cuttings', cat: 'hydraulic', kind: 'criterion', name: 'Cuttings removal capacity',
      what: 'Total discharge flow against the minimum flow that carries the excavated cuttings at C_v = 5 %.',
      value: R.operating.Qd_Lmin, dim: 'flow_Lmin', sym: 'Q_d', req: { min: R.cutterhead.Q_min, dim: 'flow_Lmin', sym: 'Q_{min}' },
      status: R.cutterhead.cuttingsOK ? 'pass' : 'fail', basis: 'Cutterhead excavation balance · sheet B135–B139',
      why: 'If the jet pump discharges less than the cuttings require, spoil accumulates at the face.',
      action: function () { return 'Increase Q_m (or η_jp / M), or reduce the rate of penetration ROP.'; },
      params: ['Qm_Lmin', 'eta_jp', 'ROP', 'D_ch', 'f_sw'], component: 'discharge' });
    add({ id: 'settle', cat: 'velocity', kind: 'criterion', name: 'Settling margin at diffuser exit',
      what: 'Diffuser exit velocity against 1.2 × the critical settling velocity.',
      value: v_d, dim: 'vel', sym: 'v_d', req: { min: 1.2 * Vc, dim: 'vel', sym: '1.2·V_c' },
      status: v_d >= Vc * 1.2 ? 'pass' : (v_d >= Vc ? 'review' : 'fail'),
      basis: 'Durand (1953) / Wasp (1977) · sheet B65 · Eq. F7.4', ref: 'F7.4',
      why: 'Below the critical velocity solids settle in the diffuser and return line, raising losses and blockage risk.',
      action: function () { return 'Reduce α_d or L_d/d_th (smaller diffuser exit), or increase flow.'; },
      params: ['alpha_d', 'Ld_dth', 'dischargeID', 'SG_s', 'FL', 'Qm_Lmin'], component: 'diffuser' });
    add({ id: 'vmax', cat: 'velocity', kind: 'criterion', name: 'Diffuser exit velocity limit',
      what: 'Diffuser exit velocity against the wear-limited maximum velocity.',
      value: v_d, dim: 'vel', sym: 'v_d', req: { max: i.Vmax, dim: 'vel', sym: 'V_{max}' },
      status: lvl(v_d <= i.Vmax), basis: 'Wear limit · part of overall check B66',
      why: 'Velocities above the wear limit accelerate abrasion of the diffuser and return line.',
      action: function () { return 'Increase the diffuser exit (α_d, L_d/d_th) or review V_max for the liner material.'; },
      params: ['Vmax', 'alpha_d', 'Ld_dth', 'Qm_Lmin'], component: 'diffuser' });
    add({ id: 'sigma', cat: 'cavitation', kind: 'criterion', name: 'Cavitation number at nozzle exit',
      what: 'σ = (P_s,abs − P_vap)/(½·ρ_m·v_n²) against the jet-pump cavitation criterion.',
      value: R.cavitation.sigma, dim: 'ratio', sym: 'σ', req: { min: 0.2, dim: 'ratio' },
      status: R.cavitation.safe ? 'pass' : 'fail', basis: 'Jet-pump industry criterion · sheet B60–B61', ref: 'F9.1',
      why: 'Below the limit, vapour cavities form in the mixing zone — erosion, noise and loss of entrainment.',
      action: function () { return 'Reduce P_m (lower jet velocity) or raise the suction pressure P_s.'; },
      params: ['Pm', 'Ps', 'rho_m', 'Cd', 'Qm_Lmin'], component: 'nozzle' });
    add({ id: 'alpha_d', cat: 'recovery', kind: 'criterion', name: 'Diffuser half-angle',
      what: 'Diffuser half-angle within the slurry range for attached flow.',
      value: i.alpha_d, dim: 'angle', sym: 'α_d', req: { min: 3, max: 6, dim: 'angle' },
      status: lvl(i.alpha_d >= 3 && i.alpha_d <= 6), basis: 'ESDU 85032 · Sanger (1970) · sheet F33', ref: 'F4.2',
      why: 'Steeper diffusers separate and lose recovery; very shallow ones become excessively long.',
      action: function () { return 'Set α_d between 3° and 6°.'; },
      params: ['alpha_d'], component: 'diffuser' });
    add({ id: 'Ld', cat: 'recovery', kind: 'criterion', name: 'Diffuser length ratio',
      what: 'Diffuser length in throat diameters within the slurry range.',
      value: i.Ld_dth, dim: 'ratio', sym: 'L_d/d_{th}', req: { min: 4, max: 8, dim: 'ratio' },
      status: lvl(i.Ld_dth >= 4 && i.Ld_dth <= 8), basis: 'Sanger (1970) · sheet F35', ref: 'F4.1',
      why: 'A short diffuser recovers too little pressure; a long one adds friction and settling exposure.',
      action: function () { return 'Set L_d/d_th between 4 and 8.'; },
      params: ['Ld_dth'], component: 'diffuser' });
    add({ id: 'head', cat: 'recovery', kind: 'criterion', name: 'Diffuser exit head vs return-line demand',
      what: 'Static head at the diffuser exit (station 4) against the head required by the return line.',
      value: R.stations[4].h_static, dim: 'head_m', sym: 'h_{s,4}', req: { min: R.returnLine.H_req, dim: 'head_m', sym: 'H_{req}' },
      status: R.diffuserHead.headAdequate ? 'pass' : (R.diffuserHead.dH_margin >= -0.1 * R.returnLine.H_req ? 'review' : 'fail'),
      basis: 'Station 4 static head vs return line · sheet B77–B80 · Eq. F10.3', ref: 'F10.3',
      why: 'If the recovered head is below the demand, the design flow cannot be delivered through the return line.',
      action: function () { return 'Increase P_m, or reduce the return-line demand (pipe ID, length, bends, shaft depth).'; },
      params: ['Pm', 'Pback', 'L_pipe', 'dischargeID', 'H_shaft', 'n_bends', 'K_bend', 'K_exit'], component: 'discharge' });
    add({ id: 'vn', cat: 'limits', kind: 'criterion', name: 'Nozzle exit velocity (erosion)',
      what: 'Jet velocity at the nozzle exit against the erosion limit for standard nozzle material.',
      value: R.nozzle.v_n, dim: 'vel', sym: 'v_n', req: { max: 35, dim: 'vel' },
      status: lvl(R.nozzle.v_n <= 35), basis: 'Nozzle erosion limit · sheet F51',
      why: 'Above ~35 m/s abrasive slurry erodes standard nozzle materials rapidly.',
      action: function () { return 'Specify a tungsten-carbide nozzle insert, or reduce P_m.'; },
      params: ['Pm', 'Qm_Lmin', 'nozzleExitFactor', 'Cd'], component: 'nozzle' });

    /* ---- Advisory checks (review items; do not change the status) ---- */
    var epsD = R.friction.eps / i.dischargeID;
    add({ id: 'Re', cat: 'reynolds', kind: 'advisory', name: 'Return-pipe flow regime',
      what: 'Reynolds number in the return pipe — turbulent flow is assumed by the Swamee–Jain friction factor.',
      value: R.friction.Re, dim: 'ratio', sym: 'Re', req: { min: 4000, dim: 'ratio' }, sci: true,
      reqText: function () { return 'Re ≥ 4000 (turbulent) · current regime: ' + R.friction.regime; },
      status: lvl(R.friction.Re >= 4000), basis: 'Swamee & Jain (1976) validity · sheet B104–B106', ref: 'F6.2',
      why: 'In laminar or transitional flow the turbulent friction correlation and settling correlations do not apply.',
      action: function () { return 'Review the slurry viscosity and return velocity; laminar-flow friction (64/Re) is used below 2300.'; },
      params: ['dischargeID', 'Cw', 'Qm_Lmin'], component: 'discharge' });
    add({ id: 'epsD', cat: 'reynolds', kind: 'advisory', name: 'Relative roughness range',
      what: 'Relative roughness ε/D within the validity range of the Swamee–Jain equation.',
      value: epsD, dim: 'ratio', sym: 'ε/D', req: { min: 1e-6, max: 1e-2, dim: 'ratio' }, sci: true,
      status: lvl(epsD >= 1e-6 && epsD <= 1e-2), basis: 'Swamee & Jain (1976) validity', ref: 'F6.2',
      why: 'Outside this range the explicit friction factor deviates from Colebrook–White.',
      action: function () { return 'Check the pipe material selection and return pipe ID.'; },
      params: ['pipeMaterial', 'dischargeID'], component: 'discharge' });
    var mismatch = (R.diffuser.d_diff - i.dischargeID) / i.dischargeID;
    add({ id: 'diffPipe', cat: 'pipes', kind: 'advisory', name: 'Diffuser exit vs return pipe bore',
      what: 'Calculated diffuser exit diameter against the return pipe ID it connects to.',
      value: R.diffuser.d_diff, dim: 'len_mm', sym: 'd_{diff}', req: { min: i.dischargeID * 0.98, max: i.dischargeID * 1.02, dim: 'len_mm' },
      reqText: function (f) { return 'd_{diff} ≈ D_d = ' + f.q(i.dischargeID, 'len_mm') + ' (±2 %)'; },
      status: lvl(Math.abs(mismatch) <= 0.02), basis: 'Fabrication compatibility (derived) · README note on B43 vs B50',
      why: 'A bore mismatch needs a concentric reducer / expander; its transition loss is not included in the model.',
      action: function (f) { return (mismatch > 0 ? 'Specify a concentric reducer ' : 'Specify an expander ') + f.q(R.diffuser.d_diff, 'len_mm') + ' → ' + f.q(i.dischargeID, 'len_mm') + ', or adjust α_d / L_d/d_th so the diffuser exit matches the pipe bore.'; },
      params: ['alpha_d', 'Ld_dth', 'dischargeID'], component: 'discharge' });
    add({ id: 'vm', cat: 'pipes', kind: 'advisory', name: 'Motive inlet velocity',
      what: 'Velocity in the motive supply connection against V_max.',
      value: R.velocities.v_m, dim: 'vel', sym: 'v_m', req: { max: i.Vmax, dim: 'vel', sym: 'V_{max}' },
      status: lvl(R.velocities.v_m <= i.Vmax), basis: 'Wear / velocity limit (sheet F40)',
      why: 'High supply velocity increases supply-line friction and wear upstream of the nozzle.',
      action: function () { return 'Increase the motive inlet pipe ID.'; }, params: ['motiveID', 'Qm_Lmin', 'Vmax'], component: 'motive' });
    add({ id: 'vs', cat: 'pipes', kind: 'advisory', name: 'Suction inlet velocity',
      what: 'Velocity in the suction connection against V_max.',
      value: R.velocities.v_s, dim: 'vel', sym: 'v_s', req: { max: i.Vmax, dim: 'vel', sym: 'V_{max}' },
      status: lvl(R.velocities.v_s <= i.Vmax), basis: 'Wear / velocity limit (sheet F41)',
      why: 'High suction velocity lowers the local pressure at the suction port and accelerates wear.',
      action: function () { return 'Increase the suction pipe ID.'; }, params: ['suctionID', 'Vmax'], component: 'suction' });
    add({ id: 'vret', cat: 'pipes', kind: 'advisory', name: 'Return pipe velocity',
      what: 'Velocity in the return pipeline against V_max.',
      value: R.velocities.V_disch, dim: 'vel', sym: 'V_{disch}', req: { max: i.Vmax, dim: 'vel', sym: 'V_{max}' },
      status: lvl(R.velocities.V_disch <= i.Vmax), basis: 'Wear / velocity limit (sheet B103)',
      why: 'Return velocity above the wear limit shortens pipe life.',
      action: function () { return 'Increase the return pipe ID (check settling margin).'; }, params: ['dischargeID', 'Vmax'], component: 'discharge' });
    add({ id: 'pback', cat: 'hydraulic', kind: 'advisory', name: 'Back-pressure input cross-check',
      what: 'Manual P_back input against the computed return-line demand ΔP_req.',
      value: i.Pback, dim: 'pressure_g', sym: 'P_{back}', req: { min: R.returnLine.dP_req, dim: 'pressure_bar', sym: 'ΔP_{req}' },
      status: lvl(i.Pback >= R.returnLine.dP_req), basis: 'Manual input B18 vs computed B156 · Eq. F10.4', ref: 'F10.4',
      why: 'P_back is not iterated. If it is below the computed demand, H and M are optimistic.',
      action: function () { return 'Adopt the computed demand for P_back (Results → Back-pressure cross-check) and re-check.'; },
      params: ['Pback'], component: 'discharge', pbackAction: true });
    add({ id: 'ARd', cat: 'recovery', kind: 'advisory', name: 'Diffuser area ratio',
      what: 'Diffuser area ratio AR_d = (d_diff/d_th)² against the typical range.',
      value: R.diffuser.AR_d, dim: 'ratio', sym: 'AR_d', req: { min: 1.5, max: 4, dim: 'ratio' },
      status: lvl(R.diffuser.AR_d >= 1.5 && R.diffuser.AR_d <= 4), basis: 'Typical range · Formulas sheet F4.3 note', ref: 'F4.3',
      why: 'Very small area ratios recover little pressure; very large ones risk separation.',
      action: function () { return 'Adjust α_d or L_d/d_th.'; }, params: ['alpha_d', 'Ld_dth'], component: 'diffuser' });
    add({ id: 'Cr', cat: 'recovery', kind: 'advisory', name: 'Pressure recovery coefficient',
      what: 'Ideal-flow recovery estimate C_r = 1 − (d_th/d_diff)⁴ against typical achieved values.',
      value: R.diffuser.Cr, dim: 'ratio', sym: 'C_r', req: { min: 0.7, max: 0.9, dim: 'ratio' },
      status: lvl(R.diffuser.Cr >= 0.7 && R.diffuser.Cr <= 0.9), basis: 'Typical achieved range · Formulas sheet F4.4 note', ref: 'F4.4',
      why: 'C_r is an ideal estimate; values above ~0.9 are rarely achieved in slurry service, values below 0.7 indicate a weak diffuser.',
      action: function () { return 'Review diffuser proportions; treat recovery above 0.9 as optimistic.'; }, params: ['alpha_d', 'Ld_dth'], component: 'diffuser' });
    add({ id: 'Cv', cat: 'limits', kind: 'advisory', name: 'Slurry viscosity correlation validity',
      what: 'Volume concentration within the validity range of the Thomas (1965) viscosity correlation.',
      value: R.slurry.Cv, dim: 'ratio', sym: 'C_v', req: { max: 0.6, dim: 'ratio' },
      status: lvl(R.slurry.Cv < 0.6), basis: 'Thomas (1965) · valid C_v < 0.60', ref: 'F8.4',
      why: 'Beyond the range the viscosity — and hence Re and friction — are unreliable.',
      action: function () { return 'Reduce C_w or use a measured slurry rheology.'; }, params: ['Cw', 'SG_s'] });

    /* ---- Engineering assumptions (informational) ---- */
    var N = [
      ['steady', 'Steady, incompressible, one-dimensional flow; Bernoulli station analysis on a gauge basis with a z = 0 datum.', 'Formulas sheet §5'],
      ['pvap', 'Vapour pressure P_vap = 2340 Pa (water, 20 °C) and atmospheric pressure 1.013 bar in the cavitation number.', 'Sheet B60 · Eq. F9.1'],
      ['carrier', 'Carrier fluid = motive fluid (ρ_carrier = ρ_m); base viscosity μ_w = 1.002 mPa·s in the Thomas correlation.', 'Sheet B88, B92'],
      ['d50', 'Median particle size d₅₀ = 0.4 · d_p,max (assumed gradation) in the Wasp settling velocity.', 'Sheet B87'],
      ['bore', 'Selected nozzle bore d_n,sel = ' + i.nozzleExitFactor + ' × d_n (empirical bore factor).', 'Sheet F28'],
      ['gap', 'Nozzle-to-throat spacing s = 0.5 · d_th.', 'Mueller (1964) · Eq. F1.6'],
      ['qmin', 'Minimum flow for cuttings removal based on a 5 % volumetric concentration.', 'Sheet B137'],
      ['pback', 'P_back is a manual input — it is cross-checked but not iterated against the computed return-line demand.', 'Sheet B18'],
      ['viz', 'Hydraulic profiles and the flow visualization are physics-based reconstructions anchored to the station values — not CFD.', 'This application']
    ];
    N.forEach(function (n) {
      C.push({ id: 'note:' + n[0], cat: 'assumptions', kind: 'note', name: n[1], status: 'note', basis: n[2] });
    });
    return C;
  }

  /* --------------------------------------------------------------- summary */
  function summarize(checks, blockers) {
    var c = { pass: 0, review: 0, fail: 0, note: 0, critTotal: 0, critPass: 0, critReview: 0, critFail: 0, advReview: 0, advTotal: 0 };
    checks.forEach(function (k) {
      c[k.status]++;
      if (k.kind === 'criterion' || k.kind === 'validity') {
        c.critTotal++;
        if (k.status === 'pass') c.critPass++; else if (k.status === 'fail') c.critFail++; else c.critReview++;
      } else if (k.kind === 'advisory') {
        c.advTotal++; if (k.status !== 'pass') c.advReview++;
      }
    });
    var state, tone, title, line;
    if (blockers.length) {
      state = 'blocked'; tone = 'fail'; title = 'Calculation blocked';
      line = blockers.length + (blockers.length === 1 ? ' input condition requires' : ' input conditions require') + ' correction';
    } else if (c.critReview + c.critFail === 0) {
      state = 'acceptable'; tone = 'pass'; title = 'Design acceptable';
      line = c.critPass + ' of ' + c.critTotal + ' design criteria met' +
        (c.advReview ? ' · ' + c.advReview + (c.advReview === 1 ? ' advisory item requires' : ' advisory items require') + ' review' : ' · no advisory items');
    } else {
      state = 'review'; tone = c.critFail ? 'fail' : 'review'; title = 'Review required';
      var bits = [];
      if (c.critFail) bits.push(c.critFail + (c.critFail === 1 ? ' criterion not met' : ' criteria not met'));
      if (c.critReview) bits.push(c.critReview + (c.critReview === 1 ? ' criterion to review' : ' criteria to review'));
      if (c.advReview) bits.push(c.advReview + ' advisory');
      line = bits.join(' · ');
    }
    return { state: state, tone: tone, title: title, line: line, counts: c };
  }

  function evaluate(R, inputs, invalid) {
    var fv = validateInputs(inputs, invalid);
    var blockers = findBlockers(R, R.inputs, fv);
    var checks = blockers.length ? [] : buildChecks(R, R.inputs);
    var status = summarize(checks, blockers);
    return { fields: fv.fields, fieldErrors: fv.errors, fieldWarns: fv.warns, blockers: blockers, checks: checks, status: status };
  }

  root.VJP = root.VJP || {};
  root.VJP.validation = {
    CATEGORIES: CATEGORIES, KINDS: KINDS, evaluate: evaluate, validateField: validateField,
    hardText: hardText, buildChecks: buildChecks, summarize: summarize
  };
})(typeof window !== 'undefined' ? window : this);
