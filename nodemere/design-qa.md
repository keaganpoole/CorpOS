# Design QA — Dashboard mobile and tablet update (2026-09-30)

This section is the current dashboard-responsive review. Earlier, unrelated QA is retained below; it is not a release claim for this update.

## Scope and source of truth

- Implementation: authenticated `http://localhost:5173/dashboard` in the Codex in-app Chromium browser, using real existing business records.
- Phone: below 768 CSS pixels. Tablet: 768–1023. Existing desktop layouts and page-specific desktop behavior remain active at 1024 and above, including Calendar's original 1536px split-view threshold.
- Homepage and Scenarios are excluded. No homepage, Scenarios, shared font, brand asset, backend, authentication, or database-schema files were edited. The People table's public demo does not opt into the mobile replacement. Scenarios explicitly sets the dashboard responsive scope to false.
- Approved People image: `C:/Users/Keagan/.codex/codex-remote-attachments/01a0f079-3e92-70b0-abfe-59339d28d6fd/A3BA393D-3C26-4AAC-8071-7DC73D477DB9/1-Photo-1.jpg`.
- Additional approved directions: existing top toolbar, four primary destinations plus More, expandable CRM records, Calendar/appointments tabs, Call Logs list-to-detail navigation, full-width Team cards, dedicated Audition presentation.
- Existing desktop visual truth: `.audit/responsive-implementation/before-desktop-*.png`, captured before implementation at 1440 × 1000.

## Visual comparison setup

- Main implementation capture: `.audit/responsive-implementation/phone-people-360.png`, 360 × 800 CSS and image pixels, devicePixelRatio 1; real Jimmy Johnson record expanded, dark theme, no dialog open.
- Source image: 588 × 1280 pixels, including an external image viewer. App-owned content was cropped at x31/y155, 505 × 950, then normalized to 360px wide. The original screenshot does not establish its CSS viewport or device scale, so this is a composition comparison, not a claim of exact pixel identity.
- Full-view combined input: `.audit/responsive-implementation/compare-approved-people.png`.
- Focused record-card combined input: `.audit/responsive-implementation/compare-approved-people-card.png`. The source card was cropped at x53/y370, 463 × 486, normalized to 328px width; implementation card crop x16/y256, 328 × 365. Both combined images were opened and visually compared.
- Desktop pairs were combined into `.audit/responsive-implementation/compare-desktop-{people,team,calendar,appointments,settings,reports,call-logs,scenarios}.png` and inspected. Raw pair dimensions are 1440 × 1000, DPR 1; comparison boards downsample each side equally to 720 × 500.
- Numeric diagnostics: `.audit/responsive-implementation/desktop-comparison.json`. The diagnostic threshold counts RGB differences greater than 8; it is supporting evidence, not a substitute for visual inspection.

## Findings and comparison history

The first implementation was not accepted without repairs. These findings were addressed and recaptured:

