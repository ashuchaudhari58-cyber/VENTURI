I want you to perform a substantial UI/UX, visualization, and information-architecture redesign of the existing **Venturi Jet Pump Design Studio**.

I have provided:

1. Screenshots of the current application.
2. The Venturi Jet Pump Design Studio logo.
3. A `design.md` file containing the detailed design-system and UX specification.

Use the supplied `design.md` as the **authoritative visual and UX design specification**.

IMPORTANT:

This is an engineering calculation/design application, not a generic SaaS dashboard.

The existing application already contains engineering calculations and workflows. The primary objective is to significantly improve the application's:

- UI/UX
- information architecture
- engineering visualization
- parametric schematic
- hydraulic visualization
- calculation traceability
- validation experience
- project/design workflow
- professional appearance

Do NOT unnecessarily rewrite or change the existing engineering calculation logic.

Preserve the existing calculation engine and formulas unless a genuine defect is identified.

==================================================
1. PRIMARY DESIGN DIRECTION
==================================================

Redesign the entire application using this design language:

**MODERN INDUSTRIAL ENGINEERING / CAD-CAE WORKSTATION**

The product should feel like a professional engineering design application rather than:

- an online calculator
- a generic SaaS dashboard
- an AI dashboard
- a marketing website

The visual language should communicate:

- Engineering precision
- Parametric design
- Technical credibility
- Calculation traceability
- Hydraulic engineering
- Mechanical design
- Professional engineering review
- Fabrication readiness
- Data integrity

Use the general usability principles associated with professional CAD/CAE software, but DO NOT directly copy the branding, layout, or visual identity of ANSYS, Autodesk, Siemens, SolidWorks, or similar products.

The UI should have a strong technical identity while still feeling modern and web-native.

Avoid:

- Generic SaaS styling
- Excessive rounded cards
- Excessive gradients
- Glassmorphism
- Neon colors
- Excessive shadows
- Oversized decorative UI
- Tiny engineering labels
- Excessively soft/marketing-style interfaces
- Default Claude/Tailwind blue styling

==================================================
2. BRAND IDENTITY
==================================================

Integrate the supplied Venturi Jet Pump Design Studio logo throughout the application.

Use the logo as the actual product identity.

Logo usage:

- Full logo on landing/project selection screen
- Compact logo/mark in the application shell
- Appropriate use in reports
- Appropriate use in empty states
- Correct aspect ratio
- No distortion
- No excessive size

Do not allow the logo to compete visually with engineering information.

The existing application uses too much blue.

Replace the product's primary blue identity with an **orange / amber engineering accent system**.

Suggested direction:

Primary orange:
#F59E0B

Secondary orange:
#F97316

Dark background:
#080D16

Panel:
#0E1522

Elevated panel:
#121B2A

Primary text:
#F4F7FB

Secondary text:
#A9B4C5

Success:
#22C55E

Warning:
#F59E0B

Error:
#EF4444

IMPORTANT:

Do not make every engineering visualization orange.

Orange should represent the **application/product identity**.

Scientific visualization can continue to use appropriate colors to distinguish:

- motive fluid
- entrained particles
- pressure
- velocity
- energy
- warnings
- material/slurry

==================================================
3. APPLICATION ARCHITECTURE
==================================================

Remove the current large input form from the left-side navigation panel.

The current left input panel is too narrow and makes parameter entry difficult.

The left navigation should become a proper application navigation area.

Create these primary pages:

1. Inputs
2. Calculation Steps
3. Results
4. Schematic
5. Hydraulic Profiles
6. Validation
7. Governing Equations
8. Compare

Navigation should be persistent and clear.

The application should not feel like a forced wizard.

Users should be able to navigate freely between sections.

Recommended workflow:

Inputs
   ↓
Calculation Steps
   ↓
Results
   ↓
Schematic
   ↓
Hydraulic Profiles
   ↓
Validation
   ↓
Governing Equations
   ↓
Compare


==================================================
4. GLOBAL APPLICATION SHELL
==================================================

Create a professional engineering workstation-style application shell.

HEADER:

Include:

- Venturi Jet Pump Design Studio logo/mark
- Project name
- Design/revision identifier
- Save state
- Undo
- Redo
- SI / Imperial selector
- Save
- Project actions
- Report / PDF

Improve the existing header because it currently feels crowded and visually compressed.

Display save state clearly:

Saved
Saving...
Unsaved changes

Do not allow engineering data to appear saved when it is not.

SIDEBAR:

Navigation:

- Inputs
- Calculation Steps
- Results
- Schematic
- Hydraulic Profiles
- Validation
- Governing Equations
- Compare

