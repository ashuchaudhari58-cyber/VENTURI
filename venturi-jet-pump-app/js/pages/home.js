/* PROJECT HOME — landing / project selection with the full product logo. */
(function (root) {
  'use strict';
  var VJP = root.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc;
  VJP.pages = VJP.pages || {};

  function statusChip(st) { return '<span class="chip st-' + String(st || 'Draft').toLowerCase().replace(/\s+/g, '').replace('inreview', 'review') + '">' + esc(st) + '</span>'; }

  function newProjectDialog(c) {
    var num = h('input', { class: 'txt-input', placeholder: 'auto' });
    var name = h('input', { class: 'txt-input', placeholder: 'e.g. Drive 4 — DN1800 MTBM', autofocus: true });
    var client = h('input', { class: 'txt-input' }), site = h('input', { class: 'txt-input' }), eng = h('input', { class: 'txt-input' });
    var from = h('select', { class: 'txt-input' }, h('option', { value: 'defaults', text: 'Spreadsheet defaults (Design A)' }), h('option', { value: 'current', text: 'Copy the current working inputs' }));
    function row(l, i) { return h('div', { class: 'form-row' }, h('label', { text: l }), i); }
    ui.modal({
      title: 'New project', sub: 'Creates Rev A. The project is stored when you press Save.',
      body: h('div', null, h('div', { class: 'form-grid' }, row('Project number', num), row('Project name', name), row('Client', client), row('Site / drive', site), row('Engineer', eng), row('Start from', from))),
      actions: [{ label: 'Cancel' }, { label: 'Create project', primary: true, onClick: function () {
        var go = function () {
          c.store.newProject({ number: num.value.trim() || undefined, name: name.value.trim() || 'Untitled project', client: client.value.trim(), site: site.value.trim(),
            engineer: eng.value.trim(), inputs: from.value === 'current' ? JSON.parse(JSON.stringify(c.store.inputs)) : undefined });
          ui.toast('Project created — not yet saved');
          c.nav('inputs');
        };
        if (c.store.saveState === 'unsaved' || c.store.saveState === 'new') {
          ui.confirm({ title: 'Unsaved changes', text: 'The current working copy has unsaved changes that will be discarded.', ok: 'Discard and create', danger: true }).then(function (y) { if (y) go(); });
        } else go();
      } }]
    });
  }

  VJP.pages.home = {
    mount: function (el, c) {
      var D = c.D, s = D.status, store = c.store, f = c.f, p = store.project, r = store.activeRev();
      var page = h('div', { class: 'page home' });

      // ---- hero ----
      var integrity = VJP.test ? VJP.test.run() : null;
      var hero = h('section', { class: 'home-hero panel' },
        h('div', { class: 'home-logo' }, h('img', { src: ui.asset('brand/venturi-jet-pump-logo.png'), alt: 'Venturi Jet Pump — Design Calculation', width: '260', height: '274' })),
        h('div', { class: 'home-intro' },
          h('div', { class: 'page-kicker', html: '<b>Design Studio</b> · Ejectors for MTBM slurry circuits' }),
          h('h1', { class: 'home-title', text: 'Venturi Jet Pump Design Studio' }),
          h('p', { class: 'home-lead', text: 'Parametric sizing, verification and documentation of slurry jet pumps. One calculation model drives the inputs, results, dimensioned geometry, flow visualization, hydraulic profiles, validation and report.' }),
          h('div', { class: 'home-cta' },
            h('button', { class: 'btn primary', type: 'button', html: icon('arrow-right') + '<span>Continue ' + esc(p.number) + ' · Rev ' + esc(r.rev) + '</span>', onClick: function () { c.nav('inputs'); } }),
            h('button', { class: 'btn', type: 'button', html: icon('file-plus') + '<span>New project</span>', onClick: function () { newProjectDialog(c); } }),
            h('button', { class: 'btn ghost', type: 'button', html: icon('upload') + '<span>Import project file</span>', onClick: c.actions.importProject })),
          h('div', { class: 'home-integrity' },
            h('span', { class: 'si ' + (integrity && !integrity.fail ? 'ok' : integrity ? 'fail' : 'na'), html: icon(integrity && !integrity.fail ? 'check-circle' : 'info') }),
            h('span', { html: integrity
              ? 'Calculation engine reproduces <span class="mono">VENTURI_JET_PUMP_CALCULATOR_v4</span> — <b class="mono">' + integrity.pass + '/' + integrity.total + '</b> regression values match the workbook.'
              : 'Calculation engine: VENTURI_JET_PUMP_CALCULATOR_v4.' }))));
      page.appendChild(hero);

      // ---- current project + saved projects ----
      var grid = h('div', { class: 'home-grid' });
      var cur = h('section', { class: 'panel' },
        h('div', { class: 'panel-h' }, h('h2', { text: 'Current project' }), h('span', { class: 'ph-sub', text: 'Working copy in this browser' })),
        h('div', { class: 'panel-b' },
          h('div', { class: 'home-proj' },
            h('div', null,
              h('div', { class: 'home-pno mono', text: p.number }),
              h('div', { class: 'home-pname', text: p.name }),
              h('div', { class: 'home-pmeta', html: 'Rev <b class="mono">' + esc(r.rev) + '</b> ' + statusChip(r.status) + ' · ' + esc(store.revisions.length) + ' revision' + (store.revisions.length > 1 ? 's' : '') +
                (p.engineer ? ' · ' + esc(p.engineer) : '') + ' · modified ' + esc(ui.dateStr(p.modified)) })),
            h('div', { class: 'banner ' + s.tone + ' compact' },
              h('div', { class: 'bn-ic', html: icon(s.state === 'blocked' ? 'blocked' : s.tone === 'pass' ? 'check' : s.tone === 'fail' ? 'x' : 'alert') }),
              h('div', null, h('div', { class: 'bn-t', text: s.title }), h('div', { class: 'bn-l', text: s.line })))),
          D.blocked ? null : h('div', { class: 'home-kv' }, [['d_th', 'Throat Ø'], ['d_n_sel', 'Nozzle exit Ø'], ['Qd', 'Total flow'], ['P_hyd', 'Motive power']].map(function (pair) {
            var id = pair[0], m = VJP.design.METRIC[id], v = m.get(D.R);
            return h('div', { class: 'kv', 'data-tip': m.label }, h('div', { class: 'kv-l', html: esc(pair[1]) + ' <span class="sym">' + VJP.schema.symHTML(m.sym) + '</span>' }),
              h('div', { class: 'kv-v' }, h('span', { class: 'num', text: ui.metricText(f, m, v) }), ' ', h('span', { class: 'kv-u', text: f.u(m.dim) })));
          })),
          h('div', { class: 'home-actions' },
            h('button', { class: 'btn sm', type: 'button', html: icon('inputs') + 'Inputs', onClick: function () { c.nav('inputs'); } }),
            h('button', { class: 'btn sm', type: 'button', html: icon('results') + 'Results', onClick: function () { c.nav('results'); } }),
            h('button', { class: 'btn sm', type: 'button', html: icon('schematic') + 'Schematic', onClick: function () { c.nav('schematic'); } }),
            h('button', { class: 'btn sm', type: 'button', html: icon('folder') + 'Project & revisions…', onClick: c.actions.project }))));
      grid.appendChild(cur);

      var list = store.listProjects();
      var saved = h('section', { class: 'panel home-saved' }, h('div', { class: 'panel-h' }, h('h2', { text: 'Saved projects' }), h('span', { class: 'ph-sub', text: 'Stored in this browser' })));
      if (!list.length) {
        saved.appendChild(h('div', { class: 'empty' },
          h('img', { src: ui.asset('brand/venturi-jet-pump-mark.png'), alt: '' }),
          h('h3', { text: 'No saved projects yet' }),
          h('p', { text: 'Press Save (Ctrl+S) to store the current project as Rev ' + r.rev + '. Saved projects and revisions appear here and become available for comparison.' })));
      } else {
        var t = h('table', { class: 'tbl' });
        t.innerHTML = '<thead><tr><th>Project</th><th>Name</th><th>Rev</th><th>Status</th><th>Modified</th><th class="r"></th></tr></thead>';
        var tb = h('tbody');
        list.forEach(function (e) {
          var isCur = e.id === p.id;
          var open = h('button', { class: 'btn xs', type: 'button', text: isCur ? 'Open now' : 'Open', disabled: isCur });
          open.addEventListener('click', function () {
            var go = function () { if (store.openProject(e.id)) { ui.toast(e.number + ' opened'); c.nav('inputs'); } else ui.toast('Project could not be read from storage', 'fail'); };
            if (store.saveState === 'unsaved' || store.saveState === 'new') ui.confirm({ title: 'Unsaved changes', text: 'The working copy has unsaved changes that will be discarded.', ok: 'Discard and open', danger: true }).then(function (y) { if (y) go(); });
            else go();
          });
          var del = h('button', { class: 'btn xs ghost danger', type: 'button', 'aria-label': 'Delete ' + e.number, html: icon('trash', 'sm'), disabled: isCur, 'data-tip': isCur ? 'The open project cannot be deleted' : 'Delete from this browser' });
          del.addEventListener('click', function () {
            ui.confirm({ title: 'Delete ' + e.number + '?', text: 'This permanently removes “' + e.name + '” and all its revisions from this browser. Export the project file first if you may need it.', ok: 'Delete project', danger: true })
              .then(function (y) { if (y) { store.deleteProject(e.id); ui.toast(e.number + ' deleted'); el.innerHTML = ''; VJP.pages.home.mount(el, c); } });
          });
          tb.appendChild(h('tr', null, h('td', { class: 'mono', text: e.number }), h('td', { text: e.name }), h('td', { class: 'mono', text: 'Rev ' + (e.rev || 'A') + (e.revCount > 1 ? ' (' + e.revCount + ')' : '') }),
            h('td', { html: statusChip(e.status || 'Draft') }), h('td', { class: 'ref', text: ui.dateStr(e.modified, true) }), h('td', { class: 'r' }, h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } }, open, del))));
        });
        t.appendChild(tb);
        saved.appendChild(h('div', { class: 'tbl-wrap' }, t));
      }
      grid.appendChild(saved);
      page.appendChild(grid);

      // ---- workflow map ----
      var wf = h('section', { class: 'panel home-wf' }, h('div', { class: 'panel-h' }, h('h2', { text: 'Engineering workflow' }), h('span', { class: 'ph-sub', text: 'Move freely between steps — every page reads the same design state' })));
      var row = h('div', { class: 'wf-row' });
      c.app.NAV.forEach(function (n, i) {
        var b = h('button', { class: 'wf-step' + (n.group === 'reference' ? ' ref' : ''), type: 'button', html: '<span class="wf-no">' + n.no + '</span>' + icon(n.icon, 'lg') + '<span class="wf-l">' + esc(n.label) + '</span>' });
        b.addEventListener('click', function () { c.nav(n.id); });
        row.appendChild(b);
        if (i < 5) row.appendChild(h('span', { class: 'wf-arrow', html: icon('arrow-right') }));
        if (i === 5) row.appendChild(h('span', { class: 'wf-div' }));
      });
      wf.appendChild(h('div', { class: 'panel-b' }, row));
      page.appendChild(wf);

      el.appendChild(page);
      if (c.params.new) setTimeout(function () { newProjectDialog(c); }, 0);
    }
  };
})(typeof window !== 'undefined' ? window : this);
