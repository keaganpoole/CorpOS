# Design QA — Masonry catalog overhaul

## Current verification status

The previous catalog QA below is historical and does not validate this overhaul.

- Source references: Grid Gallery Pro with Masonry and Default selected (visually inspected at 1280 × 720); Infinite Image Gallery live demo (drag/release and expansion inspected); Interactive Box Grid source (distance falloff and smoothing inspected).
- Current implementation: full-page virtualized masonry gallery, repeated catalog portraits, pointer-centered wheel zoom, three zoom controls, softened neon hover lift, and one selected receptionist detail card.
- Gray catalog decorations and office background are removed from this route.
- Fonts/typography: existing Inter; small uppercase zoom toolbar, based on the inspected reference.
- Spacing/layout: 210px columns, 4px gutters, varied tile heights, no rounded tile corners; tested continuous column coverage across positive and negative pan coordinates and all zoom limits.
- Colors/tokens: black gallery background; subtle pink/purple screen overlay and aura tied to hover distance.
- Image/content: existing catalog portraits and corresponding detail/voice/personality/hire data reused; repeated tiles are not duplicate catalog records.
- Automated checks: zoom anchor/clamping, masonry continuity and valid portrait mapping, hover falloff, and production build passed.
- Implementation screenshot: not captured. The user's no-browser-inspection instruction remains in effect for app changes; browser permission was granted specifically for inspecting external references.
- Residual verification: rendered desktop/mobile appearance, real pointer/keyboard interactions, audio playback, and live hiring were not browser-tested in this pass. No visual-fidelity pass is claimed.

final result: blocked

## Historical QA — prior entry and carousel implementation

## Comparison setup

- Source visual truth: [Liquid Metal Button+ live reference](https://liquid-metal-button.framer.website/) and its [Framer marketplace page](https://www.framer.com/marketplace/components/liquid-metal-button/), opened and visually inspected in the browser.
- Implementation truth: `http://localhost:5173/dashboard`, authenticated Team → New Receptionist → Audition choice screen and embedded catalog, opened and visually inspected in Chrome.
- Source state: dark Liquid Metal button with a still glass face and moving chrome confined to the perimeter.
- Implementation state: two large choice cards at a 1778 × 1247 CSS-pixel viewport, device pixel ratio 1.
- Card measurements: 526.26 × 407.54 CSS pixels each, 26px radius.
- Catalog measurements: original 440 × 660 CSS-pixel portrait carousel, matching the modal's 2:3 aspect ratio and `max-width: 440px`.
- Density normalization: none; both browser captures were rendered at device pixel ratio 1.

## Findings

No actionable P0, P1, or P2 findings remain.

- The liquid-metal treatment is confined to a masked 2–3px perimeter ring. The card face contains no animated wash or moving fill.
- The chrome ring uses alternating bright, silver, graphite, and near-black highlights like the reference, travels continuously around the perimeter, and responds to pointer position.
- Both card faces use the exact computed background from Audition's guidance-slider control panel: `linear-gradient(145deg, rgba(15, 15, 16, 0.985), rgba(7, 7, 8, 0.99))`.
- The Create card retains stronger emphasis through a slightly heavier chrome edge while the underlying panel color remains identical on both cards.
- Existing Audition cursor-follow tilt remains active and is independent from the border-only liquid motion.
- The embedded receptionist catalog restores the original modal's width, height, portrait proportions, image/body split, typography, spacing, carousel behavior, and controls. Only the modal overlay and close treatment are replaced by the in-page route and Back to choices control.
- The Nodemere Audition wordmark is persistent across the post-splash intro and catalog states, while the existing studio topbar remains the single mark in the create flow.

## Required fidelity surfaces

- Fonts and typography: existing Audition and catalog typography is unchanged; choice-card hierarchy remains legible at the verified viewport.
- Spacing and layout rhythm: cards remain evenly paired; catalog shell is exactly 440 × 660 with the original 2:3 rhythm.
- Colors and visual tokens: card faces match the guidance-panel background declaration exactly; chrome is isolated to the edge.
- Image quality and asset fidelity: catalog portraits retain the original image crop, scale, and dark overlay treatment.
- Copy and content: original catalog content and actions are unchanged; choice copy and navigation remain intact.

## Comparison history

1. The first implementation incorrectly let the liquid treatment wash across the card face and widened the embedded catalog to a 760px landscape carousel. This was a P1 mismatch.
2. The reference was reopened and inspected in its standalone interactive preview. The card treatment was rebuilt as a border-only masked chrome ring, and the card face was reset to the control-room panel background.
3. All embedded-only catalog size and proportion overrides were removed. The revised browser measurement confirms the original 440 × 660 portrait carousel and unchanged internal card structure.
4. Final browser captures confirmed the border-only treatment, static dark card faces, original catalog proportions, working route transitions, and no browser warnings or errors.

## Primary interactions tested

- Team → New Receptionist → Audition splash → choice screen.
- Create a receptionist → existing Audition welcome and creation flow.
- Choose from the catalog → embedded original-proportion catalog.
- Back to choices → choice screen.
- Return to Team → Team page.
- Browser console warnings/errors checked: none.

## Implementation checklist

- [x] Liquid motion is restricted to the card border.
- [x] Card faces exactly reuse the guidance-panel background.
- [x] Both cards retain Audition's mouse-follow tilt.
- [x] Create remains the stronger primary card.
- [x] Catalog restores the original modal dimensions and portrait card proportions.
- [x] Catalog content, imagery, controls, and carousel behavior remain unchanged.
- [x] Nodemere Audition mark remains visible throughout the post-splash Audition shell without duplicating the studio mark.
- [x] Create, catalog, back-to-choices, and return-to-team paths verified.
- [x] Production build passed.

Historical result: passed (before the masonry overhaul)