Use orange as the active-navigation and primary-action accent.

==================================================
5. DEDICATED INPUT PAGE
==================================================

This is one of the most important structural changes.

Move all input controls from the narrow left panel into a dedicated full-page engineering input workspace.

Organize the current input categories into:

1. Soil & Particle
2. Motive Fluid / Supply Pump
3. Suction & Discharge
4. Throat & Nozzle Geometry
5. Pipe Connections
6. Pipeline & Slurry
7. Tunnel & Cutterhead

Use a wide desktop-oriented layout.

Prefer a two-column layout where useful:

LEFT:
Input parameters

RIGHT:
Live design summary / calculated values / warnings / preview

Do NOT put everything into one endlessly scrolling form.

Create strong visual grouping.

Core parameters should be immediately visible.

Advanced/secondary parameters may be collapsible.


==================================================
6. INPUT CONTROL DESIGN
==================================================

Every engineering input should contain:

- Parameter name
- Engineering symbol where applicable
- Input field
- Unit
- Description
- Valid input range
- Validation status
- Tooltip/help if needed

Example:

Maximum particle size d_p,max

[ 10.0 ] mm

Largest solid particle expected to pass through the throat.

Status:
✓ Within recommended range

Input controls should feel like professional engineering software.

Improve:

- Numerical input behavior
- Decimal precision
- Unit suffixes
- Keyboard controls
- Focus states
- Validation
- Range checking
- Engineering warnings
- Reset functionality

Provide:

- Reset section
- Reset all defaults
- Undo / redo where practical
- Clear error messages


==================================================
7. SMART INPUT EXPERIENCE
==================================================

Inputs should provide immediate engineering feedback.

Example:

Maximum particle size
10 mm

Throat diameter
100.4 mm

Particle/throat ratio
10.04

Status:
PASS

Do not wait until the Results page to tell the user that an input is invalid when it can be detected immediately.

Distinguish between:

- Valid
- Warning
- Error
- Not calculated


==================================================
8. SINGLE AUTHORITATIVE ENGINEERING STATE
==================================================

This is critical.

There must be ONE authoritative engineering state model.

Use an architecture conceptually equivalent to:

USER INPUTS
     ↓
VALIDATED INPUT MODEL
     ↓
CALCULATION ENGINE
     ↓
CALCULATED DESIGN STATE
     ↓
-----------------------------------------
| Results                               |
| Schematic                             |
| Hydraulic Profiles                    |
| Validation                            |
| Governing Equations                   |
| Compare                               |
-----------------------------------------

Every page must consume the same authoritative engineering state.

DO NOT independently hard-code engineering values into:

- results
- schematic
- chart labels
- animation
- validation

Example:

If throat diameter changes from:

100.4 mm

to:

90 mm

then every dependent output must update from the calculation engine.

This includes:

- Results
- Schematic geometry
- Dimensions
- Flow visualization
- Hydraulic profiles
- Validation
- Relevant equations
- Compare state


==================================================
9. DYNAMIC VENTURI SCHEMATIC
==================================================

This is the highest-priority visualization improvement.

The existing schematic is visually poor and must be substantially redesigned.

Do NOT simply restyle the existing drawing.

Create a proper **parametric engineering schematic** generated directly from calculated dimensions.

The geometry must dynamically update as the inputs and outputs change.

The schematic must reflect:

- Nozzle inlet diameter
- Nozzle exit diameter
- Nozzle length
- Nozzle-throat gap
- Suction inlet geometry
- Suction chamber
- Throat diameter
- Throat length
- Mixing section
- Diffuser geometry
- Diffuser angle
- Diffuser length
- Diffuser outlet diameter
- Pipe connections

Changing any relevant design parameter must update the geometry automatically.


==================================================
10. PARAMETRIC GEOMETRY ENGINE
==================================================

The schematic must be generated from the engineering model rather than manually positioned.

Recommended conceptual architecture:

ENGINEERING DIMENSIONS
        ↓
PARAMETRIC GEOMETRY MODEL
        ↓
NORMALIZED GEOMETRY
        ↓
VIEWPORT TRANSFORMATION
        ↓
SVG ENGINEERING SCHEMATIC
        ↓
DIMENSION ANNOTATIONS
        ↓
FLOW VISUALIZATION

The geometry should remain proportionally coherent as dimensions change.

For example:

If diffuser length increases, the diffuser must visibly become longer.

If throat diameter decreases, the throat must visibly become narrower.

If nozzle diameter changes, the nozzle geometry must change.

