# Revision 07 review

2026-10-15. Targeted correction of Scene 5 to CalendarMonthView's DropInsModal.

## Source and scope

- ESLint and TypeScript pass.
- The only modified pre-existing scene source is `src/DropInsScene.tsx`.
  All other previous `src/` files match the revision 06 source archive byte for byte.
- Three native modal CSS copies match the current product files byte for byte.
  Their generated desktop stylesheet is scoped to `.calendar-dropins-film`.
- No production application files or state were changed.
- Scene 5 remains 1,320 frames. The full timeline remains 7,176 frames / 119.6 seconds.

## Visual and motion checks

- Reviewed native frames covering the entrance, gallery filter, template selection,
  editor, live call preview, save, completed appointment payoff and outgoing bridge.
- Measured cursor targets in Studio against the real rendered controls; corrected
  the category, Purpose and Save drop-in positions. The cursor stays at Purpose
  until its text entry completes before moving into the objective field.
- Adjusted the editor camera so its live appointment preview remains fully visible.
- Verified the native Completed default, three-column template gallery, two-column
  editor, and Your drop-ins state after saving.
- Studio playback advanced through the revised section; no current error overlay.
- Calendar/Scene 5 native boundary difference is zero. The Scene 5/network boundary
  has 0.210 mean RGB levels of difference out of 255, with continued Piper footage.
- Reviewed encoded temporal samples at 12 fps for Scene 5 and both adjoining bridges.

## Encoded checks

- Full ffmpeg decode with error termination passed.
- Independent analysis decoded all 7,176 frames.
- No unexpected black frames or blank Piper regions in the network.
- 1920 × 1080, 60 fps, silent H.264 High / yuv420p / Rec.709.
- Scenes outside Scene 5 use the previous release's rendered sections in assembly.
  The assembled file is re-encoded; this is not a claim of bit-identical encoded frames.

The review uses representative native frames, Studio playback checks, encoded temporal
samples and full decoding. It does not claim manual inspection of every frame.

Revision 06 and the before-calendar-modal snapshot remain intact for rollback.
Publishing verifies their hashes, the new source archive, and the delivered video hash.
No 4K video was exported.
