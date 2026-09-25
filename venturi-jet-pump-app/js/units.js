/* Unit system. The model computes in one canonical metric basis (js/engine.js:
 * bar g, L/min, mm, m, m/s, kg/m³ ...). This module converts those canonical
 * values to the display system (SI or Imperial) at the UI boundary only — it
 * never feeds the engine. Each "dimension" names the canonical unit and its
 * Imperial counterpart:  display = canonical × f.
 *
 * Every page, the schematic, the charts, CSV exports and the report format
 * values through here, so an SI/Imperial switch propagates consistently. */
(function (root) {
  'use strict';

  var DIM = {
    pressure_g:   { si: { u: 'bar g',  f: 1 },        imp: { u: 'psig',   f: 14.5037738 } },  // gauge pressure
    pressure_bar: { si: { u: 'bar',    f: 1 },        imp: { u: 'psi',    f: 14.5037738 } },  // pressure difference
    pressure_pa:  { si: { u: 'Pa',     f: 1 },        imp: { u: 'psi',    f: 1 / 6894.757 } },
    flow_Lmin:    { si: { u: 'L/min',  f: 1 },        imp: { u: 'US gpm', f: 0.264172052 } },
    flow_m3s:     { si: { u: 'm³/s',   f: 1 },        imp: { u: 'ft³/s',  f: 35.3146667 } },
    len_mm:       { si: { u: 'mm',     f: 1 },        imp: { u: 'in',     f: 1 / 25.4 } },
    len_m:        { si: { u: 'm',      f: 1 },        imp: { u: 'ft',     f: 3.2808399 } },
    head_m:       { si: { u: 'm',      f: 1 },        imp: { u: 'ft',     f: 3.2808399 } },
    rough_mm:     { si: { u: 'mm',     f: 1 },        imp: { u: 'in',     f: 1 / 25.4 } },
    rate_mmmin:   { si: { u: 'mm/min', f: 1 },        imp: { u: 'in/min', f: 1 / 25.4 } },
    vel:          { si: { u: 'm/s',    f: 1 },        imp: { u: 'ft/s',   f: 3.2808399 } },
    density:      { si: { u: 'kg/m³',  f: 1 },        imp: { u: 'lb/ft³', f: 0.062427961 } },
    power:        { si: { u: 'kW',     f: 1 },        imp: { u: 'hp',     f: 1.34102209 } },
    area_m2:      { si: { u: 'm²',     f: 1 },        imp: { u: 'in²',    f: 1550.0031 } },   // small areas (nozzle, throat)
    area_m2L:     { si: { u: 'm²',     f: 1 },        imp: { u: 'ft²',    f: 10.7639104 } },  // large areas (cutterhead face)
    visc:         { si: { u: 'mPa·s',  f: 1 },        imp: { u: 'cP',     f: 1 } },
    angle:        { si: { u: '°',      f: 1 },        imp: { u: '°',      f: 1 } },
    ratio:        { si: { u: '',       f: 1 },        imp: { u: '',       f: 1 } },
    count:        { si: { u: '',       f: 1 },        imp: { u: '',       f: 1 } },
    percent:      { si: { u: '%',      f: 1 },        imp: { u: '%',      f: 1 } }
  };

  // Default significant figures per dimension (engineering precision, not float noise).
  var SIG = {
    pressure_g: 4, pressure_bar: 4, pressure_pa: 4, flow_Lmin: 4, flow_m3s: 4, len_mm: 4, len_m: 4,
    head_m: 4, rough_mm: 3, rate_mmmin: 3, vel: 3, density: 4, power: 4, area_m2: 4, area_m2L: 4,
    visc: 4, angle: 3, ratio: 4, count: 6, percent: 3
  };

  function sysOf(system) { return system === 'imp' ? 'imp' : 'si'; }

  // convert a canonical value to the active system for a dimension
  function conv(value, dim, system) {
    var d = DIM[dim];
    if (!d) return { value: value, unit: '' };
    var s = d[sysOf(system)];
    return { value: value * s.f, unit: s.u };
  }

  function unitLabel(dim, system) {
    var d = DIM[dim]; if (!d) return '';
    return d[sysOf(system)].u;
  }

  // For editable inputs: convert a display value back to the canonical basis
  function toSI(displayValue, dim, system) {
    var d = DIM[dim]; if (!d) return displayValue;
    return displayValue / d[sysOf(system)].f;
  }

  // Smart significant-figure formatting for engineering display
  function fmt(x, sig) {
    if (x === null || x === undefined || typeof x !== 'number' || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    sig = sig || 4;
    var a = Math.abs(x);
    if (a >= 1e6 || a < 1e-4) return sci(x, Math.max(2, sig - 1));
    var mag = Math.floor(Math.log10(a));
    var digits = Math.max(0, sig - mag - 1);
    digits = Math.min(digits, 6);
    var r = Number(x.toFixed(digits));
    // big values: round to sig figs without spurious decimals (e.g. 494226 -> 494200 at 4 s.f.)
    if (mag + 1 > sig) { var p = Math.pow(10, mag + 1 - sig); r = Math.round(x / p) * p; }
    return minus(String(r));
  }

  // fixed decimals, used where columns must align (tables of like quantities)
  function fixed(x, d) {
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '—';
    return minus(x.toFixed(d));
  }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  // scientific notation with a real ×10ⁿ (never "e+5" in the UI)
  function sci(x, sig) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    if (x === 0) return '0';
    sig = sig || 3;
    var e = Math.floor(Math.log10(Math.abs(x)));
    var m = x / Math.pow(10, e);
    var ms = m.toFixed(Math.max(0, sig - 1));
    if (Math.abs(Number(ms)) >= 10) { e += 1; ms = (x / Math.pow(10, e)).toFixed(Math.max(0, sig - 1)); }
    return minus(ms) + '×10' + String(e).split('').map(function (c) { return SUP[c] || c; }).join('');
  }
  // plain-text scientific for CSV / clipboard ("4.94e5")
  function sciPlain(x, sig) {
    if (typeof x !== 'number' || !isFinite(x)) return '';
    return x.toExponential(Math.max(0, (sig || 3) - 1));
  }
  function minus(s) { return s.charAt(0) === '-' ? '−' + s.slice(1) : s; }

  // Format a canonical value in the display system: { text, value, unit }
  function display(value, dim, system, sig) {
    var c = conv(value, dim, system);
    return { text: fmt(c.value, sig || SIG[dim] || 4), value: c.value, unit: c.unit };
  }
  // "100.4 mm"
  function q(value, dim, system, sig) {
    var d = display(value, dim, system, sig);
    return d.unit ? d.text + ' ' + d.unit : d.text;
  }
  // plain number (no unicode minus / ×10) for CSV
  function plain(value, dim, system, sig) {
    var c = conv(value, dim, system);
    if (typeof c.value !== 'number' || !isFinite(c.value)) return '';
    var a = Math.abs(c.value);
    if (a !== 0 && (a >= 1e6 || a < 1e-4)) return sciPlain(c.value, sig || 4);
    return String(Number(c.value.toPrecision(sig || 6)));
  }

  // Signed relative change, e.g. "+4.2 %"
  function pct(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b) || b === 0) return '';
    var p = (a - b) / Math.abs(b) * 100;
    if (Math.abs(p) < 0.05) return '0.0 %';
    return (p > 0 ? '+' : '−') + Math.abs(p).toFixed(Math.abs(p) >= 100 ? 0 : 1) + ' %';
  }

  root.VJP = root.VJP || {};
  root.VJP.units = {
    DIM: DIM, SIG: SIG, conv: conv, unitLabel: unitLabel, toSI: toSI,
    fmt: fmt, fixed: fixed, sci: sci, sciPlain: sciPlain, display: display, q: q, plain: plain, pct: pct
  };
})(typeof window !== 'undefined' ? window : this);