Do not simply update textual dimension labels while keeping the drawing fixed.

==================================================
11. ENGINEERING SCHEMATIC CONTENT
==================================================

Render clearly:

- Motive fluid inlet
- Nozzle
- Nozzle exit
- Suction inlet
- Suction chamber
- Mixing region
- Throat
- Diffuser
- Discharge
- Centerline
- Dimension lines
- Diameter callouts
- Length callouts
- Component boundaries
- Flow arrows

Use professional engineering drawing conventions where practical.

Labels must not overlap.

Dimension lines should automatically reposition themselves intelligently.

Add:

- Zoom
- Pan
- Fit to screen
- Reset view
- Dimension visibility
- Label visibility
- Flow-animation toggle
- SVG export
- PNG export


==================================================
12. SCHEMATIC VISUAL QUALITY
==================================================

The Venturi body must no longer look like a basic manually drawn polygon.

It should have:

- Smooth geometric transitions
- Proper converging nozzle
- Clearly defined throat
- Suction inlet
- Mixing region
- Smooth diffuser
- Distinct wall boundaries
- Engineering linework
- Consistent dimension annotations
- Restrained depth/shading where appropriate

The final result should look like a professional technical engineering visualization.

Do not make it look like clip-art.

==================================================
13. SCHEMATIC VIEW MODES
==================================================

Create at least two schematic modes:

MODE 1:
Engineering Schematic

Focused on:

- Geometry
- Dimensions
- Labels
- Components
- Technical drawing clarity

MODE 2:
Flow Visualization

Focused on:

- Motive fluid
- Velocity behavior
- Suction/entrainment
- Particle movement
- Mixing
- Throat transport
- Diffuser behavior

Do not overcrowd one view with every possible visualization.

==================================================
14. HIGH-QUALITY FLOW ANIMATION
==================================================

Create a visually impressive animated flow through the Venturi.

This is NOT CFD.

The purpose is to provide a logically derived engineering visualization based on calculated hydraulic values.

Explicitly position it as:

"Calculated Flow Visualization"

or

"Engineering Flow Visualization"

Never describe it as:

- CFD
- transient CFD
- multiphase CFD
- turbulence simulation
- exact particle dynamics
- validated physical simulation

The animation should communicate relative hydraulic behavior, not claim exact simulation fidelity.


==================================================
15. FLOW ANIMATION PHYSICS / LOGIC
==================================================

The animation should represent:

1. Motive fluid entering
2. Fluid accelerating through the nozzle
3. High-speed jet at nozzle exit
4. Suction/entrainment from the suction inlet
5. Mixing
6. Transport through throat
7. Deceleration through diffuser
8. Discharge

Animation speed must be driven by actual calculated local velocity.

Concept:

CALCULATED LOCAL VELOCITY
        ↓
NORMALIZED LOCAL VELOCITY
        ↓
ANIMATION SPEED
        ↓
VISUAL FLOW MOVEMENT

Higher calculated local velocity:

→ faster visible flow

Lower calculated local velocity:

→ slower visible flow

Do NOT use the same animation speed everywhere.


==================================================
16. FLUID VISUALIZATION
==================================================

Use high-quality:

- Streamlines
- Flow streaks
- Fluid particles
- Smooth motion
- Transparency
- Subtle gradients
- Velocity-dependent movement
- Soft visual turbulence/noise where appropriate

The motive flow should visually accelerate through the nozzle.

The flow should appear to decelerate in the diffuser.

The animation should not look like unrelated circles moving along a line.

Aim for a polished engineering visualization comparable to modern simulation software interfaces, while keeping the underlying visualization approximate.


==================================================
17. ENTRAINED SOLIDS / PARTICLES
==================================================

Because this application involves slurry/soil transport, show entrained solids distinctly.

Particles should:

- Enter from the suction port
- Move toward the mixing region
- Become entrained by the motive jet
- Accelerate through the throat
- Continue into the diffuser/discharge

Particle characteristics should relate visually to:

- Particle size
- Material type
- Slurry condition

Use suitable earth/brown tones for soil/solid particles.

Use deterministic seeded randomness so particle behavior does not visually jump on every React render.


==================================================
18. FLOW ANIMATION CONTROLS
==================================================

Provide:

- Play
- Pause
- Reset
- Animation speed multiplier
- Show/hide motive fluid
- Show/hide particles
- Show/hide velocity visualization
- Show/hide flow arrows
- Reduced-motion mode

The BASE animation speed must come from calculated hydraulic velocities.

The user-facing animation multiplier only changes playback speed visually.

==================================================
19. INTERACTIVE DIMENSION INSPECTION
==================================================

