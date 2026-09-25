# Venturi Jet Pump Design Studio — UI/UX Design System

## 1. Product Positioning

Venturi Jet Pump Design Studio is an engineering design and calculation application, not a generic SaaS dashboard.

The visual language should communicate:

- Engineering precision
- CAD/CAE workstation quality
- Hydraulic/mechanical credibility
- Traceable calculations
- High information density without visual clutter
- Professional fabrication/design workflow

Reference the usability principles of modern engineering software such as CAD/CAE applications, while using contemporary web UI patterns for navigation, responsiveness, and clarity.

Do **not** imitate any one vendor's interface or branding.

---

## 2. Core Design Language

### Design language

**Modern Industrial Engineering / CAD Workstation**

The interface should feel like a purpose-built engineering design studio rather than an online calculator.

### Visual personality

- Precise
- Technical
- Structured
- Calm
- Professional
- Data-rich
- Minimal decorative UI
- Strong hierarchy
- High legibility

Avoid:

- Generic AI/SaaS dashboard styling
- Excessive rounded cards
- Excessive gradients
- Glassmorphism
- Oversized decorative illustrations inside calculation screens
- Excessive animation between pages
- Neon "tech" aesthetics
- Default Tailwind/Claude blue accents

---

## 3. Theme

The existing dark engineering theme should remain the primary theme, but replace the current blue product accent with a warm light-orange/amber identity.

### Recommended palette

```text
Background        #080D16
Surface           #0E1522
Surface Elevated  #121B2A
Surface Hover     #172235
Border            #263247
Border Strong     #394963
Text Primary      #F4F7FB
Text Secondary    #A9B4C5
Text Muted        #718096

Brand Orange      #F59E0B
Brand Orange 2    #F97316
Orange Soft       #FDBA74
Orange Pale       #FFEDD5
Orange Dark       #C2410C

Success           #22C55E
Warning           #F59E0B
Error             #EF4444
Info              #38BDF8

Motive Fluid      #38BDF8
Entrained Solids  #B7791F
Pressure/Head     #A78BFA
Velocity          #F59E0B
Validation        #22C55E
```

Orange is the **brand/UI accent**. Scientific visualization colors may remain distinct when they communicate different physical quantities. Do not force all fluid/particle visualization to orange.

### Contrast

Maintain WCAG-friendly contrast for primary text and controls. Do not use muted gray text that becomes unreadable on the dark background.

---

## 4. Typography

Use a clean engineering-oriented sans-serif.

### Recommended

```text
Primary UI:       Inter
Technical values: IBM Plex Mono or JetBrains Mono
Equations:        IBM Plex Mono or a math-friendly font
```

Use monospaced numerals for important calculated values so dimensional values align and scan cleanly.

### Hierarchy

```text
Page title          22–26 px / semibold
Section title       15–18 px / semibold
Card title          14–16 px / semibold
Body                13–14 px
Secondary           11–12 px
Engineering value   18–26 px / monospace / semibold
Axis labels         11–12 px minimum
Chart title         14–16 px / semibold
```

Never make engineering values or chart labels unnecessarily tiny to fit more information.

---

## 5. Application Shell

Use a consistent application shell across all pages.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Logo + Product       Project / Design ID       Units  Save  Export │
├───────────────┬────────────────────────────────────────────────────┤
│               │                                                    │
│ Navigation    │                PAGE CONTENT                        │
│               │                                                    │
│ 1 Inputs      │                                                    │
│ 2 Calc Steps  │                                                    │
│ 3 Results     │                                                    │
│ 4 Schematic   │                                                    │
│ 5 Hydraulics  │                                                    │
│ 6 Validation  │                                                    │
│ 7 Equations   │                                                    │
│ 8 Compare     │                                                    │
│               │                                                    │
└───────────────┴────────────────────────────────────────────────────┘
```

The application should have a **persistent but compact navigation rail/sidebar**. The actual input controls should no longer be squeezed into the left navigation panel.

### Header

The top header should contain:

- Venturi Jet Pump Design Studio logo
- Project name / project number
- Unsaved-changes indicator
- Undo / Redo
- SI / Imperial selector
- Save
- Report / PDF
- More actions menu

Do not crowd the header with secondary information.

---

## 6. Branding / Logo

Use the supplied Venturi Jet Pump Design Studio logo as the primary application identity.

Recommended usage:

- Full logo in the project/home screen
- Compact icon/mark in the persistent sidebar/header
- Monochrome or simplified mark for small UI sizes if necessary
- Maintain aspect ratio
- Do not stretch or distort the logo
- Do not place the logo on a busy background

The logo must not dominate engineering content.

Suggested asset structure:

```text
/public/brand/
    venturi-jet-pump-logo.png
    venturi-jet-pump-mark.svg
