/* APPLICATION SHELL — router, header, sidebar, dialogs, shortcuts, render loop.
 *
 *   store (inputs, project, revisions) ──change──► design.evaluate() ──► D
 *   D is handed to the active page only (other pages render when opened), so
 *   every page always shows the same authoritative design state.
 * ========================================================================== */
(function () {
  'use strict';
  var VJP = window.VJP, ui = VJP.ui, h = ui.h, icon = ui.icon, esc = ui.esc;
  VJP.pages = VJP.pages || {};

  var store = new VJP.state.Store();
  var app = {
    store: store, D: null, sys: store.prefs.system, route: { page: 'home', params: {} },
    selection: { comp: null, dim: null }, flashKey: null
  };
  window.VJP_APP = app;

  var NAV = [
    { id: 'inputs', no: 1, label: 'Inputs', icon: 'inputs', group: 'workflow' },
    { id: 'steps', no: 2, label: 'Calculation Steps', icon: 'steps', group: 'workflow' },
    { id: 'results', no: 3, label: 'Results', icon: 'results', group: 'workflow' },
    { id: 'schematic', no: 4, label: 'Schematic', icon: 'schematic', group: 'workflow' },
    { id: 'profiles', no: 5, label: 'Hydraulic Profiles', icon: 'profiles', group: 'workflow' },
    { id: 'validation', no: 6, label: 'Validation', icon: 'validation', group: 'workflow' },
    { id: 'equations', no: 7, label: 'Governing Equations', icon: 'equations', group: 'reference' },
    { id: 'compare', no: 8, label: 'Compare', icon: 'compare', group: 'reference' }
  ];
  app.NAV = NAV;

  /* ------------------------------------------------------------ theming */
  function applyPrefs() {
    var de = document.documentElement;
    de.setAttribute('data-theme', store.prefs.theme);
    de.classList.toggle('reduce-motion', store.prefs.reducedMotion === true);
    de.classList.toggle('motion-ok', store.prefs.reducedMotion === false);
    de.classList.remove('pre-collapsed');
    document.getElementById('app').classList.toggle('side-collapsed', store.prefs.sidebar === 'collapsed');
  }

  /* ------------------------------------------------------------- header */
  var el = {};
  function buildHeader() {
    var hdr = document.getElementById('hdr');
    hdr.innerHTML = '';
    el.burger = h('button', { class: 'btn ghost icon hdr-burger', type: 'button', 'aria-label': 'Open navigation', 'aria-controls': 'side', 'aria-expanded': 'false', html: icon('list'),
      onClick: function () { setSideOpen(!document.getElementById('app').classList.contains('side-open')); } });
    el.brand = h('button', { class: 'hdr-brand', type: 'button', 'aria-label': 'Project home', 'data-tip': 'Project home',
      html: '<img src="' + ui.asset('brand/venturi-jet-pump-mark.png') + '" alt="" width="34" height="34"><span class="bt"><b>Venturi Jet Pump</b><span>Design Studio</span></span>',
      onClick: function () { navigate('home'); } });
    el.project = h('button', { class: 'hdr-project', type: 'button', 'aria-haspopup': 'dialog', 'data-tip': 'Project details & revisions', onClick: openProjectDialog });
    el.rev = h('div', { class: 'hdr-rev' });
    el.save = h('div', { class: 'hdr-save', role: 'status', 'aria-live': 'polite', tabindex: '0' });
    el.undo = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Undo', 'data-tip': 'Undo', 'data-tip-s': 'Ctrl+Z', html: icon('undo'), onClick: function () { store.undo(); } });
    el.redo = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Redo', 'data-tip': 'Redo', 'data-tip-s': 'Ctrl+Y', html: icon('redo'), onClick: function () { store.redo(); } });
    el.units = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Unit system' });
    [['si', 'SI'], ['imp', 'Imperial']].forEach(function (u) {
      var b = h('button', { type: 'button', role: 'radio', 'data-sys': u[0], text: u[1], 'data-tip': u[0] === 'si' ? 'SI units (mm, bar, L/min, m/s)' : 'Imperial units (in, psi, US gpm, ft/s)' });
      b.addEventListener('click', function () { setSystem(u[0]); });
      el.units.appendChild(b);
    });
    el.saveBtn = h('button', { class: 'btn', type: 'button', 'data-tip': 'Save revision', 'data-tip-s': 'Ctrl+S', html: icon('save') + '<span>Save</span>', onClick: function () { doSave(); } });
    el.report = h('button', { class: 'btn', type: 'button', 'data-tip': 'Engineering report', 'data-tip-s': 'Preview, then print or save as PDF', html: icon('report') + '<span>Report / PDF</span>', onClick: openReport });
    el.more = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'More actions', 'aria-haspopup': 'menu', 'aria-expanded': 'false', html: icon('more'), onClick: function () { ui.menu(el.more, moreItems()); } });
    hdr.append(el.burger, el.brand, h('div', { class: 'hdr-sep' }), el.project, el.rev, el.save, h('div', { class: 'hdr-spacer' }),
      h('div', { class: 'hdr-actions' }, h('div', { class: 'btn-group' }, el.undo, el.redo), el.units, el.saveBtn, el.report, el.more));
  }
  var STATE_TEXT = { saved: 'Saved', unsaved: 'Unsaved changes', new: 'Not saved', saving: 'Saving…', error: 'Not saved — storage error' };
  function statusChipClass(st) { return 'chip st-' + String(st || 'Draft').toLowerCase().replace(/\s+/g, '').replace('inreview', 'review'); }
  function updateHeader() {
    var p = store.project, r = store.activeRev(), st = store.saveState;
    el.project.innerHTML = '<span class="pno">' + esc(p.number) + '</span><span class="pname">' + esc(p.name) + '</span>' + icon('chevron-down', 'sm');
    el.rev.innerHTML = '<span class="rev-tag" data-tip="Active revision">Rev ' + esc(r.rev) + '</span><span class="' + statusChipClass(r.status) + '" data-tip="Revision status">' + esc(r.status) + '</span>';
    el.save.setAttribute('data-state', st);
    var when = st === 'saved' ? ' · ' + ui.timeStr(store.lastSaved()) : '';
    el.save.innerHTML = '<span class="dot"></span><span>' + STATE_TEXT[st] + when + '</span>';
    var tip = {
      saved: 'Rev ' + r.rev + ' is stored in this browser (' + ui.dateStr(store.lastSaved(), true) + ').',
      unsaved: 'The working copy differs from the stored Rev ' + r.rev + '. A local recovery draft is kept, but the revision is NOT saved until you press Save.',
      new: 'This project has never been saved. A local recovery draft is kept, but nothing is stored as a revision yet.',
      saving: 'Writing Rev ' + r.rev + ' to browser storage…',
      error: store.saveError || 'The last save failed.'
    }[st];
    el.save.setAttribute('data-tip', STATE_TEXT[st]); el.save.setAttribute('data-tip-s', tip);
    el.saveBtn.classList.toggle('primary', st === 'unsaved' || st === 'new' || st === 'error');
    el.saveBtn.disabled = st === 'saving';
    el.undo.disabled = !store.canUndo(); el.redo.disabled = !store.canRedo();
    Array.prototype.forEach.call(el.units.children, function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-sys') === app.sys)); });
    document.title = p.number + ' Rev ' + r.rev + (st === 'saved' ? '' : ' •') + ' — Venturi Jet Pump Design Studio';
  }

  /* ------------------------------------------------------------ sidebar */
  // Off-canvas navigation (≤ 820 px): toggled by the header burger, closed by
  // choosing a page, clicking the scrim or pressing Esc.
  function setSideOpen(open) {
    document.getElementById('app').classList.toggle('side-open', open);
    if (el.burger) { el.burger.setAttribute('aria-expanded', String(open)); el.burger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); }
  }
  function buildSidebar() {
    var side = document.getElementById('side');
    side.innerHTML = '';
    var scroll = h('div', { class: 'side-scroll' });
    function list(group, label) {
      scroll.appendChild(h('div', { class: 'side-label', text: label }));
      var ul = h('ul', { class: 'nav' + (group === 'workflow' ? ' workflow' : '') });
      NAV.filter(function (n) { return n.group === group; }).forEach(function (n) {
        var b = h('button', { class: 'nav-item', type: 'button', 'data-page': n.id, 'data-tip': n.label, 'data-tip-s': 'Alt+' + n.no,
          html: '<span class="nno">' + n.no + '</span><span class="nlbl">' + esc(n.label) + '</span><span class="nbadge hidden"></span>' });
        b.addEventListener('click', function () { navigate(n.id); setSideOpen(false); });
        ul.appendChild(h('li', null, b));
      });
      scroll.appendChild(ul);
    }
    list('workflow', 'Engineering workflow');
    list('reference', 'Reference & review');
    el.sideStatus = h('button', { class: 'side-status', type: 'button', onClick: function () { navigate('validation'); } });
    var collapse = h('button', { class: 'side-collapse', type: 'button', html: icon('sidebar') + '<span>Collapse sidebar</span>',
      onClick: function () { store.setPref('sidebar', store.prefs.sidebar === 'collapsed' ? 'expanded' : 'collapsed'); applyPrefs(); } });
    side.append(scroll, h('div', { class: 'side-foot' }, el.sideStatus, collapse));
    if (!document.querySelector('.side-scrim')) document.getElementById('app').appendChild(h('div', { class: 'side-scrim', 'aria-hidden': 'true', onClick: function () { setSideOpen(false); } }));
  }
  function updateSidebar() {
    var D = app.D, V = D.V;
    document.querySelectorAll('.nav-item').forEach(function (b) {
      var id = b.getAttribute('data-page');
      if (id === app.route.page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      var badge = b.querySelector('.nbadge'), txt = '', cls = '', tip = '';
      if (id === 'inputs') {
        var ne = V.fieldErrors.length, nw = V.fieldWarns.length;
        if (ne) { txt = icon('x', 'xs') + ne; cls = 'fail'; tip = ne + ' invalid input' + (ne > 1 ? 's' : ''); }
        else if (nw) { txt = icon('alert', 'xs') + nw; cls = 'warn'; tip = nw + ' input' + (nw > 1 ? 's' : '') + ' outside the recommended range'; }
      } else if (id === 'validation') {
        var c = D.status.counts;
        if (D.blocked) { txt = icon('blocked', 'xs'); cls = 'fail'; tip = 'Calculation blocked'; }
        else if (c.fail) { txt = icon('x', 'xs') + c.fail; cls = 'fail'; tip = c.fail + ' failed'; }
        else if (c.review) { txt = icon('alert', 'xs') + c.review; cls = 'warn'; tip = c.review + ' to review'; }
        else { txt = icon('check', 'xs'); cls = 'ok'; tip = 'All checks pass'; }
      } else if (id === 'compare') {
        txt = String(store.revisions.length); cls = ''; tip = store.revisions.length + ' revision' + (store.revisions.length > 1 ? 's' : '');
      }
      badge.className = 'nbadge' + (txt ? ' ' + cls : ' hidden');
      badge.innerHTML = txt;
      if (tip) b.setAttribute('data-tip-s', tip + ' · Alt+' + NAV.filter(function (n) { return n.id === id; })[0].no);
    });
    var s = D.status;
    el.sideStatus.setAttribute('data-tone', s.tone);
    el.sideStatus.setAttribute('data-tip', s.title);
    el.sideStatus.setAttribute('data-tip-s', s.line);
    el.sideStatus.innerHTML = '<span class="ss-ic">' + icon(s.state === 'blocked' ? 'blocked' : s.tone === 'pass' ? 'check-circle' : s.tone === 'fail' ? 'x-circle' : 'alert', 'lg') + '</span>' +
      '<span class="ss-body"><div class="ss-t">' + esc(s.title) + '</div><div class="ss-l">' + esc(s.line) + '</div></span>';
  }

  /* ------------------------------------------------------------- router */
  function parseHash() {
    var hsh = (location.hash || '').replace(/^#\/?/, '');
    var parts = hsh.split('?'), page = parts[0] || 'home', params = {};
    if (parts[1]) parts[1].split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    if (!VJP.pages[page]) page = 'home';
    return { page: page, params: params };
  }
  function navigate(page, params, opts) {
    var q = params ? Object.keys(params).filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    var target = '#/' + page + (q ? '?' + q : '');
    if (location.hash === target) { onRoute(true); return; }
    if (opts && opts.replace) { history.replaceState(null, '', target); onRoute(); }
    else location.hash = target;
  }
  app.navigate = navigate;

  var pageEl, current = null, currentId = null, scrollMemo = {};
  function ctx() {
    return {
      app: app, store: store, D: app.D, sys: app.sys, f: ui.F(app.sys), params: app.route.params,
      nav: navigate, select: selectComponent, selection: app.selection, prefs: store.prefs,
      setPref: function (k, v) { store.setPref(k, v); },
      actions: { save: doSave, saveAsRevision: saveAsRevisionDialog, project: openProjectDialog, report: openReport,
        usePback: usePbackComputed, focusInput: focusInput, exportCSV: exportResultsCSV, importProject: importProject }
    };
  }
  function onRoute(force) {
    var r = parseHash();
    var same = r.page === app.route.page;
    app.route = r;
    if (r.params.c) app.selection.comp = r.params.c;
    mountPage(!same || force);
  }
  function mountPage(fresh) {
    var P = VJP.pages[app.route.page];
    var main = document.getElementById('main');
    if (currentId) scrollMemo[currentId] = main.scrollTop;
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
    pageEl.innerHTML = '';
    current = P; currentId = app.route.page;
    try { P.mount(pageEl, ctx()); } catch (e) { console.error(e); pageEl.appendChild(pageError(e)); }
    main.scrollTop = fresh && !app.route.params.keepScroll ? 0 : (scrollMemo[currentId] || 0);
    if (fresh) main.focus({ preventScroll: true });
    updateChrome();
  }
  function pageError(e) {
    return h('div', { class: 'page' }, h('div', { class: 'panel' }, h('div', { class: 'panel-b' },
      h('div', { class: 'blocker' }, h('span', { class: 'bk-ic', html: icon('x-circle', 'lg') }), h('div', { class: 'bk-t', text: 'This view could not be rendered' }),
        h('div', { class: 'bk-row', text: String(e && e.message || e) })))));
  }
  // One update per burst of store events. A microtask (not requestAnimationFrame) so the
  // authoritative state never lags behind the inputs, even while the tab is not painting.
  var raf = null, forceNext = false;
  function scheduleUpdate(force) {
    if (force) forceNext = true;
    if (raf) return;
    raf = true;
    Promise.resolve().then(function () {
      raf = null;
      var prevId = app.D && app.D.id, f = forceNext;
      forceNext = false;
      recompute();
      if (app.D.id !== prevId || f) {
        if (current && current.update) { try { current.update(ctx()); } catch (e) { console.error(e); } }
        else mountPage(false);
      }
      updateChrome();
    });
  }
  function recompute() { app.D = VJP.design.evaluate(store.inputs, store.invalid); }
  function updateChrome() { updateHeader(); updateSidebar(); }

  /* -------------------------------------------------- selection & linking */
  // one shared selection (component) — schematic, profiles and results all read it
  function selectComponent(id, opts) {
    app.selection.comp = id || null;
    if (opts && opts.dim !== undefined) app.selection.dim = opts.dim;
    if (current && current.onSelect) current.onSelect(app.selection);
  }
  function focusInput(key) { navigate('inputs', { f: key }); }
  function usePbackComputed() {
    var D = app.D; if (!D || D.blocked) return;
    store.set({ Pback: D.R.returnLine.dP_req });
    ui.toast('P_back set to the computed return-line demand (' + ui.F(app.sys).q(D.R.returnLine.dP_req, 'pressure_bar') + ')');
  }

  /* ------------------------------------------------------------- actions */
  function setSystem(sys) {
    if (sys === app.sys) return;
    app.sys = sys; store.setPref('system', sys);
    mountPage(false);
    ui.toast(sys === 'imp' ? 'Imperial units — display only; the model computes in its metric basis' : 'SI units', 'info');
  }
  function doSave() {
    if (store.saveState === 'saving') return;
    store.save(function (ok, err) {
      if (ok) ui.toast('Rev ' + store.activeRev().rev + ' saved to this browser');
      else ui.toast(err || 'Save failed', 'fail', 5000);
    });
  }
  function saveAsRevisionDialog() {
    var note = h('textarea', { class: 'txt-input', rows: '3', placeholder: 'What changed in this revision? (e.g. increased motive pressure to 14 bar)' });
    var status = h('select', { class: 'txt-input' }, VJP.state.STATUSES.map(function (s) { return h('option', { value: s, text: s }); }));
    var next = store.nextRevLetter();
    ui.modal({
      title: 'Save as new revision', sub: 'Creates Rev ' + next + ' from the current working copy. Rev ' + store.activeRev().rev + ' is kept unchanged for comparison.',
      body: h('div', null,
        h('div', { class: 'form-row' }, h('label', { text: 'Revision note' }), note),
        h('div', { class: 'form-row' }, h('label', { text: 'Status' }), status)),
      actions: [{ label: 'Cancel' }, { label: 'Create Rev ' + next, primary: true, onClick: function () {
        if (Object.keys(store.invalid).length) { ui.toast('Correct the invalid inputs before saving', 'fail'); return false; }
        store.saveAsRevision({ note: note.value.trim(), status: status.value }, function (ok, err) {
          ui.toast(ok ? 'Rev ' + next + ' created and saved' : (err || 'Save failed'), ok ? 'ok' : 'fail');
        });
      } }]
    });
  }
  function confirmDiscardIfDirty(what) {
    if (store.saveState !== 'unsaved' && store.saveState !== 'new') return Promise.resolve(true);
    return ui.confirm({ title: 'Unsaved changes', text: 'The working copy has unsaved changes. ' + what + ' will discard them. Continue?', ok: 'Discard and continue', danger: true });
  }
  function openProjectDialog() {
    var p = store.project;
    function inp(k, label, ph) { var i = h('input', { class: 'txt-input', value: p[k] || '', placeholder: ph || '' }); i.dataset.k = k; return h('div', { class: 'form-row' }, h('label', { text: label }), i); }
    var notes = h('textarea', { class: 'txt-input', rows: '2', placeholder: 'Scope, basis of design, references…' }); notes.value = p.notes || ''; notes.dataset.k = 'notes';
    var form = h('div', null,
      h('div', { class: 'form-grid' }, inp('number', 'Project number', 'VJP-001'), inp('name', 'Project name', 'Untitled project'),
        inp('client', 'Client', ''), inp('site', 'Site / drive', ''), inp('engineer', 'Engineer', '')),
      h('div', { class: 'form-row' }, h('label', { text: 'Notes' }), notes));
    var revTable = h('table', { class: 'tbl' });
    function renderRevs() {
      revTable.innerHTML = '<thead><tr><th>Rev</th><th>Status</th><th>Note</th><th>Saved</th><th class="r"></th></tr></thead>';
      var tb = h('tbody');
      store.revisions.forEach(function (r) {
        var sel = h('select', { class: 'txt-input', style: { height: '28px', width: '124px' } }, VJP.state.STATUSES.map(function (s) { var o = h('option', { value: s, text: s }); if (s === r.status) o.selected = true; return o; }));
        sel.addEventListener('change', function () { store.updateRevision(r.id, { status: sel.value }); });
        var note = h('input', { class: 'txt-input', value: r.note || '', style: { height: '28px' } });
        note.addEventListener('change', function () { store.updateRevision(r.id, { note: note.value }); });
        var active = r.id === store.activeRevId;
        var open = h('button', { class: 'btn xs', type: 'button', text: active ? 'Active' : 'Open', disabled: active });
        open.addEventListener('click', function () {
          confirmDiscardIfDirty('Opening Rev ' + r.rev).then(function (go) { if (go) { store.openRevision(r.id); renderRevs(); ui.toast('Rev ' + r.rev + ' opened'); } });
        });
        tb.appendChild(h('tr', null, h('td', { class: 'mono', html: '<b>Rev ' + esc(r.rev) + '</b>' }), h('td', null, sel), h('td', null, note),
          h('td', { class: 'ref', text: r.savedAt ? ui.dateStr(r.savedAt, true) : 'not saved' }), h('td', { class: 'r' }, open)));
      });
      revTable.appendChild(tb);
    }
    renderRevs();
    var body = h('div', null, form,
      h('div', { class: 'eyebrow', style: { margin: '6px 0 8px' }, text: 'Revisions' }),
      h('div', { class: 'panel' }, h('div', { class: 'tbl-wrap' }, revTable)),
      h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' }, text: 'Projects and revisions are stored in this browser only. Use Export project to keep a portable file.' }));
    ui.modal({
      title: 'Project & revisions', sub: p.number + ' · created ' + ui.dateStr(p.created), wide: true, body: body,
      actions: [
        { label: 'Save as new revision…', icon: 'plus', left: true, onClick: function () { apply(); setTimeout(saveAsRevisionDialog, 30); } },
        { label: 'Close', onClick: function () { apply(); } },
        { label: 'Apply & save', primary: true, onClick: function () { apply(); doSave(); } }
      ]
    });
    function apply() {
      var meta = {};
      body.querySelectorAll('[data-k]').forEach(function (i) { meta[i.dataset.k] = i.value.trim(); });
      if (!meta.name) meta.name = 'Untitled project';
      if (!meta.number) meta.number = store.project.number;
      store.updateProject(meta);
    }
  }
  function moreItems() {
    var dirty = store.saveState === 'unsaved';
    return [
      { head: 'Project' },
      { label: 'Project & revisions…', icon: 'folder', onClick: openProjectDialog },
      { label: 'Save as new revision…', icon: 'stack', onClick: saveAsRevisionDialog },
      { label: 'Discard unsaved changes', icon: 'reset', disabled: !dirty, onClick: function () {
        ui.confirm({ title: 'Discard unsaved changes?', text: 'The working copy will revert to the stored Rev ' + store.activeRev().rev + '.', ok: 'Discard changes', danger: true })
          .then(function (y) { if (y) { store.discardChanges(); ui.toast('Reverted to stored Rev ' + store.activeRev().rev); } });
      } },
      { label: 'New project…', icon: 'file-plus', onClick: function () { navigate('home', { new: '1' }); } },
      { sep: true },
      { head: 'Data' },
      { label: 'Export project file (.json)', icon: 'download', onClick: exportProject },
      { label: 'Import project file…', icon: 'upload', onClick: importProject },
      { label: 'Export results (CSV)', icon: 'table', onClick: exportResultsCSV },
      { label: 'Reset all inputs to defaults', icon: 'reset', onClick: function () {
        ui.confirm({ title: 'Reset all inputs?', text: 'Every input returns to the spreadsheet default (Design A). This can be undone with Ctrl+Z.', ok: 'Reset all' })
          .then(function (y) { if (y) { store.resetAll(); ui.toast('All inputs reset to defaults'); } });
      } },
      { sep: true },
      { head: 'Display' },
      { label: store.prefs.theme === 'dark' ? 'Light theme' : 'Dark theme', icon: store.prefs.theme === 'dark' ? 'sun' : 'moon', onClick: function () { store.setPref('theme', store.prefs.theme === 'dark' ? 'light' : 'dark'); applyPrefs(); mountPage(false); } },
      { label: ui.reducedMotion() ? 'Allow motion' : 'Reduce motion', icon: 'motion', onClick: function () { store.setPref('reducedMotion', !ui.reducedMotion()); applyPrefs(); mountPage(false); } },
      { label: 'Keyboard shortcuts', icon: 'keyboard', kbd: '?', onClick: shortcutsDialog },
      { label: 'About & model integrity', icon: 'info', onClick: aboutDialog }
    ];
  }
  function exportProject() {
    var p = store.project;
    ui.download(p.number + '_' + p.name.replace(/[^\w\-]+/g, '_') + '.vjp.json', store.exportProject(), 'application/json');
    ui.toast('Project file exported' + (store.isDirty() ? ' (includes the unsaved working copy)' : ''));
  }
  function importProject() {
    var fi = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    fi.addEventListener('change', function () {
      var file = fi.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        confirmDiscardIfDirty('Importing a project').then(function (go) {
          if (!go) return;
          try { store.importProject(String(rd.result)); ui.toast('Imported as a new project — press Save to store it'); navigate('inputs'); }
          catch (e) { ui.toast('Import failed: ' + e.message, 'fail', 5000); }
        });
      };
      rd.readAsText(file);
    });
    document.body.appendChild(fi); fi.click(); setTimeout(function () { fi.remove(); }, 1000);
  }
  function exportResultsCSV() {
    var D = app.D, f = ui.F(app.sys);
    if (D.blocked) { ui.toast('Calculation blocked — nothing to export', 'fail'); return; }
    var rows = [['Venturi Jet Pump Design Studio — results'], ['Project', store.project.number + ' ' + store.project.name], ['Revision', 'Rev ' + store.activeRev().rev + ' (' + store.activeRev().status + ')' + (store.isDirty() ? ' — unsaved working copy' : '')],
      ['Units', app.sys === 'imp' ? 'Imperial' : 'SI'], ['Status', D.status.title + ' — ' + D.status.line], [], ['Group', 'Parameter', 'Symbol', 'Value', 'Unit', 'Type', 'Sheet ref']];
    VJP.design.METRICS.forEach(function (m) {
      var v = m.get(D.R);
      rows.push([VJP.design.GROUPS.filter(function (g) { return g.id === m.g; })[0].title, m.label, VJP.schema.symText(m.sym), m.text ? v : VJP.units.plain(v, m.dim, app.sys, 6), m.text ? '' : f.u(m.dim), VJP.schema.TYPES[m.type].label, m.ref]);
    });
    ui.download(store.project.number + '_Rev' + store.activeRev().rev + '_results.csv', ui.csv(rows), 'text/csv;charset=utf-8');
    ui.toast('Results exported (CSV)');
  }
  function openReport() {
    if (!VJP.report) return;
    VJP.report.open({ store: store, D: app.D, sys: app.sys });
  }
  function shortcutsDialog() {
    var rows = [['Ctrl + S', 'Save the active revision'], ['Ctrl + Z / Ctrl + Y', 'Undo / redo input changes'], ['Alt + 1 … 8', 'Go to workflow page 1–8'], ['Alt + 0', 'Project home'],
      ['↑ / ↓ in a field', 'Step value (Shift ×10, Alt ×0.1)'], ['Enter / Esc in a field', 'Commit / revert the edit'],
      ['F  ·  + / −  ·  0', 'Schematic: fit · zoom · reset view'], ['D  ·  L', 'Schematic: dimensions · labels'], ['Space', 'Flow view: play / pause'], ['?', 'This list']];
    var t = h('table', { class: 'tbl' }, h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', { html: r[0].split('  ·  ').map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join(' ') }), h('td', { text: r[1] })); })));
    ui.modal({ title: 'Keyboard shortcuts', body: h('div', { class: 'panel' }, t), actions: [{ label: 'Close', primary: true }] });
  }
  function aboutDialog() {
    var res = VJP.test ? VJP.test.run() : null;
    var body = h('div', null,
      h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '14px' } },
        h('img', { src: ui.asset('brand/venturi-jet-pump-mark.png'), alt: '', width: '56', height: '56' }),
        h('div', null, h('div', { style: { fontWeight: '650', fontSize: '15px' }, text: 'Venturi Jet Pump Design Studio' }),
          h('div', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Ejector design for MTBM slurry circuits · calculation model VENTURI_JET_PUMP_CALCULATOR_v4' }))),
      h('div', { class: 'panel' }, h('div', { class: 'panel-b' },
        h('div', { class: 'eyebrow', text: 'Model integrity' }),
        h('div', { style: { marginTop: '6px', fontSize: '13.5px' }, html: res
          ? (res.fail ? '<span class="si fail">' + icon('x') + '</span> ' : '<span class="si ok">' + icon('check') + '</span> ') +
            '<b class="mono">' + res.pass + ' / ' + res.total + '</b> engine values reproduce the spreadsheet’s stored results (default case, tolerance 10⁻⁶).'
          : 'Regression suite not loaded.' }),
        h('p', { class: 'dim', style: { fontSize: '12.5px', marginTop: '8px' }, text: 'The calculation engine is a cell-by-cell port of the workbook and is not modified by the user interface. Hydraulic profiles and the flow visualization are physics-based reconstructions anchored to the calculated station values — they are not CFD.' }))));
    ui.modal({ title: 'About', body: body, actions: [{ label: 'Close', primary: true }] });
  }

  /* ---------------------------------------------------------- shortcuts */
  function typingInText(t) { return t && (t.tagName === 'TEXTAREA' || (t.classList && t.classList.contains('txt-input')) || t.isContentEditable); }
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); doSave(); return; }
    if (e.key === 'Escape' && document.getElementById('app').classList.contains('side-open')) { setSideOpen(false); el.burger.focus(); return; }
    if (typingInText(e.target)) return;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); return; }
    if (e.altKey && !mod && /^[0-8]$/.test(e.key)) {
      e.preventDefault();
      if (e.key === '0') navigate('home'); else navigate(NAV[Number(e.key) - 1].id);
      return;
    }
    if (e.key === '?' && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'))) { e.preventDefault(); shortcutsDialog(); }
  });

  /* ---------------------------------------------------------------- boot */
  function boot() {
    applyPrefs();
    ui.initTooltips();
    buildHeader(); buildSidebar();
    pageEl = document.getElementById('page');
    recompute();
    store.on(function (evt) {
      if (evt.type === 'inputs' || evt.type === 'revisions' || evt.type === 'project') scheduleUpdate(evt.type !== 'inputs' || !!evt.revision);
      if (evt.type === 'save' || evt.type === 'project' || evt.type === 'revisions') updateHeader();
      if (evt.type === 'save' && current && current.onSave) current.onSave(ctx());
    });
    window.addEventListener('hashchange', function () { onRoute(); });
    window.addEventListener('beforeunload', function () { store.writeDraft(); });
    if (!location.hash) history.replaceState(null, '', '#/home');
    onRoute(true);
    if (store.recovered) ui.toast('Recovered unsaved changes from ' + ui.dateStr(store.recovered, true) + ' — not yet saved', 'warn', 5200);
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener && window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function () { mountPage(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