Add a geometry inspection capability.

Clicking a component should show the corresponding engineering information.

Example:

THROAT
--------------------------------
Diameter        100.4 mm
Length          803.4 mm
Area              0.00792 m²
Velocity         XX.X m/s
Reynolds         X.XXE6
--------------------------------

Use the same authoritative calculation state.

Do not duplicate calculation logic in the inspector.

Possible components:

- Nozzle
- Throat
- Suction inlet
- Mixing chamber
- Diffuser
- Discharge

==================================================
20. SCHEMATIC ↔ RESULTS LINK
==================================================

Create strong interaction between the geometry and calculated results.

Example:

Click:

"Throat Diameter — 100.4 mm"

in Results

→ highlight throat geometry in schematic.

Click:

Throat geometry

→ highlight relevant throat parameters/results.

This should make the entire application feel like one engineering model.

==================================================
21. PERSISTENT DESIGN SUMMARY
==================================================

On the Inputs page, provide a compact live Design Summary.

Example:

CURRENT DESIGN
--------------------------------
Throat Diameter      100.4 mm
Throat Length        803.4 mm
Nozzle Diameter       40.17 mm
Total Flow            4093 L/min
Motive Power           45.83 kW
Cavitation Index         0.351

Validation
✓ 12 passed
⚠ 1 review

The summary should update immediately when the design changes.

This allows the engineer to see the effect of parameter changes without constantly switching pages.


==================================================
22. DESIGN REVISION SYSTEM
==================================================

Introduce a clearer project/design revision concept.

Example:

Project:
VJP-024

Design:
Rev C

Status:
In Review

Modified:
25 Sep 2026

Use revision metadata consistently.

This should support future comparison of design variants.

Do not implement unnecessary project-management complexity if the current application does not support persistence, but establish the UI architecture so revisions can be extended later.


==================================================
23. ASSUMPTION VISIBILITY
==================================================

Clearly distinguish between:

- User Input
- Calculated
- Assumed
- Empirical
- Derived
- Reference/limit

Example:

THROAT SAFETY FACTOR
1.20
Type: Design Input

ENTRAINMENT RATIO
0.637
Type: Calculated

DIFFUSER ANGLE
6°
Type: Design Assumption

This is important for engineering credibility and auditability.

Do not make assumptions look like calculated results.


==================================================
24. RESULTS PAGE
==================================================

Redesign Results as a professional engineering summary.

At the top, provide an unambiguous calculation/design status.

Possible statuses:

DESIGN ACCEPTABLE

REVIEW REQUIRED

CALCULATION BLOCKED

Do NOT automatically state:

"Proceed to fabrication"

unless the application's validation logic genuinely supports such a conclusion.

Status should be based on actual validation conditions.


==================================================
25. RESULTS CARDS
==================================================

Use cards only for the most important design outputs.

Key values include:

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

Use large, highly readable engineering values.

Example:

THROAT DIAMETER

100.4 mm

Calculated


==================================================
26. CALCULATION STEPS PAGE
==================================================

Turn Calculation Steps into a genuine engineering calculation audit trail.

Every calculation step should contain:

- Step number
- Objective
- Inputs
- Equation
- Substituted values
- Result
- Units
- Assumptions
- Reference/source where applicable

Example:

STEP 04

NOZZLE EXIT VELOCITY

Aₙ = πDₙ² / 4

Aₙ = π × (0.04017 m)² / 4

Vₙ = Qₙ / Aₙ

Result:

32.9 m/s

Use expandable calculation sections.

Provide optional:

- Copy equation
- Copy result
- View assumptions


==================================================
27. HYDRAULIC PROFILES
==================================================

Retain the existing four engineering plots:

1. Pressure vs Venturi Length
2. Velocity Distribution
3. Energy & Hydraulic Grade Lines
4. Reynolds Number Variation

Keep the four plots in a 2 × 2 desktop layout.

The existing charts have useful technical content but require substantial visual hierarchy improvement.


==================================================
28. HYDRAULIC PROFILE TITLES
==================================================

Make every chart title:

- Larger
- More prominent
- Centered horizontally
- Positioned at the top center of the plot card

Do not leave titles small and left-aligned as in the current version.

The title should be visually distinct from:

- axis labels
- legend
- plot area

==================================================
29. CHART IMPROVEMENTS
==================================================

Improve:

- Chart title
- Axis titles
- Units
- Tick labels
- Grid
- Legend
- Line thickness
- Component markers
- Hover states
- Tooltips
- Data inspection
- Margins
- Readability

Ensure engineering units are obvious.