```

Prefer SVG/vector for UI rendering when a proper vector asset is available.

---

## 7. Navigation / Page Structure

The application should have eight primary pages in this exact order:

1. **Inputs**
2. **Calculation Steps**
3. **Results**
4. **Schematic**
5. **Hydraulic Profiles**
6. **Validation**
7. **Governing Equations**
8. **Compare**

The navigation should make the user's progress through the engineering workflow obvious.

Recommended workflow indicator:

```text
Inputs → Calculation → Results → Schematic → Hydraulics → Validation
                                    ↓
                             Equations / Compare
```

Do not artificially lock users into a wizard if they need to move between pages freely.

---

# 8. Inputs Page

This page replaces the current left-side input panel.

The page should provide substantially more space for data entry and explanation.

## Recommended structure

```text
INPUTS
Project: VP-001                              SI ▼   Save

┌─────────────────────────────────────┐ ┌───────────────────────────┐
│ 1. Soil & Particle                   │ │ DESIGN SUMMARY            │
│                                      │ │                           │
│ Max particle size     [ 10 ] mm     │ │ Throat Ø      100.4 mm    │
│ Safety factor         [ 1.20 ]       │ │ Nozzle Ø       40.17 mm   │
│ ...                                  │ │ Total flow     4093 L/min │
└─────────────────────────────────────┘ └───────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. Motive Fluid / Supply Pump                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. Suction & Discharge                                          │
└─────────────────────────────────────────────────────────────────┘

...
```

### Input sections

Preserve the existing engineering categories but turn them into large, well-spaced sections:

1. Soil & Particle
2. Motive Fluid / Supply Pump
3. Suction & Discharge
4. Throat & Nozzle Geometry
5. Pipe Connections
6. Pipeline & Slurry
7. Tunnel & Cutterhead

### Input UX requirements

Every input should provide:

- Label
- Symbol where applicable
- Unit
- Input field
- Valid range/minimum/maximum where known
- Short engineering description
- Tooltip/help icon where useful
- Validation state
- Source/reference where the default is based on a standard or design assumption

Example:

```text
Maximum particle size d_p,max                         [ 10.0 ] mm
Largest solid expected to pass through the throat
Recommended range: 1–25 mm
```

Use numeric steppers only when they genuinely improve usability. Otherwise prefer clean numeric fields with unit labels.

### Smart validation

Validate inputs immediately but unobtrusively.

Examples:

```text
✓ Within recommended range
⚠ Above recommended range; review throat sizing
✕ Physically invalid / calculation cannot proceed
```

Do not display vague messages such as "Invalid input" when a precise engineering explanation can be provided.

### Grouping

Use progressive disclosure for advanced parameters. Basic parameters should be visible by default; advanced/optional parameters can be expanded.

---

# 9. Calculation Steps Page

This page is the calculation audit trail.

Each step should show:

- Step number
- Engineering objective
- Inputs used
- Governing equation
- Substitution of actual values
- Calculated result
- Units
- Assumptions
- Validation/reference where applicable

Example:

```text
STEP 04 — Nozzle Exit Velocity

A_n = π D_n² / 4

A_n = π × (0.04017 m)² / 4

A_n = 1.267 × 10⁻³ m²

V_n = Q_n / A_n

V_n = 32.9 m/s

