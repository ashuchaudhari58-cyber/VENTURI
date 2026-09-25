/* CALCULATION STEPS — the calculation audit trail (see js/calcsteps.js). */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc, S = VJP.schema, U = VJP.units, CS = VJP.calcsteps;
  VJP.pages = VJP.pages || {};

  var openSteps = {}, closedGroups = {}, query = '';
  function n(x) { return U.fmt(x, 5); }
  function resText(step, v) { return typeof v !== 'number' || !isFinite(v) ? '—' : step.sci ? U.sci(v, 4) : U.fmt(v, 5); }
  function symOf(step) { return step.sym || String(step.eq).split(' = ')[0]; }
  function plainEq(s) { return S.symText(s).replace(/\s+/g, ' ').trim(); }

  function stepEl(step, c, D) {
    var R = D.R, f = c.f, v = step.res(R);
    var chk = step.check && D.check[step.check];
    var det = h('details', { class: 'cstep', id: 'step-' + step.id });
    if (openSteps[step.id]) det.open = true;
    det.addEventListener('toggle', function () { openSteps[step.id] = det.open; });
    var unit = step.unit === '—' ? '' : step.unit;
    var sum = h('summary', null,
      h('span', { class: 'cs-no mono', text: String(step.no).padStart(2, '0') }),
      h('span', { class: 'cs-t', text: step.title }),
      h('span', { class: 'cs-res' }, h('span', { class: 'cs-sym', html: S.symHTML(symOf(step)) }), h('span', { class: 'cs-eqs', text: '=' }),
        h('b', { class: 'num', text: resText(step, v) }), unit ? h('span', { class: 'cs-u', text: unit }) : null),
      ui.vt(step.type),
      chk ? h('span', { class: 'si ' + chk.status, 'data-tip': chk.name, html: icon(ui.statusIcon(chk.status), 'sm') + '<span class="sr-only">' + chk.status + '</span>' }) : h('span', { class: 'cs-nochk' }),
      h('span', { class: 'cs-chev', html: icon('chevron-right', 'sm') }));
    det.appendChild(sum);
    var body = h('div', { class: 'cs-body' });
    body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Objective' }), h('span', { class: 'cs-v', text: step.obj })));
    // inputs used
    var ins = h('div', { class: 'cs-chips' });
    (step.inputs || []).forEach(function (k) {
      var fl = S.BYKEY[k], iv = R.inputs[k];
      var b = h('button', { class: 'chip-btn', type: 'button', 'data-tip': fl.name + ' — edit on the Inputs page', html: '<span class="sym">' + S.symHTML(fl.sym || fl.name) + '</span> <b class="num">' + esc(fl.select ? iv : n(iv)) + '</b> <span class="muted">' + esc(fl.select ? '' : U.unitLabel(fl.dim, 'si')) + '</span>' });
      b.appendChild(ui.vt(fl.type));
      b.addEventListener('click', function (e) { e.preventDefault(); c.nav('inputs', { f: k }); });
      ins.appendChild(b);
    });
    (step.uses || []).forEach(function (sid) {
      var s2 = CS.BYID[sid]; if (!s2) return;
      var b = h('button', { class: 'chip-btn step-ref', type: 'button', 'data-tip': 'Step ' + s2.no + ' — ' + s2.title, html: '<span class="mono muted">' + String(s2.no).padStart(2, '0') + '</span> <span class="sym">' + S.symHTML(symOf(s2)) + '</span> <b class="num">' + esc(resText(s2, s2.res(R))) + '</b> <span class="muted">' + esc(s2.unit === '—' ? '' : s2.unit) + '</span>' });
      b.addEventListener('click', function (e) { e.preventDefault(); focusStep(s2.id); });
      ins.appendChild(b);
    });
    if (ins.childNodes.length) body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Inputs used' }), ins));
    body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Equation' }), h('div', { class: 'cs-eq', html: S.symHTML(step.eq) })));
    var subText = step.sub(R, n);
    body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Substitution' }), h('div', { class: 'cs-eq sub', html: S.symHTML(symOf(step)) + ' = ' + esc(subText) })));
    // result (+ display-system conversion)
    var resLine = h('div', { class: 'cs-result' }, h('span', { class: 'sym', html: S.symHTML(symOf(step)) }), ' = ', h('b', { class: 'num', text: resText(step, v) }), unit ? ' ' + unit : '');
    if (c.sys === 'imp' && step.dim && U.DIM[step.dim] && U.DIM[step.dim].imp.f !== 1) resLine.appendChild(h('span', { class: 'cs-conv', text: '(' + f.q(v, step.dim) + ')' }));
    if (step.note) resLine.appendChild(h('span', { class: 'cs-note', text: step.note(R) }));
    body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Result' }), resLine));
    if (step.table) {
      var t = h('table', { class: 'tbl cs-tbl' }), tb = h('tbody');
      step.table(R).forEach(function (row) {
        tb.appendChild(h('tr', null, h('td', { class: 'sym', html: S.symHTML(row[0]) }), h('td', { class: 'val', text: U.fmt(row[1], 5) }), h('td', { class: 'unit', text: row[2] }),
          c.sys === 'imp' && U.DIM[row[3]].imp.f !== 1 ? h('td', { class: 'unit', text: f.q(row[1], row[3]) }) : h('td')));
      });
      t.appendChild(tb);
      body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Station values' }), h('div', { class: 'tbl-wrap' }, t)));
    }
    if (step.trace) body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Unit trace' }), h('span', { class: 'cs-v mono', text: step.trace })));
    if (step.assume && step.assume.length) {
      body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Assumptions' }),
        h('ul', { class: 'cs-assume' }, step.assume.map(function (a) { return h('li', null, ui.vt('assumed'), ' ', a); }))));
    }
    var refs = h('div', { class: 'cs-refs' }, h('span', { class: 'mono', text: 'Sheet ' + step.cell }));
    if (step.ref) { var eqb = h('button', { class: 'linkbtn', type: 'button', html: icon('sigma', 'xs') + 'Eq. ' + esc(step.ref) }); eqb.addEventListener('click', function (e) { e.preventDefault(); c.nav('equations', { eq: step.ref }); }); refs.appendChild(eqb); }
    if (chk) { var cb = h('button', { class: 'linkbtn', type: 'button', html: icon('validation', 'xs') + esc(chk.name) + ' — ' + esc(chk.status.toUpperCase()) }); cb.addEventListener('click', function (e) { e.preventDefault(); c.nav('validation', { check: chk.id }); }); refs.appendChild(cb); }
    body.appendChild(h('div', { class: 'cs-row' }, h('span', { class: 'cs-k', text: 'Reference' }), refs));
    var acts = h('div', { class: 'cs-acts' });
    function copyBtn(label, text) { var b = h('button', { class: 'btn xs', type: 'button', html: icon('copy', 'xs') + esc(label) }); b.addEventListener('click', function () { ui.copy(text).then(function (ok) { ui.toast(ok !== false ? label + ' copied' : 'Copy failed', ok !== false ? 'ok' : 'fail'); }); }); return b; }
    var resultStr = plainEq(symOf(step)) + ' = ' + resText(step, v) + (unit ? ' ' + unit : '');
    acts.append(copyBtn('Copy equation', plainEq(step.eq)), copyBtn('Copy values', plainEq(symOf(step)) + ' = ' + subText + ' = ' + resText(step, v) + (unit ? ' ' + unit : '')), copyBtn('Copy result', resultStr));
    if (step.comp) { var sb = h('button', { class: 'btn xs', type: 'button', html: icon('crosshair', 'xs') + 'Show in schematic' }); sb.addEventListener('click', function () { c.nav('schematic', { c: step.comp, dim: step.dimId || '' }); }); acts.appendChild(sb); }
    body.appendChild(acts);
    det.appendChild(body);
    det._search = (step.title + ' ' + plainEq(step.eq) + ' ' + step.cell + ' ' + (step.ref || '') + ' ' + step.id).toLowerCase();
    return det;
  }
  function focusStep(id) {
    var el = document.getElementById('step-' + id); if (!el) return;
    var grp = el.closest('.cs-group'); if (grp && grp.classList.contains('closed')) grp.querySelector('.cs-gh').click();
    el.open = true; openSteps[id] = true;
    el.scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  VJP.pages.steps = {
    mount: function (el, c) {
      var D = c.D;
      var page = h('div', { class: 'page page-steps' });
      var search = h('input', { class: 'txt-input', type: 'search', placeholder: 'Filter steps — e.g. throat, Re, B26, F2.3', 'aria-label': 'Filter calculation steps', value: query, style: { width: '300px' } });
      var exp = h('button', { class: 'btn sm', type: 'button', html: icon('expand') + 'Expand all' });
      var col = h('button', { class: 'btn sm', type: 'button', html: icon('collapse') + 'Collapse all' });
      var cpy = h('button', { class: 'btn sm', type: 'button', html: icon('copy') + 'Copy audit trail' });
      page.appendChild(h('div', { class: 'page-head' },
        h('div', { class: 'ph-l' },
          h('div', { class: 'page-kicker', html: '<b>02</b> · Engineering workflow' }),
          h('h1', { class: 'page-title', text: 'Calculation Steps' }),
          h('p', { class: 'page-desc', html: 'The complete calculation audit trail in the engine’s dependency order — ' + CS.STEPS.length + ' steps, each with its equation, the values substituted and the result. Values are in the calculation basis (the workbook’s metric units)' + (c.sys === 'imp' ? '; Imperial equivalents are shown beside results.' : '.') })),
        h('div', { class: 'ph-r' }, search, exp, col, cpy)));
      if (D.blocked) { page.appendChild(VJP.pages._blockedPanel(c, 'Calculation steps are not available')); el.appendChild(page); return; }

      var layout = h('div', { class: 'cs-layout' });
      var nav = h('nav', { class: 'cs-nav panel', 'aria-label': 'Calculation groups' });
      nav.appendChild(h('div', { class: 'eyebrow', style: { padding: '12px 14px 6px' }, text: 'Calculation groups' }));
      var list = h('div', { class: 'cs-list' });
      CS.GROUPS.forEach(function (g) {
        var steps = CS.STEPS.filter(function (s) { return s.g === g.id; });
        if (!steps.length) return;
        var worst = null;
        steps.forEach(function (s) { var ck = s.check && D.check[s.check]; if (ck && ck.status !== 'pass') worst = ck.status === 'fail' || worst === 'fail' ? 'fail' : 'review'; });
        var sec = h('section', { class: 'cs-group' + (closedGroups[g.id] ? ' closed' : ''), id: 'grp-' + g.id });
        var gh = h('button', { class: 'cs-gh', type: 'button', 'aria-expanded': String(!closedGroups[g.id]),
          html: '<span class="cs-gl">' + g.id + '</span><span class="cs-gt">' + esc(g.title) + '</span><span class="cs-gr mono">steps ' + String(steps[0].no).padStart(2, '0') + '–' + String(steps[steps.length - 1].no).padStart(2, '0') + '</span>' +
            (worst ? '<span class="si ' + worst + '">' + icon(worst === 'fail' ? 'x' : 'alert', 'sm') + '</span>' : '') + icon('chevron-down', 'sm cs-gchev') });
        gh.addEventListener('click', function () { closedGroups[g.id] = !closedGroups[g.id]; sec.classList.toggle('closed', !!closedGroups[g.id]); gh.setAttribute('aria-expanded', String(!closedGroups[g.id])); });
        sec.appendChild(gh);
        var box = h('div', { class: 'cs-steps' });
        steps.forEach(function (s) { box.appendChild(stepEl(s, c, D)); });
        sec.appendChild(box);
        list.appendChild(sec);
        var nb = h('button', { class: 'cs-navi', type: 'button', html: '<span class="cs-gl">' + g.id + '</span><span>' + esc(g.title) + '</span><span class="mono muted">' + steps.length + '</span>' });
        nb.addEventListener('click', function () { if (closedGroups[g.id]) gh.click(); sec.scrollIntoView({ block: 'start', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); });
        nav.appendChild(nb);
      });
      layout.append(nav, list);
      page.appendChild(layout);
      el.appendChild(page);

      function applyFilter() {
        query = search.value.trim().toLowerCase();
        list.querySelectorAll('.cstep').forEach(function (d) { d.classList.toggle('hidden', !!query && d._search.indexOf(query) < 0); });
        list.querySelectorAll('.cs-group').forEach(function (s) { var any = s.querySelectorAll('.cstep:not(.hidden)').length; s.classList.toggle('hidden', !any); if (query && any) s.classList.remove('closed'); });
      }
      search.addEventListener('input', applyFilter);
      applyFilter();
      exp.addEventListener('click', function () { list.querySelectorAll('.cstep').forEach(function (d) { d.open = true; openSteps[d.id.slice(5)] = true; }); list.querySelectorAll('.cs-group').forEach(function (s) { s.classList.remove('closed'); }); closedGroups = {}; });
      col.addEventListener('click', function () { list.querySelectorAll('.cstep').forEach(function (d) { d.open = false; }); openSteps = {}; });
      cpy.addEventListener('click', function () {
        var R = D.R, lines = ['Venturi Jet Pump — calculation audit trail', c.store.project.number + ' ' + c.store.project.name + ' · Rev ' + c.store.activeRev().rev, ''];
        CS.GROUPS.forEach(function (g) {
          lines.push(g.id + ' · ' + g.title.toUpperCase());
          CS.STEPS.filter(function (s) { return s.g === g.id; }).forEach(function (s) {
            var v = s.res(R); lines.push(String(s.no).padStart(2, '0') + '  ' + s.title + '  [' + s.cell + (s.ref ? ', Eq. ' + s.ref : '') + ']');
            lines.push('    ' + plainEq(s.eq)); lines.push('    ' + plainEq(symOf(s)) + ' = ' + s.sub(R, n) + ' = ' + resText(s, v) + (s.unit === '—' ? '' : ' ' + s.unit));
          });
          lines.push('');
        });
        ui.copy(lines.join('\n')).then(function () { ui.toast('Audit trail copied (' + CS.STEPS.length + ' steps)'); });
      });
      if (c.params.s) setTimeout(function () { focusStep(c.params.s); }, 60);
    }
  };
})(typeof window !== 'undefined' ? window : this);
