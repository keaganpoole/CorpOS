# Revision 25 — Nest reveal and film refinements

Studio: http://localhost:3100/Nodemere-Film

18,081 frames at 60 fps; 301.35 seconds. Studio and PNG review only; no new encoded video.

## Changes

- Animated pink/purple call borders in the Drop-ins preview and its Calendar return, using the existing native animation.
- One gradient-only Future text layer, removing the white duplicate beneath it.
- Handoff explains why a caller is connected, how the team is briefed, and why the caller can continue without starting over. Caption sizing and spacing reviewed.
- Scenarios uses native node descriptions with Stripe omitted. Descriptions wrap beneath titles without changing node geometry.
- Condition labels sit centered immediately above their branches, parallel to each curve at its midpoint.
- Nest conversations show the receptionist source videos in the portrait and softened background. Video frames remain continuous into Encryption.
- Nest replaces Everything in Real Time: initial NEST hold, measured expansion to Nodemere Events & Signal Terminal, reading hold, and return to NEST before the dashboard. Adds 6.5 seconds.

## Verification

ESLint and TypeScript passed. Representative 1920×1080 stills and Studio playback reviewed for sizing, placement, timing and transitions. Computed styles confirm the call border advances in both previously static appearances. Separate portrait crops confirm movement for Maggie, Piper and Kayla. The final Nest frame and first Encryption bridge frame are pixel-identical; the last film frame is black. The Scenarios camera source remains byte-identical to revision 24 (the revision 21 rollback). This is sampled visual and playback verification, not an encoded-video or comprehensive performance benchmark.

## Recovery

The pre-edit prepared source and matching preview are retained in `../before-refinement25`. This folder contains the complete prepared source archive and final review previews. Restore into a fresh sibling folder, run `npm ci`, then `npm run dev`; preserve the current checkout.