✓ Dimensional consistency confirmed
```

Use collapsible calculation groups so users can inspect the complete derivation without creating an extremely tall page.

Add a **Copy equation**, **Copy values**, and optionally **View assumptions** action.

---

# 10. Results Page

The Results page should be the engineering decision summary.

### Top section

Show a clear design status banner:

```text
✓ DESIGN ACCEPTABLE
12 checks passed · 1 item requires review
```

Do not use "proceed to fabrication" unless the validation logic genuinely supports that statement.

Prefer statuses such as:

- Design acceptable
- Review required
- Calculation blocked

### Key result cards

Prioritize important results:

- Throat diameter
- Throat length
- Nozzle exit diameter
- Diffuser exit diameter
- Head ratio
- Entrainment ratio
- Total flow
- Nozzle velocity
- Recovery coefficient
- Cavitation index
- Motive power
- Reynolds number

Each card should show:

```text
THROAT DIAMETER
100.4 mm
Calculated
```

Use small contextual indicators rather than decorative colors.

### Detailed results

Use structured tables for geometry and hydraulic results.

Allow filtering/copying/exporting of values.

---

# 11. Dynamic Venturi Schematic

This is a major product feature and must be substantially redesigned.

The current schematic should not simply be a static illustration.

## Primary requirement

The schematic must be generated from the **actual current calculation/model state**.

When any relevant dimension changes, the geometry should update automatically.

Examples:

- Main pipe diameter
- Nozzle inlet diameter
- Nozzle exit diameter
- Nozzle length
- Nozzle-to-throat gap
- Throat diameter
- Throat length
- Suction chamber geometry
- Diffuser length
- Diffuser angle
- Diffuser exit diameter
- Connection diameters

## Technology

Use **SVG** as the primary technology for the engineering schematic.

SVG is preferred because it provides:

- Crisp dimensions at any zoom level
- Parametric path generation
- Easy dimension labels
- Hit testing
- Hover interactions
- Export to SVG/PNG
- Excellent browser performance for this geometry

Use Canvas/WebGL/Three.js only for the animated flow visualization layer when justified.

## Geometry rules

Separate the model into:

```text
Engineering dimensions
        ↓
Normalized geometry model
        ↓
Viewport fit / display scaling
        ↓
SVG paths + dimensions
        ↓
Animation overlay
```

Never hard-code the shape of the Venturi body based on the current example numbers.

The display may use a viewport scaling factor so the complete geometry fits on screen, but the **relative dimension relationships must remain faithful to the calculated geometry**.

Clearly distinguish between:

- Engineering scale
- Display scale

Do not make a 400 mm diffuser look visually identical to a 100 mm diffuser just because the SVG was manually drawn at fixed proportions.

## Schematic elements

Display:

- Nozzle
- Motive-fluid inlet
- Suction port/chamber
- Throat
- Mixing region
- Diffuser
- Discharge
- Centerline
- Key dimension callouts
- Diameter callouts
- Length callouts
- Flow direction arrows
- Component labels

Dimension labels should not overlap the geometry.

Use intelligent label placement and leader lines.

Provide a **Show dimensions** toggle and optionally a **Simplified schematic** mode.

## Interaction

Users should be able to:

- Zoom
- Pan
- Reset view
- Toggle dimensions
- Toggle labels
- Toggle flow animation
- Export SVG
- Export PNG
- Inspect a component by hovering/clicking

Hovering over a section should highlight it and show its calculated dimensions.

---

# 12. Hyper-Realistic Flow Animation

The flow animation should look visually convincing and engineering-oriented while explicitly remaining a **visualized representation of calculated flow**, not a CFD result.

Do not claim to simulate turbulence, multiphase physics, particle collisions, pressure waves, or real transient CFD behavior unless the underlying model actually performs those calculations.

## Flow concept

Animate at least:

1. Motive fluid entering through the nozzle
2. High-speed jet issuing from the nozzle
3. Pressure-driven suction from the suction chamber
4. Entrained slurry/particles entering the mixing region
5. Mixing through the throat
6. Acceleration/transport through the throat
7. Diffuser deceleration
8. Discharge flow

## Speed mapping

The animation speed must be derived from calculated velocity values.

Example concept:

```text
Local calculated velocity
        ↓
Normalize against reference velocity
        ↓
Map to animation speed
        ↓
Render particles/streamlines
```

A higher calculated velocity should visibly produce faster particle motion.

Do not simply increase every animation speed with one global slider.

The slider may control the **display multiplier**, but the base animation speed must come from the hydraulic calculations.

## Motive fluid

Use smooth streamlines or semi-transparent volumetric-looking streaks.

The flow should visibly accelerate through the nozzle and reduce in apparent speed through the diffuser.

## Entrained solids

Render particles with:

- Variable diameter based on particle-size input/distribution
- Increased density where appropriate
- Gravity-aware visual settling only if consistent with the selected visualization model
- Distinct material appearance from the liquid

Use a restrained brown/earth tone for soil particles rather than brand orange.

## Rendering quality

Use:

- Motion blur-like streaks where possible
- Soft transparency
- Smooth particle interpolation
- Depth/lighting cues if using WebGL
- Subtle turbulence-like visual noise, but do not imply actual CFD turbulence
- Continuous flow rather than visibly repeating tiled patterns

The animation should look like a polished engineering visualization, not a collection of dots moving along a path.

## Performance

Target smooth rendering on normal engineering laptops.

Use:

- RequestAnimationFrame
- Object pooling
- Efficient particle buffers
- Deterministic seeded randomness
- Level-of-detail reduction when zoomed out

Provide a reduced-motion accessibility mode.

---

# 13. Hydraulic Profiles

The four current plots should be redesigned with much stronger hierarchy.

Plots:

1. Pressure vs Venturi Length
2. Velocity Distribution
3. Energy & Hydraulic Grade Lines
4. Reynolds Number Variation

## Chart layout

Use a clean 2 × 2 desktop grid.

### Chart title

The title must be:

- Larger than currently shown
- Centered horizontally at the top of the plot
- Clearly separated from the chart area
- Semibold

Example:

```text
             PRESSURE VS VENTURI LENGTH
                    Static Pressure

      ┌───────────────────────────────────┐
      │                                   │
