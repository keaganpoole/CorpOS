# Relationship studies / concepts

## Brief

Six independently interactive explorations, a quiet thumbnail rail, one visible experiment. No backend or product dashboard. The working material is neutral: Collection → Alpha / Beta / Gamma / Delta → numbered elements. Each study keeps its own state while switching concepts.

## Research translated into decisions

- [Apple: Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/). Spatially consistent, interruptible transitions maintain the sense that an object persists. Applied through directional expansion, spring retargeting, reversible layer separation, and shared identities when elements change parents. Motion should settle without unnecessary oscillation.
- [Heer and Robertson: Animated Transitions in Statistical Data Graphics](https://www.microsoft.com/en-us/research/publication/animated-transitions-in-statistical-data-graphics/). Their experiments support animation as a perceptual aid. Our application is a design inference: animate the property that explains the relationship—width, scale, distance, or membership—instead of routinely fading whole interfaces.
- [Shneiderman: Treemaps for space-constrained visualization of hierarchies](https://www.cs.umd.edu/hcil/treemap-history/). Containment saves space; stable ordering helps users follow changing layouts. Applied in Within's nested boundaries and Continuum's ordered spans. These prototypes explore editing, rather than using area to claim quantitative importance.

## The wider design space

Considered before implementing:

1. Conventional node canvas — rejected: familiar connection model.
2. Radial satellites — rejected: disconnection, space metaphor.
3. Sunburst editor — rejected: tiny angular targets, chart-first behavior.
4. Voronoi regions — rejected: unstable boundaries obscure ownership.
5. Nested windows — rejected: conventional cards, wasted frame area.
6. Expanding lateral folds — retained as Unfold.
7. Recursive circular containment — retained as Within.
8. Nested rectangular treemap — rejected as redundant with containment.
9. Continuous divided intervals — retained as Continuum.
10. Vertical accordion — rejected as too similar to unfolding.
11. Responsive typographic index — retained as Passage.
12. Three-dimensional depth separation — retained as Strata.
13. Drag-to-parent membership basins — retained as Gather.
14. Literal shelves / drawers — rejected: physical costume dominates.
15. Freeform lasso clusters — rejected: unclear initial ownership.
16. Stretching elastic connections — rejected: node graph in disguise.
17. Infinite semantic zoom — reduced to bounded, reversible containment.
18. Timeline hierarchy — rejected: suggests chronology where none exists.
19. Text-only outline — rejected: too ordinary without spatial response.
20. Gesture-only grouping — rejected: discoverability and accessibility.

## Six design theses

| Study | How belonging is represented | Signature interaction | Production potential |
| --- | --- | --- | --- |
| Unfold | A shared spine and adjacent folds | Opening one fold compresses its siblings; children emerge from its seam | Compact hierarchy editing with visible sibling context |
| Within | One boundary literally contains another | A child becomes the enclosing parent through spatial zoom | Exploration of deeply nested collections |
| Continuum | A continuous whole divided into ordered spans | Dragging a seam reallocates space between neighbors; children occupy a subordinate interval | Ordered relationships and proportional editing |
| Passage | Typographic scale, reading order, and indentation | Attention opens a line into an index of its children while surrounding lines compress | Dense keyboard-friendly structure navigation |
| Strata | Depth represents generation | Separating the planes exposes parent, children, and grandchildren; face-on view flattens the same hierarchy | Inspecting multiple levels without connectors |
| Gather | A parent's open boundary encloses its members | Multi-selection and direct transfer preserve each element's visual identity | Fast reassignment and cleanup of existing structures |

## Motion contracts

- Folds: damped width redistribution; inner material reveals from the opening seam.
- Containment: coordinates and radii share a transform toward the selected enclosure.
- Intervals: the selected span keeps its exact origin; child subdivisions follow its boundary.
- Index: baseline alignment and a growing reading interval preserve sibling order.
- Depth: separation is a continuous parameter; compression reverses the same path.
- Membership: layout identities persist between parents; origin and destination both rebalance.
- Reduced-motion preferences disable spatial tweening through MotionConfig and scoped CSS.

## Validation status

Initial production build passes. Rendered review and refinement are tracked separately; source review alone is not visual validation.

## Extension: studies 07–11

Added five studies alongside the original six:

- **Switchboard**: an incidence matrix makes each parent assignment explicit. Persistent markers travel between columns. The research on matrix versus node-link readability (https://aviz.fr/wiki/uploads/Teaching/MatrixVsNodeLink.pdf) informed this direction; its evidence is task-dependent, not a claim that matrices outperform every other approach.
- **Ligature**: bottom-up construction. Select a contiguous sequence, name its new parent, enter it, dissolve it, or undo the change. The selected range becomes a single structural unit.
- **Turn**: angular position is an index. Navigation rotates labels along an arc while counter-rotation keeps the type upright. A selected child can become the next parent.
- **Echo**: hierarchy is communicated through live inheritance. Editing the parent changes linked children; a child can retain a local variation and subsequently reconnect. Shape is functional feedback, not decoration.
- **Tessera**: a parent is a continuous two-dimensional partition. Move a region's handle to change its boundary without changing ownership, enter a region, and create children within it.

Rejected extension directions included another accordion, stacked cards, an orbital node layout, and a second conventional outline: each repeated an existing study's structural idea. The five selected directions introduce matrix assignment, bottom-up grouping, rotational indexing, behavioral inheritance, and direct two-dimensional partition editing.

### Rendered inspection and refinement

All five additions were rendered and interacted with in the connected in-app browser at desktop and 390px mobile widths. Each received a post-render refinement pass:

- Switchboard: repaired heading/footer overlap, bounded the matrix's scrolling area, and kept assignment controls visible at laptop heights. Verified moving Element 01 from Alpha to Beta and correct membership counts.
- Ligature: reduced introductory typography once editing begins and gave newly created parents an explicit inner-child strip. Verified grouping Elements 02–04 into Assembly, entering Assembly, returning, and dissolving it while preserving children.
- Turn: replaced chord-like position transitions with real angular rotation and counter-rotated labels. Verified advancing from Alpha to Beta, descending into Beta, and navigating its children.
- Echo: reduced oversized specimens and brought the local editor into the initial desktop viewport. Verified a child override of 80 survives a parent change to 65, then Follow parent restores inheritance.
- Tessera: reduced the map footprint and selected fill, made handles visibly actionable, and corrected pointer offset during dragging. Verified boundary reshaping, descent into Alpha, and nested region creation.

The eleven-item thumbnail rail scrolls independently on desktop and horizontally on narrow screens. Study state survives switching concepts. The original Unfold was rechecked after the shell changes. Prototype edits are session-local and reset on reload; no backend or production data is involved.

## Drop In adaptation
All eleven studies now operate on one local Drop In draft, grouped by pending, confirmed, completed, missed, and cancelled appointment status. Actions retain name, purpose, prompt, enabled state, ordering, and parent identity across concept switches. The editor supports validated parent changes; the appointment preview follows the same enabled-ancestor rules as the production graph. Echo now explores branch availability instead of invented prompt inheritance. No backend writes or calls occur. Drafts persist in browser local storage.

Validation: production build, four domain-model tests (status preservation, subtree movement/cycle prevention, disabled branch preview, grouping/removal retaining instructions), rendered desktop review of all eleven layouts, mobile editor and preview, cross-concept reassignment, undo, and saved-purpose preview. Refinements include longer-name layouts, containment spacing, a compact rotational title, aligned status/selection bars, and responsive action details.