Use consistent axial-position scales.

Do not display excessive precision.

==================================================
30. SYNCHRONIZED HYDRAULIC DATA INSPECTION
==================================================

Where practical, enable synchronized inspection across plots.

Example:

Hover at:

Axial Position = 650 mm

Display:

Static pressure
Velocity
Head
Reynolds number

at the same position.

This should make the hydraulic-profile section function as an engineering analysis tool rather than four isolated charts.


==================================================
31. SCHEMATIC ↔ HYDRAULIC PROFILE LINK
==================================================

Create bidirectional interaction where practical.

Example:

Hover/click a region on the schematic

→ highlight the corresponding region on the hydraulic plot.

Hover a hydraulic profile

→ highlight the corresponding region in the schematic.

The goal is to establish a relationship:

GEOMETRY
↔
HYDRAULIC BEHAVIOR


==================================================
32. VALIDATION PAGE
==================================================

Transform Validation into an engineering design review interface.

Organize validation checks into categories:

- Geometry
- Particle passage
- Hydraulic limits
- Velocity
- Cavitation
- Pressure recovery
- Reynolds number
- Pipe compatibility
- Design limits
- Engineering assumptions

Every validation item should communicate:

WHAT WAS CHECKED
CALCULATED VALUE
REQUIRED CONDITION
STATUS
BASIS / SOURCE

Example:

PASS

Throat-to-particle ratio

Calculated:
10.04

Required:
≥ 5.0

Basis:
Design criterion

Do not show only green/red icons.


==================================================
33. GOVERNING EQUATIONS
==================================================

Create a professional engineering reference page.

Organize equations into:

- Fundamental equations
- Hydraulic equations
- Empirical correlations
- Design criteria
- Derived relationships
- Engineering assumptions

Each equation section should contain:

- Equation name
- Equation
- Variable definitions
- Units
- Assumptions
- Where it is used

Do not make this page look like a blog article.

It should look like a technical engineering reference.


==================================================
34. COMPARE PAGE
==================================================

Allow users to compare saved design variants.

Comparison should cover:

- Key inputs
- Geometry
- Hydraulic results
- Performance
- Validation
- Power
- Total flow
- Cavitation
- Ratios
- Critical dimensions

Use an engineering comparison table.

Make numerical comparison easy to scan.

Allow comparison export where practical.


==================================================
35. UNITS
==================================================

SI / Imperial switching must propagate consistently throughout the application.

This includes:

- Inputs
- Results
- Schematic
- Dimensions
- Hydraulic profiles
- Validation
- Equations where appropriate
- Reports
- Exported data

Use a canonical internal unit system where practical.

Perform unit conversions at the UI boundary.

Do not allow mixed units to appear accidentally.


==================================================
36. ENGINEERING NUMERICAL FORMATTING
==================================================

Numerical data should be formatted professionally.

Tables:

Parameter                  Value
-------------------------------------
Throat diameter            100.4 mm
Throat length              803.4 mm
Nozzle diameter             40.17 mm

Right-align numerical values.

Avoid unnecessarily long floating-point values.

Respect appropriate engineering precision and significant figures.


==================================================
37. REPORT / PDF
==================================================

Upgrade the Report/PDF experience.

The report should include:

- Venturi Jet Pump logo
- Project information
- Design/revision
- Inputs
- Calculation summary
- Geometry
- Parametric schematic
- Hydraulic profiles
- Validation
- Governing equations
- Assumptions
- Key results

The PDF should resemble a professional engineering design report.

It should NOT look like screenshots pasted into a PDF.


==================================================
38. PROJECT STATE / AUTOSAVE
==================================================

Make design persistence state obvious.

Display:

Saved
Saving...
Unsaved changes

Use clear visual indicators.

If autosave exists, communicate it clearly.

Do not allow users to assume an engineering modification is safely stored when it is not.


==================================================
39. ERROR HANDLING
==================================================

Errors must be written in engineering language.

Bad:

"Something went wrong."

Better:

"Calculation cannot proceed because the throat diameter does not satisfy the minimum particle-clearance criterion."

Show:

- Problem
- Why it matters
- Responsible parameter
- Recommended action


==================================================
40. PERFORMANCE
==================================================

The application must remain responsive while handling:

- Dynamic calculations
- Multiple hydraulic charts
- SVG geometry generation
- Animated particles
- Frequent input changes
- Schematic updates

Avoid unnecessary React re-renders.

Memoize expensive calculations and geometry where appropriate.

Use requestAnimationFrame for animation.

Avoid creating thousands of unnecessary DOM/SVG objects for particle animation.