```

## Chart improvements

Add:

- Larger axis labels
- Readable tick labels
- Clear units
- Subtle grid lines
- Component boundary markers
- Hover tooltip
- Current design value marker where useful
- Legend only when required
- Consistent typography
- Synchronized axial position across all four plots when practical

Avoid excessive chart decoration.

## Engineering usability

Hovering at an axial location should optionally show the corresponding values across all hydraulic profiles.

Component boundary markers should be clearly labeled:

```text
1  Nozzle
2  Throat
3  Mixing section
4  Diffuser / Discharge
```

Use consistent x-axis scale across linked plots.

---

# 14. Validation Page

Turn validation into an engineering checklist rather than a simple green/red list.

Categories:

- Geometry validity
- Hydraulic validity
- Particle passage
- Velocity constraints
- Cavitation
- Pressure recovery
- Reynolds regime
- Pipe/connection compatibility
- Material/design limits
- Engineering assumptions

Each check should show:

```text
✓ PASS
Throat-to-particle ratio
Calculated: 10.04
Required: ≥ 5.00

Source / Basis: Design rule
```

For warnings:

```text
⚠ REVIEW
Diffuser angle exceeds preferred range.
Calculated: XX°
Preferred: XX–YY°
```

Avoid blanket statements such as "safe" or "ready for fabrication" when a validation item merely passes a numerical threshold.

---

# 15. Governing Equations Page

Create a dedicated reference-style page containing the equations used by the calculation engine.

Each equation card should show:

- Equation name
- Equation
- Variable definitions
- Units
- Applicable assumptions
- Where it is used in the calculation sequence

Examples:

- Continuity
- Bernoulli / energy equation where applicable
- Momentum relationships
- Area/diameter relations
- Velocity calculations
- Reynolds number
- Pressure/head relations
- Entrainment calculations
- Cavitation index
- Recovery coefficient
- Power requirements

Where an equation is empirical or based on a design correlation, clearly identify it as such and show the applicable range/assumptions.

---

# 16. Compare Page

Allow users to compare multiple saved designs.

Example:

```text
                    Design A       Design B       Design C
Throat Ø             100.4 mm       92.0 mm        105.0 mm
Nozzle Ø              40.2 mm       38.0 mm         42.0 mm
Flow                 4093 L/min    3900 L/min      4200 L/min
Motive Power         45.8 kW       43.1 kW         48.2 kW
Cavitation Index      0.351         0.412            0.298
```

Highlight changed values but do not use excessive color coding.

Provide:

- Compare table
- Geometry comparison
- Hydraulic profile comparison
- Validation comparison
- Export comparison report

---

# 17. Result Cards

Use cards selectively.

Cards should communicate high-value engineering results, not every numerical field.

Good card:

```text
NOZZLE EXIT VELOCITY
32.9 m/s
Calculated
```

Avoid:

```text
┌──────────────────┐
│                ✨│
│ Fancy Card       │
│ 32.9             │
│ Something...     │
└──────────────────┘
```

This is an engineering tool, not a marketing dashboard.

---

# 18. Tables

Tables should use:

- Strong column alignment
- Right-aligned numerical values
- Consistent decimal precision
- Units in separate columns where appropriate
- Sticky headers for long tables
- Copy/export actions
- Zebra shading only when it materially improves row tracking

Example:

```text
Parameter                  Value       Unit
─────────────────────────────────────────────
Throat diameter             100.4       mm
Throat length               803.4       mm
Nozzle exit diameter         40.17      mm
Diffuser exit diameter      156.6       mm
```

Engineering numbers should not be left-aligned inside a dense table.

---

# 19. Units

The SI / Imperial selector must affect:

- Inputs
- Calculated outputs
- Schematic dimensions
- Tables
- Charts
- Tooltips
- Reports

Internally use a canonical unit system and convert only at the UI boundary where possible.

Always display units next to values in engineering contexts.

Avoid mixing mm, m, bar, kPa, psi, L/min, m³/h, etc. without explicit labels.

---

# 20. Calculation State Architecture

The visualization must never have its own independent hard-coded engineering values.

Use a single source of truth:

```text
User Inputs
    ↓
