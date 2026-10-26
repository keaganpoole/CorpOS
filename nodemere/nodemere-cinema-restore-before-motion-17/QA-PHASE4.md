# Revision 08 — review record

## Implementation checks

- ESLint and TypeScript: passed after final source changes.
- Existing source comparison: only `src/FullFilm.tsx` and `src/Root.tsx` changed
  among the previously packaged source files. Both register/append the new scenes.
- All existing scene implementations and their prepared media are preserved.
- All 13 native product sources in the extraction provenance match their hashes.
- All 58 extracted native CSS keyframe bodies match the product originals.
- No new CSS selectors escape the `.phase4-product` scope.
- Studio reported no runtime error. New scenes were inspected in Studio and
  rendered at the 1080p delivery resolution.

## Visual review and refinements

Reviewed full-size scene frames and encoded temporal contact sheets at 12 fps,
with denser samples around scene handoffs, native notification reels, execution
and the Intercom receptionist switch.

### People CRM

- Native row/cell entrance and Zone flicker are visible and deterministic.
- The palette stays in the cinematic coordinate system. Its selected purple
  swatch agrees with the Zone color after the cursor presses it.
- Six field types are visible in the native menu. Field Settings fits the frame;
  the save action and new Loyalty member column stay readable.
- Color Bars retain their original sweep/pulse; the close pass traverses the rows.
- Deliberate table-edge cropping is limited to the cinematic close-ups.

### Scenarios

- Configured nodes, native sphere layers and connection anchors are retained.
- The trigger tracking shot reaches Appointment Missed. Action selection,
  Call Customer configuration, variable insertion and condition are readable.
- Cursor positions match the trigger, add control, options and Record ID row.
- Configured-node and execution clocks are separate; execution does not replay
  the node reveal. The inactive fallback stays visually subordinate.
- The toolbar follows the actual appointment-trigger mode. Manual-only controls
  are not displayed for this example.

### Nest / Intercom

- Native notification titles and second-stage details are visible for all four
  examples; the incoming-call color sweep is retained.
- Notification spacing tightens before the shell expands into Intercom.
- Maggie, Piper and Kayla use the corresponding original local portraits/banners.
- The three short conversations remain readable. Waveform phase stays continuous
  and its original spring handles attack and release across dialogue gaps.
  Changing receptionists clears
  the previous person's dialogue before displaying the next conversation.
- The outer shell remains stationary through the two receptionist switches.
  The ending performs its separate planned pullback.

### Corrected during encoded review

The first pass exposed short black gaps before the new title reveals and before
the Scenarios canvas entered. The title timing and outgoing compositing were
corrected; the Scenarios rise now shares its easing with the title exit.
The three repaired 210-frame intervals each pass their own all-frame black scan.
A later native-to-encoded comparison caught softening in the CLI render path.
PNG alone did not resolve it. A direct-renderer comparison reduced mean RGB
error from 3.27/255 to 0.63/255 at the CRM close-up; a longer three-tab render
retained 0.64/255 after camera movement. The final continuation uses that
verified direct-renderer path with PNG capture. Inspection of the installed
renderer found the CLI passes the output scale (0.5) as the browser's forced
device scale factor; the direct renderer keeps the browser's normal density.
No product styling was changed to mask the capture difference.

## Final media validation

- Final full-film decode: passed for all 14,766 frames.
- All-frame scan: zero unexpected black frames and zero blank Intercom avatar regions.
- Approved prefix: all 7,176 decoded frames are pixel-identical to revision 07.
  SHA-256: `53b8db8a0704dbd1f37624f044e58f05e9951a13e0b1e8df4574952b38a25e31`.
- Nine exact frame comparisons across the three new scenes: mean RGB absolute
  error ranges from 0.24 to 0.69 on the 0–255 scale against the native PNGs.
  These include the CRM palette, field settings and Color Bars, Scenario menus,
  variables and execution, and Nest notifications and Intercom.
- Final encoded scene and handoff contact sheets were inspected after the last render.
- Delivery: 246.1 seconds, 1920 × 1080, 60 fps, silent H.264, yuv420p, Rec.709.

The exact results are recorded in the release metadata, `encoded-checks.json`
and `native-encoded-comparison.json`. Publication is gated on these checks.

## Recovery

Revision 07 and `before-phase4` were verified before editing and again before
publishing. Revision 08 has a separate source ZIP, preview, metadata, review
sheets and SHA-256 restore manifest. The ZIP is integrity checked and every
packaged source file is compared with the working source.

## Scope and limits

This review covers the deterministic film, its encoded preview and the reused
visual behavior. It does not test live CRM writes, scenario backend execution,
real calls, real-time delivery or microphone/audio services. All examples are
fictional, all such operations are simulated, and the preview is intentionally
silent. No 4K export or Scene 11 is included. Creative approval remains with Keagan.
