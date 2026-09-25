/* APPLICATION STATE — working inputs, undo/redo, project + revisions,
 * persistence and preferences.
 *
 * Persistence model (browser localStorage, this device only):
 *   · A project holds revisions (Rev A, B, ...). Each revision stores a full
 *     input set, a status (Draft / In Review / Approved / Superseded) and notes.
 *   · The working copy is what the engineer is editing. "Save" writes it into
 *     the active revision. Save state is always one of:
 *        new     — project never saved
 *        saved   — working copy == stored revision
 *        unsaved — working copy differs from the stored revision
 *        saving  — write in progress
 *        error   — the browser refused the write (storage full / blocked)
 *   · A recovery draft of the working copy is kept separately so a reload
 *     never loses work — but it is NOT a save, and the UI says so.
 * ========================================================================== */
(function (root) {
  'use strict';
  var LS = {
    index: 'vjp.projects.v2',
    project: function (id) { return 'vjp.project.v2.' + id; },
    draft: 'vjp.draft.v2',
    prefs: 'vjp_prefs_v1'
  };
  var STATUSES = ['Draft', 'In Review', 'Approved', 'Superseded'];

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function now() { try { return new Date().toISOString(); } catch (e) { return ''; } }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function lsGet(k) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); return true; } catch (e) { return false; } }
  function defaults() { return clone(VJP.engine.DEFAULT_INPUTS); }
  function complete(inputs) { var d = defaults(); for (var k in inputs) if (k in d) d[k] = inputs[k]; return d; }
  function same(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    return String(a) === String(b);
  }
  function sameInputs(a, b) {
    if (!a || !b) return false;
    for (var k in VJP.engine.DEFAULT_INPUTS) if (!same(a[k], b[k])) return false;
    return true;
  }
  function revLetter(n) { var s = ''; n = n + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function metaKey(p) { return JSON.stringify([p.number, p.name, p.client, p.site, p.engineer, p.notes]); }
  function revKey(revs) { return JSON.stringify(revs.map(function (r) { return [r.id, r.rev, r.status, r.note]; })); }

  function Store() {
    this.listeners = [];
    this.prefs = loadPrefs();
    this.undoStack = []; this.redoStack = [];
    this._co = null;
    this.invalid = {};
    this.saveState = 'new'; this.saveError = null;
    this.recovered = null;
    this._boot();
  }
  var P = Store.prototype;

  P.on = function (fn) { this.listeners.push(fn); };
  P.emit = function (evt) { this.listeners.forEach(function (f) { try { f(evt); } catch (e) { console.error(e); } }); };

  /* ------------------------------------------------------------ boot/session */
  P._boot = function () {
    var draft = lsGet(LS.draft);
    if (draft && draft.project && draft.revisions && draft.revisions.length) {
      this._load(draft.project, draft.revisions, draft.activeRevId, draft.inputs);
      this.saved = lsGet(LS.project(draft.project.id));
      this._refreshSaveState();
      // announce a recovery only when there is real work in the draft (not an untouched new project)
      var worked = this.saved ? this.saveState !== 'saved' : !sameInputs(this.inputs, VJP.engine.DEFAULT_INPUTS) || this.project.name !== 'Untitled project';
      if (worked) this.recovered = draft.t || null;
      return;
    }
    var last = this.prefs.lastProjectId && lsGet(LS.project(this.prefs.lastProjectId));
    if (last) { this._openStored(last); return; }
    this._fresh({});
  };
  P._load = function (project, revisions, activeRevId, inputs) {
    this.project = clone(project);
    this.revisions = clone(revisions).map(function (r) { r.inputs = complete(r.inputs || {}); return r; });
    this.activeRevId = activeRevId && this.revisions.some(function (r) { return r.id === activeRevId; }) ? activeRevId : this.revisions[0].id;
    this.inputs = complete(inputs || this.activeRev().inputs);
    this.invalid = {};
    this.undoStack = []; this.redoStack = []; this._co = null;
  };
  P._openStored = function (stored) {
    this._load(stored.project, stored.revisions, stored.activeRevId, null);
    this.saved = clone(stored);
    this._refreshSaveState();
  };
  P._fresh = function (meta) {
    var t = now();
    var p = {
      id: uid(), number: meta.number || nextNumber(), name: meta.name || 'Untitled project',
      client: meta.client || '', site: meta.site || '', engineer: meta.engineer || '', notes: meta.notes || '',
      created: t, modified: t
    };
    var rev = { id: uid(), rev: 'A', status: 'Draft', note: meta.revNote || 'Initial design', inputs: complete(meta.inputs || defaults()), created: t, savedAt: null };
    this._load(p, [rev], rev.id, null);
    this.saved = null;
    this._refreshSaveState();
  };

  /* ---------------------------------------------------------------- inputs */
  P.activeRev = function () {
    var id = this.activeRevId;
    return this.revisions.filter(function (r) { return r.id === id; })[0] || this.revisions[0];
  };
  P.snapshot = function () { return { inputs: clone(this.inputs), invalid: clone(this.invalid) }; };

  // set(patch, {coalesce: 'field:Pm'}) — consecutive edits of one field form ONE undo step
  P.set = function (patch, opts) {
    opts = opts || {};
    var changed = false;
    for (var k in patch) if (!same(this.inputs[k], patch[k])) changed = true;
    var hadInvalid = false;
    for (var k2 in patch) if (k2 in this.invalid) { delete this.invalid[k2]; hadInvalid = true; }
    if (!changed && !hadInvalid) return;
    if (changed && !opts.noUndo) {
      var t = Date.now();
      if (!(opts.coalesce && this._co && this._co.key === opts.coalesce && t - this._co.t < 4000)) {
        this.undoStack.push(this.snapshot());
        if (this.undoStack.length > 200) this.undoStack.shift();
      }
      this._co = opts.coalesce ? { key: opts.coalesce, t: t } : null;
      this.redoStack = [];
    }
    for (var k3 in patch) this.inputs[k3] = patch[k3];
    this._changed({ type: 'inputs', keys: Object.keys(patch) });
  };
  P.endCoalesce = function () { this._co = null; };
  // raw text that does not parse (empty / not a number): blocks the calculation
  P.setInvalid = function (key, raw) {
    if (this.invalid[key] === raw) return;
    this.invalid[key] = raw;
    this._changed({ type: 'inputs', keys: [key], invalid: true });
  };
  P.clearInvalid = function (key) {
    if (!(key in this.invalid)) return;
    delete this.invalid[key];
    this._changed({ type: 'inputs', keys: [key] });
  };
  P.resetKeys = function (keys) {
    var d = defaults(), patch = {};
    keys.forEach(function (k) { patch[k] = d[k]; });
    this._co = null;
    this.set(patch);
  };
  P.resetAll = function () { this.resetKeys(Object.keys(defaults())); };
  P.isDefault = function (key) { return same(this.inputs[key], VJP.engine.DEFAULT_INPUTS[key]); };
  P.savedValue = function (key) { var r = this._savedRev(); return r ? r.inputs[key] : undefined; };

  P.undo = function () {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    var s = this.undoStack.pop();
    this.inputs = s.inputs; this.invalid = {}; this._co = null;
    this._changed({ type: 'inputs', undo: true });
    return true;
  };
  P.redo = function () {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    var s = this.redoStack.pop();
    this.inputs = s.inputs; this.invalid = {}; this._co = null;
    this._changed({ type: 'inputs', redo: true });
    return true;
  };
  P.canUndo = function () { return this.undoStack.length > 0; };
  P.canRedo = function () { return this.redoStack.length > 0; };

  /* ------------------------------------------------------------ save state */
  // Stored inputs of the ACTIVE revision (viewing another revision is not a change)
  P._savedRev = function () {
    if (!this.saved) return null;
    var id = this.activeRevId;
    return this.saved.revisions.filter(function (r) { return r.id === id; })[0] || null;
  };
  P.isDirty = function () {
    if (!this.saved) return true;
    if (Object.keys(this.invalid).length) return true;
    if (metaKey(this.project) !== metaKey(this.saved.project)) return true;
    if (revKey(this.revisions) !== revKey(this.saved.revisions)) return true;
    var sr = this._savedRev();
    return !sr || !sameInputs(this.inputs, sr.inputs);
  };
  P._refreshSaveState = function () {
    if (this.saveState === 'saving') return;
    var prev = this.saveState;
    if (!this.saved) this.saveState = 'new';
    else if (this.saveState === 'error' && this.isDirty()) this.saveState = 'error';
    else this.saveState = this.isDirty() ? 'unsaved' : 'saved';
    if (prev !== this.saveState) this.emit({ type: 'save', state: this.saveState });
  };
  P._changed = function (evt) {
    this._refreshSaveState();
    this._scheduleDraft();
    this.emit(evt);
  };
  P._scheduleDraft = function () {
    var self = this;
    clearTimeout(this._draftT);
    this._draftT = setTimeout(function () { self.writeDraft(); }, 700);
  };
  P.writeDraft = function () {
    if (this.saveState === 'saved') { lsDel(LS.draft); return; }
    lsSet(LS.draft, { project: this.project, revisions: this.revisions, activeRevId: this.activeRevId, inputs: this.inputs, t: now() });
  };

  // Save the working copy into the active revision. cb(ok, err)
  P.save = function (cb) {
    var self = this;
    if (Object.keys(this.invalid).length) {
      this.saveError = 'Some inputs are empty or not numbers — correct them before saving.';
      this.saveState = 'error'; this.emit({ type: 'save', state: 'error' });
      if (cb) cb(false, this.saveError);
      return;
    }
    this.saveState = 'saving'; this.emit({ type: 'save', state: 'saving' });
    var t = now(), rev = this.activeRev();
    rev.inputs = clone(this.inputs); rev.savedAt = t;
    this.project.modified = t;
    var payload = clone({ app: 'VenturiJetPumpDesignStudio', schema: 2, project: this.project, revisions: this.revisions, activeRevId: this.activeRevId });
    var ok = lsSet(LS.project(this.project.id), payload) && this._writeIndex();
    setTimeout(function () {
      if (ok) {
        self.saved = clone(payload);
        self.saveError = null; self.saveState = 'saved'; self.recovered = null;
        self.setPref('lastProjectId', self.project.id);
        lsDel(LS.draft);
        self.emit({ type: 'save', state: 'saved' });
      } else {
        self.saveError = 'The browser refused to store the project (storage full, private mode or blocked). Export the project file to keep this work.';
        self.saveState = 'error';
        self.emit({ type: 'save', state: 'error' });
      }
      if (cb) cb(ok, self.saveError);
    }, 380);
  };
  P._writeIndex = function () {
    var idx = (lsGet(LS.index) || []).filter(function (e) { return e && e.id !== this.project.id; }, this);
    var ar = this.activeRev();
    idx.unshift({ id: this.project.id, number: this.project.number, name: this.project.name, modified: this.project.modified,
      rev: ar.rev, status: ar.status, revCount: this.revisions.length });
    return lsSet(LS.index, idx);
  };
  P.lastSaved = function () { return this.saved && this.saved.project ? this.saved.project.modified : null; };

  /* ------------------------------------------------------------- revisions */
  P.nextRevLetter = function () {
    var used = this.revisions.map(function (r) { return r.rev; }), i = 0;
    while (used.indexOf(revLetter(i)) >= 0) i++;
    return revLetter(i);
  };
  // Create a new revision from the working copy and save it immediately.
  P.saveAsRevision = function (opts, cb) {
    opts = opts || {};
    var t = now();
    var rev = { id: uid(), rev: this.nextRevLetter(), status: opts.status || 'Draft', note: opts.note || '', inputs: clone(this.inputs), created: t, savedAt: null };
    this.revisions.push(rev);
    this.activeRevId = rev.id;
    this.emit({ type: 'revisions' });
    this.save(cb);
    return rev;
  };
  P.openRevision = function (id) {
    var r = this.revisions.filter(function (x) { return x.id === id; })[0];
    if (!r) return false;
    this.activeRevId = id;
    this.inputs = clone(r.inputs); this.invalid = {};
    this.undoStack = []; this.redoStack = []; this._co = null;
    this._changed({ type: 'inputs', revision: true });
    this.emit({ type: 'revisions' });
    return true;
  };
  P.updateRevision = function (id, patch) {
    var r = this.revisions.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (patch.status && STATUSES.indexOf(patch.status) >= 0) r.status = patch.status;
    if (patch.note !== undefined) r.note = patch.note;
    this._changed({ type: 'revisions' });
  };
  P.revisionInputs = function (id) {
    if (id === 'working') return this.inputs;
    var r = this.revisions.filter(function (x) { return x.id === id; })[0];
    if (!r) return null;
    return r.id === this.activeRevId ? (this._savedRev() || r).inputs : r.inputs;
  };

  /* -------------------------------------------------------------- projects */
  P.updateProject = function (meta) {
    ['number', 'name', 'client', 'site', 'engineer', 'notes'].forEach(function (k) { if (meta[k] !== undefined) this.project[k] = String(meta[k]); }, this);
    this._changed({ type: 'project' });
  };
  P.discardChanges = function () {
    var stored = this.saved && (lsGet(LS.project(this.project.id)) || this.saved);
    if (!stored) return false;
    this._openStored(stored);
    lsDel(LS.draft);
    this.recovered = null;
    this.emit({ type: 'inputs', revision: true }); this.emit({ type: 'project' }); this.emit({ type: 'revisions' });
    return true;
  };
  P.newProject = function (meta) {
    this._fresh(meta || {});
    this.recovered = null;
    this._changed({ type: 'inputs', revision: true });
    this.emit({ type: 'project' }); this.emit({ type: 'revisions' });
  };
  P.openProject = function (id) {
    var stored = lsGet(LS.project(id));
    if (!stored) return false;
    this._openStored(stored);
    this.recovered = null;
    lsDel(LS.draft);
    this.setPref('lastProjectId', id);
    this.emit({ type: 'inputs', revision: true }); this.emit({ type: 'project' }); this.emit({ type: 'revisions' });
    return true;
  };
  P.listProjects = function () { return (lsGet(LS.index) || []).filter(function (e) { return e && e.id; }); };
  P.deleteProject = function (id) {
    lsDel(LS.project(id));
    lsSet(LS.index, this.listProjects().filter(function (e) { return e.id !== id; }));
  };
  P.exportProject = function () {
    return JSON.stringify({
      app: 'VenturiJetPumpDesignStudio', schema: 2, exported: now(), calculationModel: 'VENTURI_JET_PUMP_CALCULATOR_v4',
      project: this.project, revisions: this.revisions, activeRevId: this.activeRevId,
      working: this.isDirty() ? { inputs: this.inputs, note: 'Unsaved working copy at export time' } : null
    }, null, 2);
  };
  // Imports as a NEW project (never overwrites an existing one). Throws on invalid files.
  P.importProject = function (text) {
    var o = JSON.parse(text);
    var revs, project;
    if (o && o.project && o.revisions && o.revisions.length) { project = o.project; revs = o.revisions; }
    else if (o && o.inputs) { // legacy single-design export (schema 1)
      project = { name: 'Imported design' };
      revs = [{ rev: 'A', status: 'Draft', note: 'Imported from legacy file', inputs: o.inputs }];
    } else throw new Error('The file is not a Venturi Jet Pump project (no project or inputs found).');
    var t = now();
    var p = { id: uid(), number: project.number || nextNumber(), name: (project.name || 'Imported project'),
      client: project.client || '', site: project.site || '', engineer: project.engineer || '', notes: project.notes || '', created: project.created || t, modified: t };
    var mapped = revs.map(function (r, i) {
      if (!r || typeof r.inputs !== 'object') throw new Error('Revision ' + (i + 1) + ' has no input set.');
      return { id: uid(), rev: r.rev || revLetter(i), status: STATUSES.indexOf(r.status) >= 0 ? r.status : 'Draft', note: r.note || '', inputs: complete(r.inputs), created: r.created || t, savedAt: null };
    });
    var activeIdx = Math.max(0, revs.map(function (r) { return r.id; }).indexOf(o.activeRevId));
    this._load(p, mapped, mapped[activeIdx].id, o.working && o.working.inputs ? o.working.inputs : null);
    this.saved = null;
    this.recovered = null;
    this._changed({ type: 'inputs', revision: true });
    this.emit({ type: 'project' }); this.emit({ type: 'revisions' });
  };

  function nextNumber() {
    var idx = lsGet(LS.index) || [], max = 0;
    idx.forEach(function (e) { var m = /(\d+)\s*$/.exec(e.number || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return 'VJP-' + String(max + 1).padStart(3, '0');
  }

  /* ----------------------------------------------------------------- prefs */
  P.setPref = function (k, v) {
    this.prefs[k] = v;
    lsSet(LS.prefs, this.prefs);
    this.emit({ type: 'prefs', key: k });
  };
  function loadPrefs() {
    var p = lsGet(LS.prefs) || {};
    return {
      theme: p.theme === 'light' ? 'light' : 'dark', system: p.system === 'imp' ? 'imp' : 'si',
      reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : null,
      sidebar: p.sidebar === 'collapsed' ? 'collapsed' : 'expanded',
      lastProjectId: p.lastProjectId || null,
      schematic: p.schematic || null, flow: p.flow || null
    };
  }

  root.VJP = root.VJP || {};
  root.VJP.state = { Store: Store, STATUSES: STATUSES, sameInputs: sameInputs };
})(typeof window !== 'undefined' ? window : this);