| Severity | Finding and impact | Fix and post-fix evidence |
| --- | --- | --- |
| P1 | Fixed Settings/staff dialogs were constrained by the animated route's containing block, risking clipped actions and bottom-navigation overlap. | Compact-only body portals with focus containment, background inertness, bounded height and scrolling. `phone-staff-form.png`, `phone-service-modal.png`, `phone-editor-short-viewport.png`. Desktop dialog placement is retained. |
| P2 | Dense Colorbar condition rows compressed the operator/value controls on 360px screens. | Two-row condition grid, full-width field selector, usable switch sizes. `phone-colorbar-operator.png`, `phone-colorbar-rule-final.png`. Existing rule evaluation, colors, presets, animation options and saving code are reused. No rule was saved during QA. |
| P2 | Audition's absolute portrait offsets clipped faces when the form was stacked. | Phone-specific portrait region and offsets, original images with contained proportions, wrapped progress navigation. `phone-audition-age.png`, `tablet-audition-prompt-settled.png`. |
| P2 | Business/staff schedule timelines were too compressed for touch editing. | Compact-only day disclosures with start/end selectors; existing validation, warnings, plan restrictions and persistence callbacks retained. `phone-hours-360-final.png`, `tablet-hours-768-final.png`. A start time was changed in the unsaved form and restored, without saving. |
| P2 | Service text, prices and actions competed for narrow columns. | Description/name stack, preserved visible price, separate action column. `phone-services-with-prices-430.png`. |
| P2 | Month cells became oversized at the 767px phone boundary, hiding the agenda below a large grid; default scrollbar was visually inconsistent. | Phone cells fixed to 44px high, dark thin scrollbar. Compare `phone-calendar-767.png` with `phone-calendar-767-final.png`. |
| P2 | Billing, Connections and Account actions squeezed explanatory text into narrow strips. | Compact-only stacked action-card headers. `phone-settings-billing-final.png`, `phone-settings-account-final.png`. No account or billing action was executed. |
| P2 | Knowledge Base's three primary tabs needed horizontal scrolling on phones. | Compact three-column tab layout; existing subsection strip remains horizontally scrollable with larger touch targets. `phone-settings-knowledge-final.png`. |
| P2 | Short-height account confirmation/menu could exceed the viewport. | Compact viewport-height bounds and scrolling; header text no longer collides with Close. Verified at 360 × 500, including Cancel without deletion: `phone-account-dialog-short-final.png`, `phone-account-menu-short.png`. |
| P1 | Audition's return-to-choices page retained desktop horizontal offsets on phone and a percentage-positioned heading on tablet, clipping or overlapping content. | Compact-only normal-flow heading and card positioning, centered wordmark and separate return row. `phone-audition-entry-360-final.png`, `tablet-audition-entry-final.png`; original desktop studio stylesheet untouched. |

## Fidelity review

- **Fonts/typography:** existing application font family and weights retained; no new font imports. Phone form controls use 16px to avoid mobile-browser input zoom. Hierarchy, real names, values and labels were compared in the focused card capture. The mock's tiny scaled controls were not copied as undersized touch targets.
- **Spacing/layout:** aligned 16px phone gutters, consistent expandable cards and outlined actions, separate search row, scrollable sheet bodies and reachable footers. Narrow and short-height variants were inspected, including an editor preserved across rotation to 844 × 390.
- **Colors/tokens:** existing black/zinc surfaces, border opacity and brand gradient variables reused. Colorbar is the existing rule renderer, not a new approximation. No global palette changes.
- **Images/assets:** existing Nodemere logo, business avatar and receptionist portraits are reused. The document viewer successfully loaded the real image attachment. No replacement artwork or invented portraits.
- **Copy/content:** uses actual records and schema labels. The custom-fields disclosure appears only when applicable; all configured custom fields remain in the record editor even when hidden from the compact summary. No invented CRM field values.

Intentional differences from the mock: search has its own row for usability; Colorbar and CRM tools remain explicitly accessible; the subsequently approved bottom navigation is present; no empty custom-fields drawer is shown when only the Docs custom field exists. Structural table tools such as column order, frozen zones and row height remain available on tablet/desktop, as discussed with the user.

## Verification matrix

