# Venturi Jet Pump Design Studio

A browser-based engineering application for sizing, verifying and documenting **Venturi jet pumps (ejectors)** in **MTBM slurry circuits**. The calculation model is a verified, cell-by-cell port of `VENTURI_JET_PUMP_CALCULATOR_v4.xlsx`; the interface is organised as an engineering workflow in which inputs, results, dimensioned geometry, flow visualization, hydraulic profiles, validation and the report all read **one authoritative design state**.

> The spreadsheet is the authoritative computational model. The engine reproduces it exactly (82 / 82 regression values) and is not modified by the user interface. See [Verification](#verification).

---

## Workflow

| No. | Page | Purpose |
|---|---|---|
| — | **Project home** | Continue the open project, create or import a project, saved projects in this browser, workflow map, model-integrity line. |
| 1 | **Inputs** | Seven input sections (soil & particle, motive fluid, suction/discharge, geometry, connections, pipeline & slurry, tunnel) with units, recommended ranges, hard limits, source/type tags and per-field messages. Advanced coefficients (nozzle bore factor, loss coefficients…) sit in collapsible sections that open automatically when they need attention. A sticky **Design Summary** shows status, key results with deltas against the stored revision, a live mini schematic and an attention list. |
| 2 | **Calculation Steps** | The full calculation chain (groups A–O): objective, governing equation, substituted values, result, spreadsheet cell, value type and links to the schematic, results and equations. |
| 3 | **Results** | Engineering decision summary: status banner, key-result cards with their criteria, complete result tables from the metric registry, return-line `P_back` cross-check, Bernoulli station table, copy / CSV. |
| 4 | **Schematic** | Parametric 2-D section drawn from the calculated geometry: zoom / pan / fit, dimensions, labels, stations, simplified view, true-scale (1 : 1) or labelled radial exaggeration, component inspector, SVG / PNG export. **Flow mode** adds the calculated flow visualization (see below). |
| 5 | **Hydraulic Profiles** | Pressure, velocity, EGL / HGL and Reynolds number along the same axial coordinate as the schematic (2 × 2 grid, synchronized crosshair and readout, geometry strip, component highlighting), station table, head-loss breakdown, data table, CSV / SVG / PNG export. |
| 6 | **Validation** | Design criteria, advisories and notes by category (geometry, particle passage, hydraulic limits, velocity, cavitation, pressure recovery, Reynolds regime, pipe compatibility, material / design limits, assumptions) with measured value, requirement and margin. |
| 7 | **Governing Equations** | Every equation used, grouped (fundamental, hydraulic, empirical, criteria, derived, assumptions), with symbols, validity and references. |
| 8 | **Compare** | Stored revisions and the unsaved working copy side by side: inputs and results with deltas against a chosen baseline, geometry and profile overlays, validation matrix, CSV. |
| — | **Report / PDF** | A4 preview of the engineering report (document control, design status, key results, vector geometry, inputs, calculation summary, profiles, station table, validation checklist, equations, assumptions, references, sign-off), then print or *Save as PDF*. |

### Design status

The status is decided only by input validity and the design criteria:

- **Calculation blocked** — an input condition makes the calculation meaningless (e.g. motive pressure not above discharge pressure, no suction annulus); results are withheld rather than shown with misleading numbers.
- **Design acceptable** — all design criteria are met; advisory items may still be listed for review.
- **Review required** — one or more criteria need review or are not met.

The application never states that a design is ready for fabrication; a design that meets the criteria still requires engineering review and sign-off.

---

## Engineering integrity

- **One design state.** `store` (inputs, project, revisions) → `VJP.design.evaluate()` → `D` = { engine results `R`, input validation `V`, checks, status, parametric geometry `model`, 1-D profiles `prof` }. `evaluate` is memoized, so every page, export and the report show identical numbers. Reported quantities are defined once in the metric registry (`design.METRICS`).
- **Engine untouched.** `js/engine.js` is the spreadsheet port; every formula carries its cell reference. The UI only reads its results.
- **Inputs.** Hard limits (physically impossible values) block the calculation; recommended ranges produce warnings only. Each input states its type — user input, assumed, empirical, limit, calculated or derived.
- **Geometry is a display construction.** All flow-path dimensions (nozzle, gap, throat, diffuser, ports) come from the engine. Features the model does not calculate — wall thickness, flanges, branch walls, chamber size, reducers — follow the documented construction rules in `geometry.RULES` so the drawing stays readable and collision-free for any input. It is not a fabrication drawing.
- **Flow visualization is not CFD.** Streamlines follow the calculated geometry; particle speed and trail length are proportional to the calculated velocities (continuity + jet-decay model anchored to the engine stations); solids are sized from the particle-size inputs and settle only when the velocity ratio `V/V_c` is low. It is labelled as such in the viewer, and honours *Reduce motion*.
- **Profiles are 1-D reconstructions** from continuity, Bernoulli and momentum, anchored to the engine's Bernoulli station values (markers).

---

## Projects, revisions and saving

- Projects are stored in this browser's `localStorage` (keys `vjp.projects.v2`, `vjp.project.v2.<id>`; preferences `vjp_prefs_v1`). **Save** (Ctrl + S) stores the active revision; *Save as new revision* creates Rev B, C …; revision status is Draft, In Review, Approved or Superseded.
- The header shows the true save state — *Not saved*, *Unsaved changes*, *Saving…*, *Saved · hh:mm* or a storage error. A local recovery draft (`vjp.draft.v2`) protects against a closed tab, but it is **not** a saved revision.
- *Export project file (.json)* / *Import project file* move projects between browsers or computers; use it for backups, since browser storage can be cleared.
- SI ⇄ Imperial is a display setting: the model computes in SI and every page, export and the report convert consistently.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl + S | Save the active revision |
| Ctrl + Z / Ctrl + Y | Undo / redo input changes |
| Alt + 1 … 8 · Alt + 0 | Go to workflow page 1–8 · project home |
| ↑ / ↓ in a field | Step the value (Shift × 10, Alt × 0.1) |
| Enter / Esc in a field | Commit / revert the edit |
| F · + / − · 0 | Schematic: fit · zoom · reset view |
| D · L | Schematic: dimensions · labels |
| Space | Flow view: play / pause |
| ? | Shortcut list |

---

## Run it

**No build step, no dependencies, no Node.js** — plain HTML / CSS / JavaScript loaded as classic scripts.

- **Locally:** open `index.html` in a current Chromium, Firefox or Safari browser (double-click works; `file://` is supported). Any static web server works too.
- **Single file:** `dist/index.html` is a self-contained bundle (all CSS, scripts and brand images inlined) for e-mailing or archiving. Regenerate it after changing the sources:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File build-inline.ps1
  ```
  The script refuses to build if a stylesheet, script or image would be left as an unresolved relative reference.
- **Fonts:** Inter and IBM Plex Mono load from Google Fonts when online; offline, the system-font fallbacks in `css/styles.css` apply. Nothing else is fetched from the network.

---

## Project structure

```
index.html                 App shell; loads the modules as classic <script>s (works via file://)
brand/                     Product logo and marks (from the supplied artwork) + SVG favicon
css/
  styles.css               Design tokens (dark default + light), base components
  pages.css                Shell, home, inputs, design summary, responsive layout
  views.css                Schematic, results, charts / profiles, validation, equations, compare, steps
  report.css               Report preview and print (A4) styles
js/
  engine.js                ★ Calculation engine — faithful port of the workbook (UI-independent)
  units.js                 SI / Imperial conversion and engineering number formatting
  schema.js                Input definitions: sections, units, hard limits, recommended ranges, types, help
  formulas.js              Governing-equation catalogue and references
  validation.js            Input validation, blockers, design criteria / advisories, status summary
  geometry.js              Parametric geometry (display-construction rules) and 1-D hydraulic profiles
  design.js                Authoritative design state (evaluate) and the metric registry
  calcsteps.js             Calculation-step definitions (groups A–O)
  icons.js, ui-kit.js      Icon set; DOM, tooltip, menu, modal, toast and format helpers
  charts.js                SVG line / bar charts: synchronized cursor, bands, markers, export
  schematic.js             Schematic viewer (zoom / pan, dimensions, labels, inspection) and SVG / PNG export
  flow.js                  Calculated flow visualization (streamlines, particles, velocity field)
  report.js                Engineering report (preview → print / PDF)
  state.js                 Projects, revisions, save state, undo / redo, recovery draft, import / export
  pages/                   home, inputs, steps, results, schematic, profiles, validation, equations, compare
  app.js                   Shell: router, header, sidebar, dialogs, shortcuts, render loop
tests/
  engine.test.js           Engine regression vs the spreadsheet's stored values (also shown in the app)
  model.test.js            Validation, geometry and unit-conversion consistency suites
  tests.html               Runs all suites in the browser — the title shows [PASS] / [FAIL]
  inspect.html             Visual QA harness: schematic / flow view for inputs, size and theme given in the URL hash
build-inline.ps1           No-Node bundler → dist/index.html
.github/workflows/         GitHub Pages deployment
```

---

## Verification

Open `tests/tests.html` (85 / 85 checks pass):

- **Engine regression** — 82 computed values against the spreadsheet's stored results, all equal to floating-point precision.
- **Validation vs engine** — 400 seeded random designs, including out-of-range inputs: for every design that is not blocked, each criterion reports exactly the level of the engine's own flag, the overall result agrees with the sheet's B66 check, and the status is *Design acceptable* only when every criterion passes.
- **Geometry** — 250 random designs: construction order and clearances hold (lance inside the body, nozzle-tip wall clear of the throat, suction branch clear of the entry cone), all coordinates are finite, and the profiles reproduce the engine's station values.
- **Units** — SI ⇄ Imperial round trip for every dimension.

`tests/inspect.html` renders the schematic for visual checks at a fixed size: the export drawing by default, the live viewer with `view=1`, plus the flow layer with `flow=1`. Size, theme, units and any input key are set in the hash, e.g. `tests/inspect.html#view=1&w=1440&h=900&theme=light&k_th=10`.

### Model notes (faithful to the sheet)

- **`P_back` is a manual input**, cross-checked against the computed return-line demand `ΔP_req`; *Use computed ΔP_req* (Inputs, Results, Validation) copies it across. It is not auto-driven, matching the sheet's manual-iteration workflow.
- **Nozzle exit diameter** `d_n,sel = d_n(flow) × 1.15`, the sheet's empirical bore factor, exposed as an advanced input.
- **Station-4 velocity `v_d`** uses the diffuser outlet diameter, while the return-pipe velocity `V_disch` (friction, Reynolds, settling) uses the pipe ID — two distinct quantities in the sheet, both reproduced.
- For the default case the diffuser exit is **156.6 mm** (from angle × length) against a **150 mm** return pipe; the schematic draws the computed diameter with an outlet reducer, and Validation lists the mismatch as an advisory.

---

## Deploy to GitHub Pages

1. Create a GitHub repository and copy the **contents** of this folder to its root (so `index.html` is at the root); push to `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. `.github/workflows/deploy.yml` publishes the site on every push to `main`.

All paths are relative, so the app also works from a project sub-path (`https://<user>.github.io/<repo>/`). `.nojekyll` makes Pages serve the files verbatim. Saved projects live in each visitor's own browser.

---

## References

Cunningham (1974) · Mueller (1964) · Sanger (1970) · ESDU 85032 · Durand (1953) · Wasp, Kenny & Gandhi (1977) · Thomas (1965) · Swamee & Jain (1976) · Moody (1944) · Wilson, Addie, Sellgren & Clift (2006).
