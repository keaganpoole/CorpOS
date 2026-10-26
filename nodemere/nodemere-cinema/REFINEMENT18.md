# Revision 18 — light and motion refinement

Studio: http://localhost:3100/Nodemere-Film
17002 frames, 60 fps, 3840 x 2160 composition. No video exported.

Seven requested adjustments are complete. Only the promo source changed.
The three close collection passes are preserved. The pullback accelerates until its final quarter-second settling into the conversation overlay.
The modal halo is neutral white at 3.5% alpha. Prior branches stay dim; only the newest route is illuminated. Unstarted paths are fully hidden so rounded stroke caps cannot show as stars.
The handoff's final line completes dark at 9.15 seconds, stays dark until 9.45, then illuminates left-to-right by 10.2.
Portrait masks no longer repeat; a narrow boundary fade covers fractional image leakage at the right and bottom.
Encryption keeps its original stacked-layer motion until a 0.4-second handoff at 6.8–7.2 seconds. The old exposed-base idle is removed. The scene now lasts 12.5 seconds; the final logo animation and its 150-frame still hold are unchanged.

## Security wording

AES-256. The encryption standard used to protect U.S. classified information.

This is a comparison of the algorithm, not a claim that Nodemere is government-approved, NSA-certified, or a FIPS-validated system.
The native homepage describes the same standard; backend/envelope.py uses AESGCM and 32-byte keys. No deployment state or comprehensive encryption coverage is asserted.
Primary source: https://www.nsa.gov/Resources/Commercial-Solutions-for-Classified-Program/faq/
NSA's program requires approved implementations and layered solutions beyond selecting AES-256.

## Review

ESLint and TypeScript passed. 52 PNG frames sampled across all changed scenes and the full-film handoffs, plus Studio inspection.
Camera sampling checked 1501 frames and continuous velocity at the new joins. The last opening frame matches the Audition bridge pixel-for-pixel. Logo still-hold boundary frames match. Encryption blackout, logo pause and final film frame are pure black.
Live Studio playback was sampled; browser playback performance can vary. No MP4 was exported.

## Restore

Extract nodemere-scenes-1-12-source.zip into a fresh sibling folder, run npm ci, then npm run dev on an available port. Do not overlay the current project.
Revision 17 and the separate before-refinement18 copy remain intact.