- Phone CSS viewports: 360 × 800, 360 × 640, 360 × 500, 390 × 844, 430 × 932 and 767 × 900. These are browser viewport simulations, not physical-device testing.
- Tablet/boundary: 768 × 1024, 820 × 1180, 1023px; checked 1024px desktop boundary. Editor rotation was checked at 844 × 390.
- Desktop baseline: 1440 × 1000 before/after. Team, Calendar, Settings and Call Logs have exact pixel matches; People has no pixels over the difference threshold (maximum channel difference 1). Appointments differs by 0.0943% from control hover state, with matching geometry. Reports' before capture had an API warning that was absent in the after capture. Scenarios' before capture had its hover-expanded rail and a different animation frame; its code and responsive exclusion remain unchanged. Do not interpret these state differences as pixel-equivalent evidence.
- Wide desktop Calendar also checked at 1600 × 1000: the original appointments/calendar split and resize separator are present (`desktop-calendar-1600-final.png`).
- Primary interactions checked: phone navigation and More; Calendar tabs/date selection/agenda and Drop-ins; expanding records; record editor fields, dirty-close confirmation and rotation retention; documents and secure image preview; CRM tools and nested field-option dialog; Colorbar controls without saving; Call Logs list/detail/back, empty transcript, search/favorites states; Team/staff and unsaved staff form; Audition guided inputs and tablet prompt layout; Settings section navigation, Hours selectors and unsaved service modal; NEST history and receptionist picker (no conversation started); support modal (no report submitted).
- Settings sections visually inspected: Business Info, Workforce & Security, Connections, Billing, Preferences, Intro Message, Hours, Services & Pricing, Knowledge Base and Account. No MFA/security, billing, routing, account lifecycle or saved business settings were changed.
- Catalog portrait gallery → selected receptionist detail → Back → choices → Create/Return to Team was exercised without hiring. Phone gallery and detail evidence: `phone-catalog.png`, `phone-catalog-detail.png`. Native touch gestures were not tested on physical hardware.
- No production records were created, edited or deleted as QA fixtures. No paid voice generation, live call, hiring, email/invitation, support submission or production deployment was performed.

## Automated checks and limitations

- Production build passes. Existing warnings remain for stale Browserslist data, a pre-existing stylesheet import order, and bundle size.
- New responsive/data tests: 8/8 pass. Guards check desktop CSS media scoping, Scenarios exclusion, public demo opt-in, compact-only modal portals, custom values/options/date formatting and filters.
- Frontend regression suite: 100/101 pass. The failure is the pre-existing `src/lib/browserPrivacy.test.js:26` assertion against `src/components/HomepageReceptionistCatalog.jsx:66`. The same dynamic console call was confirmed in HEAD; the excluded homepage was not modified to repair it.
- Targeted ESLint no-undefined/rules-of-hooks check: 25 changed/new JS/JSX files, zero errors. The repository's ordinary lint command lacks a configured ESLint file, so this targeted check is not described as a full repository lint pass.
- `git diff --check` passes.
- One pre-existing undefined `setHasPresentedConversation` call in Call Logs was removed because it threw while processing selected-call details. This is the only non-presentation correction; desktop appearance is unchanged.
- Existing API timeouts occasionally produced temporary empty states or an aborted-session screen; refresh/reload recovered them. A sample recording's access request failed and the existing error was displayed. Playback authorization was not changed, so end-to-end recording playback is not signed off.
- Browser console review found no new runtime error from the final responsive code. An earlier in-progress HMR reload failure and existing API debug messages were observed; the final production build succeeds.
- Physical iOS Safari/Android, real on-screen keyboards/safe areas, paid generated-portrait result states, and saved create/update/delete flows were not exercised. Short-height/rotation simulation and code review reduce but do not eliminate those release risks.

## Current implementation checklist

- [x] Preserve homepage and Scenarios scope.
- [x] Gate existing-layout changes below 1024px.
- [x] Preserve Colorbar, documents, custom fields, filters and sorting access.
- [x] Compare approved source and rendered output together at full and focused scales.
- [x] Repair the observed alignment, overflow and touch-layout defects.
- [x] Build, regression tests, targeted lint, and desktop screenshot comparisons.
- [x] Finish final short-height account-dialog verification and Audition return-flow repairs.
- [x] Prepare the local dashboard preview and screenshot evidence for handoff.

No observed P0, P1 or P2 responsive-layout findings remain in the checked states. This is a local implementation and visual-QA pass, not production deployment or a claim that the external-service and physical-device limitations above were resolved.

final result: passed

---

# Historical unrelated QA — Masonry catalog overhaul

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

## Phone-only refinement — September 30, 2026

Scope: this second pass applies below 768 CSS pixels only. The first responsive
pass was already present and uncommitted; a source snapshot was saved in
`.audit/mobile-refinement-baseline.zip` before editing. No homepage, Scenarios,
global font, backend, dependency, or deployment changes were made in this pass.
The existing tablet and desktop layouts remain the baseline, not redesign targets.

### Delivered

