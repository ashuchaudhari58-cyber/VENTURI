/* GOVERNING EQUATIONS — technical reference, tied to the live calculation. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, FM = VJP.formulas, CS = VJP.calcsteps;
  VJP.pages = VJP.pages || {};
  var q = '';

  function stepsFor(eq) {
    var ids = (eq.steps || []).slice();
    CS.STEPS.forEach(function (s) { if (s.ref === eq.id && ids.indexOf(s.id) < 0) ids.push(s.id); });
    return ids.map(function (id) { return CS.BYID[id]; }).filter(Boolean).sort(function (a, b) { return a.no - b.no; });
  }
  function card(eq, c) {
    var D = c.D, cat = FM.CATS.filter(function (x) { return x.id === eq.cat; })[0];
    var el = h('article', { class: 'eqcard', id: 'eq-' + eq.id.replace(/\./g, '_') });
    el.appendChild(h('div', { class: 'eq-h' }, h('span', { class: 'eq-id mono', text: eq.id }), h('h3', { text: eq.name }), h('span', { class: 'eqtag t-' + eq.cat, text: cat.tag })));
    el.appendChild(h('div', { class: 'eq-f', html: S.symHTML(eq.eq) }));
    if (eq.vars && eq.vars.length) {
      var t = h('table', { class: 'eq-vars' }), tb = h('tbody');
      eq.vars.forEach(function (v) { tb.appendChild(h('tr', null, h('td', { class: 'sym', html: S.symHTML(v[0]) }), h('td', { text: v[1] }), h('td', { class: 'unit', text: v[2] }))); });
      t.appendChild(tb); el.appendChild(t);
    }
    if (eq.range) el.appendChild(h('div', { class: 'eq-meta', html: '<b>Validity / range</b> ' + esc(eq.range) }));
    if (eq.assume) el.appendChild(h('div', { class: 'eq-meta', html: '<b>Assumptions</b> ' + esc(eq.assume) }));
    var steps = stepsFor(eq);
    if (steps.length && !D.blocked) {
      var row = h('div', { class: 'eq-used' }, h('b', { text: 'Used in' }));
      steps.forEach(function (s) {
        var v = s.res(D.R);
        var b = h('button', { class: 'chip-btn', type: 'button', 'data-tip': 'Step ' + s.no + ' — ' + s.title, html: '<span class="mono muted">' + String(s.no).padStart(2, '0') + '</span> <span class="sym">' + S.symHTML(s.sym || String(s.eq).split(' = ')[0]) + '</span> <b class="num">' + esc(s.sci ? U.sci(v, 3) : U.fmt(v, 4)) + '</b> <span class="muted">' + esc(s.unit === '—' ? '' : s.unit) + '</span>' });
        b.addEventListener('click', function () { c.nav('steps', { s: s.id }); });
        row.appendChild(b);
      });
      el.appendChild(row);
    }
    if (eq.check && !D.blocked && D.check[eq.check]) {
      var k = D.check[eq.check];
      var cb = h('button', { class: 'eq-check', type: 'button', html: '<span class="si ' + k.status + '">' + icon(ui.statusIcon(k.status), 'sm') + '</span> Current design: <b>' + esc(k.status.toUpperCase()) + '</b> — ' + esc(k.name) + icon('chevron-right', 'sm') });
      cb.addEventListener('click', function () { c.nav('validation', { check: k.id }); });
      el.appendChild(cb);
    }
    if (eq.refs && eq.refs.length) el.appendChild(h('div', { class: 'eq-ref', html: icon('link', 'xs') + esc(eq.refs.join(' · ')) }));
    el._search = (eq.id + ' ' + eq.name + ' ' + S.symText(eq.eq) + ' ' + (eq.vars || []).map(function (v) { return v[0] + ' ' + v[1]; }).join(' ') + ' ' + (eq.refs || []).join(' ')).toLowerCase();
    return el;
  }

  VJP.pages.equations = {
    mount: function (el, c) {
      var page = h('div', { class: 'page page-equations' });
      var search = h('input', { class: 'txt-input', type: 'search', placeholder: 'Search equations, symbols, references…', value: q, 'aria-label': 'Search equations', style: { width: '320px' } });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>07</b> · Reference' }),
          h('h1', { class: 'page-title', text: 'Governing Equations' }),
          h('p', { class: 'page-desc', text: 'The equations applied by the calculation engine (Formulas sheet of VENTURI_JET_PUMP_CALCULATOR_v4). Empirical correlations are marked as such with their validity ranges; the chips show where each equation is used and its current value in this design.' })),
        h('div', { class: 'ph-r' }, search)));
      var layout = h('div', { class: 'eq-layout' });
      var nav = h('nav', { class: 'eq-nav panel', 'aria-label': 'Equation categories' });
      nav.appendChild(h('div', { class: 'eyebrow', style: { padding: '12px 14px 6px' }, text: 'Categories' }));
      var body = h('div', { class: 'eq-body' });
      FM.CATS.forEach(function (cat) {
        var eqs = FM.EQUATIONS.filter(function (e) { return e.cat === cat.id; });
        var sec = h('section', { class: 'eq-sec', id: 'eqcat-' + cat.id },
          h('div', { class: 'eq-sec-h' }, h('h2', { text: cat.title }), h('span', { class: 'eqtag t-' + cat.id, text: cat.tag }), h('p', { text: cat.desc })));
        var grid = h('div', { class: 'eq-grid' });
        eqs.forEach(function (e) { grid.appendChild(card(e, c)); });
        sec.appendChild(grid);
        body.appendChild(sec);
        var nb = h('button', { class: 'cs-navi', type: 'button', html: '<span class="eqdot t-' + cat.id + '"></span><span>' + esc(cat.title) + '</span><span class="mono muted">' + eqs.length + '</span>' });
        nb.addEventListener('click', function () { sec.scrollIntoView({ block: 'start', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); });
        nav.appendChild(nb);
      });
      var refs = h('section', { class: 'panel eq-refs', id: 'eq-references' }, h('div', { class: 'panel-h' }, h('h2', { text: 'References' })),
        h('ol', { class: 'refs' }, FM.REFERENCES.map(function (r) { return h('li', { text: r }); })));
      body.appendChild(refs);
      var nr = h('button', { class: 'cs-navi', type: 'button', html: '<span class="eqdot"></span><span>References</span><span class="mono muted">' + FM.REFERENCES.length + '</span>' });
      nr.addEventListener('click', function () { refs.scrollIntoView({ block: 'start', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); });
      nav.appendChild(nr);
      layout.append(nav, body);
      page.appendChild(layout);
      el.appendChild(page);
      function apply() {
        q = search.value.trim().toLowerCase();
        body.querySelectorAll('.eqcard').forEach(function (a) { a.classList.toggle('hidden', !!q && a._search.indexOf(q) < 0); });
        body.querySelectorAll('.eq-sec').forEach(function (s) { s.classList.toggle('hidden', !s.querySelector('.eqcard:not(.hidden)')); });
      }
      search.addEventListener('input', apply); apply();
      if (c.params.eq) setTimeout(function () {
        var a = document.getElementById('eq-' + c.params.eq.replace(/\./g, '_')); if (!a) return;
        a.scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); a.classList.add('flash');
      }, 60);
    }
  };
})(typeof window !== 'undefined' ? window : this);
