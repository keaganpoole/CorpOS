# Revision 17 - Cinematic polish

## Requested changes
- Receptionist collection is dimmed to 18% brightness behind the conversation showcase, with a restrained pink/purple halo behind its outer frame.
- Collection starts at the existing Mason close-up and retains 2.05x zoom for three connected three-second passes. A cubic path carries velocity through the waypoints with a subtle hover. Third pass curves toward Chloe; pullback overlaps conversation entrances.
- Opening is seven seconds longer (23.7 seconds). Master scene offsets derive from the opening duration; later scene-local timings are preserved.
- Calendar appointment-dot cascade starts exactly one second earlier; native per-day and per-dot staggering is unchanged.
- Calendar Drop-ins Builder demonstrates Confirm / confirm booking using the actual pending-appointment template. The objective confirms salon visit details. Follow-through targets Olivia's pending Hair Styling appointment, including cursor placement and border sweep.
- Customer-network lines use the actual brand pink/purple gradient with a fine 2.4px core and restrained soft glow; existing draw timing remains.
- CRM close-up reaches 5.7x and follows the same pointer position that crosses Name, Phone, and Membership Status. Cursor crossing times align with the draft selection.
- Six-node Scenarios workflow remains logically unchanged. After the build, the camera tilts the canvas and passes along Appointment Completed, Create Invoice, and Router, then pulls up to an aerial view.

## Review
- ESLint and TypeScript passed.
- First pass: 34 representative PNG frames plus Remotion Studio inspection.
- Second pass: revised PNGs after refining cursor placement, CRM timing, network brightness, and the collection's third path.
- 1,501 sampled camera frames were finite; the three close passes maintain constant zoom. Velocity continuity checked at all collection waypoints and at pullback completion.
- Final opening frame and first Audition bridge frame match pixel for pixel.
- Final frame is solid black. Final logo source and exact 150-frame hold remain unchanged.
- Unrelated scene sources (Audition, Handoff, Nest, Encryption, final logo) and master integration were byte-compared against revision 16 and are unchanged.
- Review uses Studio and PNG stills. No video export was made.

## Delivery
Composition: Nodemere-Film. 17212 frames at 60 fps, 286.8667 seconds, 3840 x 2160 canvas.
Previous release: 16-approved-copy; verified duplicate: before-cinematic-polish17.
Restore the source archive to a fresh sibling folder, run npm ci, then open Remotion Studio. Do not overlay an older revision on the working project.