Use canvas/WebGL selectively if required for high-performance flow visualization.

Do not introduce unnecessary rendering complexity.


==================================================
41. RESPONSIVE DESIGN
==================================================

This is primarily a desktop engineering application.

Prioritize:

- 1280 px
- 1440 px
- 1600 px+
- Large engineering monitors

At smaller sizes:

- Collapse navigation intelligently
- Stack results where needed
- Preserve chart readability
- Allow horizontal scrolling for large engineering tables
- Maintain usable schematic controls

Do not compromise engineering readability simply to force everything into a narrow mobile layout.


==================================================
42. ACCESSIBILITY
==================================================

Implement:

- Keyboard-accessible controls
- Visible focus states
- Sufficient contrast
- Non-color-only validation
- Accessible labels
- Tooltips
- Reduced-motion mode

The flow animation must NEVER be necessary to understand the calculated engineering result.


==================================================
43. VISUAL HIERARCHY
==================================================

The user should immediately understand:

WHERE AM I?
        ↓
WHAT INPUTS ARE ACTIVE?
        ↓
WHAT WAS CALCULATED?
        ↓
WHAT IS THE RESULT?
        ↓
WHAT DOES THE GEOMETRY LOOK LIKE?
        ↓
HOW DOES THE FLOW BEHAVE?
        ↓
DOES IT PASS VALIDATION?
        ↓
WHAT DESIGN SHOULD BE COMPARED OR EXPORTED?

Every page should reinforce this hierarchy.


==================================================
44. ADDITIONAL ENGINEERING UX IMPROVEMENTS
==================================================

Implement the following six improvements as first-class features.

--------------------------------------------------
A. PERSISTENT DESIGN SUMMARY
--------------------------------------------------

On the Inputs page provide a live Design Summary showing critical outputs.

It should update immediately when input values change.

Include:

- Throat diameter
- Throat length
- Nozzle diameter
- Total flow
- Motive power
- Cavitation index
- Validation summary

This provides instant feedback without requiring navigation to Results.


--------------------------------------------------
B. DESIGN REVISION SYSTEM
--------------------------------------------------

Introduce project/design revision metadata.

Example:

Project:
VJP-024

Design:
Rev C

Status:
In Review

Modified:
25 Sep 2026

Design revisions should become the basis for future comparison functionality.

Keep the implementation lightweight unless full project-management functionality already exists.


--------------------------------------------------
C. ASSUMPTION VISIBILITY
--------------------------------------------------

Every significant engineering value should be identifiable as one of:

- Input
- Calculated
- Assumed
- Empirical
- Derived
- Limit/reference

This is important for engineering review and auditability.

Make this information visually clear without cluttering the interface.


--------------------------------------------------
D. GEOMETRY CROSS-SECTION / VIEW MODE
--------------------------------------------------

Provide separate visualization modes:

Engineering Schematic:
- Clean dimensioned drawing
- Geometry-focused

Flow Visualization:
- Fluid animation
- Entrained particles
- Velocity behavior
- Flow direction

Allow users to switch modes without losing the current model state.


--------------------------------------------------
E. DIMENSION INSPECTION
--------------------------------------------------

Make schematic components interactive.

Clicking the:

- Nozzle
- Throat
- Suction inlet
- Mixing region
- Diffuser
- Discharge

should show the corresponding:

- Dimensions
- Hydraulic parameters
- Calculated quantities
- Relevant engineering status

The schematic becomes an interactive engineering model rather than a static illustration.


--------------------------------------------------
F. GEOMETRY ↔ CALCULATION LINKING
--------------------------------------------------

Create strong bidirectional connections between:

Inputs
↔
Results
↔
Schematic
↔
Hydraulic Profiles

Examples:

Click Throat Diameter in Results
→ highlight throat in schematic.

Click Throat in schematic
→ highlight throat parameters/results.

Hover a hydraulic profile region
→ highlight corresponding geometry region.

The goal is to make the application feel like one coherent engineering model.

==================================================
45. ENGINEERING DESIGN STATE
==================================================

Whenever possible, visually communicate the state of the design:

- Valid
- Modified
- Unsaved
- Warning
- Calculation blocked
- Review required
- Accepted

Use status indicators consistently throughout the application.

Do not rely solely on color.

==================================================
46. DO NOT BREAK ENGINEERING LOGIC
==================================================

Preserve:

- Existing calculation formulas
- Existing engineering methods
- Existing input relationships
- Existing outputs
- Existing calculation dependencies

unless a real defect is found.

Do NOT create simplified formulas purely to make the UI easier.