Validated Input Model
    ↓
Calculation Engine
    ↓
Calculated Design State
    ↓
┌──────────────┬─────────────┬────────────┬──────────────┐
│ Results      │ Schematic   │ Profiles   │ Validation   │
└──────────────┴─────────────┴────────────┴──────────────┘
```

The schematic and plots should always consume the same calculated state shown on the Results page.

This is critical to prevent visual values from becoming inconsistent with calculation values.

---

# 21. Responsive Strategy

This is primarily a desktop engineering application.

Prioritize:

- 1280 px+
- 1440 px+
- Large engineering monitors

At smaller widths:

- Collapse the navigation
- Stack cards
- Maintain readable chart labels
- Allow horizontal scrolling for engineering tables
- Preserve the full schematic viewport

Do not make desktop controls so tiny that they look like a mobile UI stretched onto a desktop monitor.

---

# 22. Microinteractions

Use subtle animation only where it reinforces understanding.

Good:

- Calculation update indication
- Validation state transition
- Hover highlight
- Schematic component highlight
- Flow animation
- Number interpolation for major calculated results

Avoid:

- Excessive page transitions
- Bouncing buttons
- Decorative hover animations
- Constant pulsing elements

---

# 23. Error / Empty / Loading States

Every major page should have well-designed states.

### Calculation blocked

```text
Calculation cannot proceed

2 input conditions require correction.

→ Review Inputs
```

### Loading

Use skeletons or compact engineering progress indicators.

### No comparison designs

```text
No saved designs to compare.

Save a second design to enable comparison.
```

Avoid generic "Something went wrong" messaging.

---

# 24. Export / Reporting

Report/PDF generation should preserve the application design language.

The generated report should include:

- Logo
- Project information
- Revision/date
- Inputs
- Calculation summary
- Governing equations
- Geometry drawing
- Hydraulic profiles
- Validation summary
- Results
- Assumptions

Also provide:

- Export schematic as SVG
- Export schematic as PNG
- Export hydraulic data as CSV
- Copy result table

---

# 25. Accessibility

Provide:

- Keyboard navigable controls
- Visible focus states
- Adequate contrast
- Non-color-only validation indicators
- Tooltips for technical symbols
- Reduced motion option
- Screen-reader-friendly form labels

Flow animation must not be required to understand the calculation.

---

# 26. Schematic Quality Gate

The schematic is considered complete only when all of the following are true:

- Changing input dimensions changes the geometry immediately
- No hard-coded dimension values exist in the visualization
- Dimension labels update automatically
- Component boundaries remain correct
- Geometry fits the viewport automatically
- Labels do not overlap
- Flow direction is obvious
- Motive and suction/entrained flows can be visually distinguished
- SVG export works
- PNG export works
- Animation speed responds to calculated velocities
- The visualization does not claim to be CFD
- The schematic remains readable at different geometry ratios

---

# 27. Visual Quality Gate

Before considering the UI redesign complete:

- Remove all default blue accents from product UI
- Apply the orange/amber brand system consistently
- Increase chart title size and center titles
- Improve chart axis readability
- Improve whitespace and section hierarchy
- Replace cramped left-side input form with the dedicated Inputs page
- Add the official product logo
- Make engineering results easier to scan
- Keep numerical alignment consistent
- Reduce unnecessary card decoration
- Ensure visual hierarchy is obvious from first glance
- Ensure the UI looks like a professional engineering application

---

# 28. Implementation Principle

**Preserve calculation correctness. Redesign presentation and visualization around the calculation engine.**

Do not rewrite working engineering formulas merely to implement the UI redesign.

When UI and calculation behavior conflict, preserve the engineering model and refactor the presentation layer around it unless an actual calculation defect is identified.

The final application should feel like a coherent engineering product with one calculation model feeding the entire interface.