- NEST-only phone toolbar; compact, single-line notification copy; tap a
  receptionist to start the existing intercom flow; existing end-call controls
  retained. Loading and microphone-permission presentation fits narrow screens.
- More sheet with a decorative top accent, concise account/usage summary, and
  Usage & billing entry. Account access remains available; no visible duplicate
  More title or close-button header.
- Team receptionist carousel with native horizontal snapping, arrow fallback,
  count, visible metrics, slim tabs, and floating white creation buttons. The
  Staff card's fixed 380px width was also corrected on phones.
- Audition's full-width, proportional portrait and compact early-step navigation;
  swipe/arrow transitions retain validation. Redundant guidance is hidden, while
  explicit generation and final-save actions remain deliberate actions.
- People and appointment inline editing, native date/time/single-choice inputs,
  appropriate keyboard hints, multi-select sheet with retry-safe selections,
  configured visible fields, documents, and Colorbar preserved.
- Denser CRM tools and fields, one modal scrolling surface, compact Report a
  Problem, slimmer Reports, and dirty-only bottom Settings save actions with an
  in-app discard warning. Phone Settings section changes reset scroll position.
- Call Logs reuses IntercomVoiceLine; unique SVG gradient IDs allow multiple
  instances without visual collisions.

### Evidence and checks

- Browser layouts inspected at **320×568, 390×844, 430×932**, plus protected
  **820×1180 tablet** and **1440×900 desktop** captures. These are browser viewport
  tests, not physical iPhone/Android tests.
- Desktop Team before/after image comparison differs only within the animated
  online indicator. Tablet differs within that indicator and the hover-only
  delete control. Card geometry, typography, toolbar, and navigation match.
- Phone Team at 430×932 has no vertical scrolling surface. Very short screens
  retain a single carousel overflow fallback so metrics are not inaccessible.
- Live UI checks covered People expansion, appointment expansion/native inputs,
  Calendar date selection, Colorbar rule expansion, CRM/field settings,
  Report a Problem, More → Usage & billing, Settings dirty/discard navigation,
  NEST receptionist selection UI and notification previews, and Call Logs detail.
  No customer-record writes, deletions, billing changes, or report submissions
  were performed for QA.
- Isolated `.audit/mobile-refinement/fixture.html` uses synthetic records and
  in-memory writes. Tested Boolean/number/date/select/custom fields, failed saves
  and multi-select retry, a three-card carousel, and the Audition path through
  identity, age, accent, tone, prompt, mocked voice generation, mocked portraits,
  review, and mocked save. No paid generation or real creation was triggered.
- Seven held NEST notification categories were visually checked with long text
  at 320px. Text ellipsizes within the available width; metrics and icons remain
  visible. The shared animated audio paths were observed rendering in the fixture.
- `npm run build`: passed. Existing warnings remain for old Browserslist data,
  a late global CSS font import, and large bundles.
- Seven focused Node test files: **42 passed, 0 failed**. Includes breakpoint and
  excluded-route guards, CRM field/Colorbar contracts, catalog geometry, voice
  definition, hiring payloads, graph logic, and template escaping.
- `git diff --check -- src/sonar`: passed. Source comparison against the saved
  baseline contains only the intended Sonar refinement files.

### Verification limits before production release

- Native iOS/Android picker appearance, automatic keyboard opening, safe-area
  behavior with real browser chrome, physical swipe arbitration, and enlarged
  system text still need physical-device checks. OS/browser policies can decline
  an automatic keyboard request even when the search input is focused.
- Real intercom microphone permission, connection, cancellation, hang-up, and
  live audio transport were not exercised. No call was placed. The Call Logs
  playback UI was inspected, but successful real-record playback was not confirmed.
- Audition's paid services and voice-cloning/recording path were not invoked;
  the complete design path was exercised using stubbed service responses.
- A transient existing services-load error occurred during live Settings QA;
  it was not a rendering crash and was not changed as part of this layout pass.
- This work is implemented locally, not deployed. Screenshots are in
  `.audit/mobile-refinement/`; the isolated fixtures are QA-only and are not
  imported into the production application.