Visualization must consume real calculated outputs.

If a visual value is approximated for animation purposes, clearly separate it from actual engineering outputs.

Never present the animation as CFD.

==================================================
47. IMPLEMENTATION STRATEGY
==================================================

Before changing code:

1. Inspect the complete project structure.
2. Identify calculation engine/state.
3. Identify input model.
4. Identify current result calculations.
5. Identify routing.
6. Identify current chart implementation.
7. Identify current schematic implementation.
8. Identify animation implementation.
9. Identify report/PDF implementation.
10. Identify logo/assets.
11. Identify reusable UI components.
12. Identify current unit handling.
13. Identify persistence/project-state handling.

Then create a clear implementation plan.

Do NOT blindly rewrite the entire application.

Refactor existing functionality where appropriate.


==================================================
48. RECOMMENDED COMPONENT ARCHITECTURE
==================================================

Where practical, structure the application around reusable components such as:

ApplicationShell
ProjectHeader
SidebarNavigation
ProjectStatus

InputWorkspace
InputSection
EngineeringInput
UnitSelector
ParameterHelp
ValidationIndicator

DesignSummary
ResultCard
EngineeringTable

CalculationStep
EquationCard

VenturiSchematic
VenturiGeometry
DimensionAnnotation
ComponentHighlight
FlowAnimation
ParticleRenderer
SchematicControls

HydraulicChart
SynchronizedChartCursor

ValidationCheck
ValidationCategory

EquationReference
DesignComparison

Do not create needless abstraction for its own sake.

Favor maintainable engineering-oriented components.


==================================================
49. INPUT → GEOMETRY → FLOW PIPELINE
==================================================

The frontend architecture should conceptually follow:

USER INPUT
     ↓
VALIDATED PARAMETER STATE
     ↓
CALCULATION ENGINE
     ↓
CALCULATED GEOMETRY
     ↓
2D PARAMETRIC SCHEMATIC
     ↓
FLOW VISUALIZATION
     ↓
HYDRAULIC PROFILES
     ↓
VALIDATION
     ↓
REPORT

Avoid disconnected representations of the same geometry.


==================================================
50. ORANGE ACCENT USAGE
==================================================

The application should clearly look orange/amber branded.

Use orange/amber for:

- Active navigation
- Primary buttons
- Important controls
- Selected tabs
- Focus states
- Key engineering highlights
- Interactive component selection
- Design-state emphasis

However, keep technical visualization colors semantically meaningful.

For example:

Motive fluid:
blue/cyan family

Solids:
earth/brown tones

Warning:
amber

Error:
red

Success:
green

Do not replace every visualization color with orange.


==================================================
51. GENERAL UI POLISH
==================================================

Perform a full application-wide UI polish pass.

Improve:

- Spacing
- Alignment
- Component sizing
- Typography
- Section hierarchy
- Card density
- Tables
- Numeric formatting
- Button hierarchy
- Input readability
- Hover states
- Focus states
- Tooltips
- Empty states
- Loading states
- Error states
- Status indicators
- Page transitions where useful

Do not make the interface unnecessarily decorative.

Use fewer, stronger visual elements.

Do not turn every piece of data into an individual card.


==================================================
52. INFORMATION DENSITY
==================================================

This is professional engineering software.

It should support high information density without becoming visually chaotic.

Use:

- Strong grouping
- Consistent spacing
- Alignment
- Typography hierarchy
- Technical tables
- Well-organized cards

Do not create excessive whitespace that forces engineers to scroll unnecessarily.

At the same time, avoid cramming multiple unrelated parameters together.


==================================================
53. MICRO-INTERACTIONS
==================================================

Add subtle professional micro-interactions:

- Smooth input focus
- Controlled card transitions
- Selection highlights
- Schematic component highlighting
- Chart hover interactions
- Status transitions
- Save-state feedback
- Calculation update indication

Avoid:

- Bouncy animations
- Excessively animated UI
- Distracting transitions


==================================================
54. ENGINEERING CREDIBILITY
==================================================

The UI must visually communicate that results are engineering calculations.

Therefore:

- Show units prominently
- Show formulas where appropriate
- Distinguish calculated vs assumed
- Show validation basis
- Show warnings
- Show calculation trace
- Maintain revision information
- Provide professional exports
- Avoid marketing terminology

Use technical language consistently.


==================================================
55. PRIORITY ORDER
==================================================

Implement in this order:

P0 — Core application redesign

- Application shell
- Navigation
- Inputs page
- Orange/amber design system
- Logo
- Project state
- Design Summary

P1 — Parametric engineering visualization

- Dynamic Venturi schematic
- Dynamic dimensions
- Parametric geometry
- Zoom/pan
- Component inspection
- SVG export
- PNG export

P2 — Flow visualization

- Motive fluid animation
- Velocity-dependent animation
- Entrained particles
- Play/pause/reset
- Reduced motion

P3 — Engineering analysis pages

- Results redesign
- Calculation Steps redesign
- Hydraulic Profiles redesign
- Schematic/profile linking

P4 — Engineering review

- Validation redesign
- Governing Equations redesign
- Assumption visibility
- Revision functionality

P5 — Comparison/report

- Compare
- Report/PDF improvements
- Export refinement
- Final accessibility/performance pass


==================================================
56. ACCEPTANCE CRITERIA
==================================================

Do not consider the redesign complete until the following are satisfied:

[ ] The application no longer uses blue as its dominant product accent.

[ ] Orange/amber is the dominant brand accent.

[ ] Supplied logo is integrated correctly.

[ ] Input controls are removed from the cramped left-side panel.

[ ] Inputs have their own dedicated page.

[ ] All existing input groups remain accessible.

[ ] Calculation logic continues to work.

[ ] A single authoritative engineering state is used.

[ ] Changing inputs updates calculations.

[ ] Changing inputs updates the schematic.

[ ] Changing inputs updates hydraulic profiles.

[ ] Changing inputs updates validation.

[ ] Schematic geometry is generated parametrically.

[ ] Schematic geometry is NOT hard-coded.

[ ] All major dimensions update dynamically.

[ ] Labels remain readable after geometry changes.

[ ] Zoom/pan/fit works.

[ ] SVG export works.

[ ] PNG export works.

[ ] Engineering Schematic mode exists.

[ ] Flow Visualization mode exists.

[ ] Motive fluid and solids are visually distinguishable.

[ ] Animation speed responds to calculated local velocity.

[ ] Animation is clearly presented as an engineering visualization, NOT CFD.

[ ] Animation controls work.

[ ] Reduced-motion behavior is supported.

[ ] Component-level schematic inspection works.

[ ] Schematic and Results are linked.

[ ] Schematic and Hydraulic Profiles are linked where practical.

[ ] Persistent Design Summary exists.

[ ] Design revision information exists.

[ ] Assumed/calculated/input values are distinguishable.

[ ] Results are easier to scan.

[ ] Calculation Steps are auditable.

[ ] Hydraulic chart titles are larger and centered.

[ ] Hydraulic chart axes and units are readable.

[ ] Validation explains the reason for each status.

[ ] Governing Equations are clearly organized.

[ ] Compare page supports design variants.

[ ] SI/Imperial switching remains consistent.

[ ] Report/PDF uses the new branding.

[ ] Project save-state is obvious.

[ ] Engineering errors are understandable.

[ ] Application remains responsive.

[ ] Desktop layouts work correctly at 1280, 1440 and 1600+ widths.

[ ] Keyboard accessibility is supported.

[ ] The final application looks like professional engineering software rather than a generic web dashboard.


==================================================
57. FINAL VISUAL QUALITY BAR
==================================================

Do NOT stop after making superficial CSS changes.

The redesign must improve:

1. Information architecture
2. Input workflow
3. Engineering visualization
4. Parametric geometry
5. Flow visualization
6. Hydraulic visualization
7. Calculation traceability
8. Validation clarity
9. Engineering auditability
10. Project/revision workflow
11. Branding
12. Interaction design
13. Accessibility
14. Performance
15. Professional engineering appearance

Perform a final visual inspection of EVERY page.

Correct:

- Tiny text
- Poor contrast
- Inconsistent spacing
- Misalignment
- Crowded controls
- Excessive empty space
- Poor chart hierarchy
- Overly small chart titles
- Schematic label collisions
- Incorrect dimension positioning
- Inconsistent orange usage
- Weak status indicators
- Inconsistent component sizing
- Poor responsive behavior

The final result should feel like a coherent professional engineering product.

==================================================
58. MOST IMPORTANT DESIGN PRINCIPLE
==================================================

The Venturi Jet Pump must be treated as a:

**PARAMETRIC ENGINEERING MODEL**

not as:

**A CALCULATOR WITH A DRAWING**

The following must all represent the same underlying design:

INPUTS
→ CALCULATIONS
→ RESULTS
→ GEOMETRY
→ FLOW VISUALIZATION
→ HYDRAULIC PROFILES
→ VALIDATION
→ REPORT

The user should feel that they are modifying one engineering model and viewing different representations of it.

That coherence is the central design objective of this redesign.