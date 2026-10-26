# Revision 06 quality review

Reviewed 2026-10-15. Scenes 1–7, 119.6 seconds, 7,176 frames at 60 fps.
Delivery is 1920 × 1080, silent H.264 High / yuv420p / Rec.709. No 4K video exported.

## Pass 1 — source, scope and product fidelity

- ESLint and TypeScript checks pass (`npm run lint`).
- Opening and Audition source files match revision 05 byte for byte.
- Existing Calendar camera motion and default records remain unchanged. Its hero
  icon is removed; its surface and border are exported for reuse with an optional
  record slot. FullFilm and Root integrate the three new scene modules.
- Native Drop-ins CSS copies match the product. Template data comes from the
  product backend. The adapter uses deterministic fictional state and no external
  actions. Capability evidence and copy decisions are recorded in PHASE3.md.
- Fourteen network customer leaves and six feature beats are present. Visible-node
  bounds pass at every frame before the deliberate endpoint close-up. Sampling
  each curve at 201 positions found no unintended path crossings or paths entering
  unrelated customer circles.

## Pass 2 — native frames and Studio

- Inspected representative frames throughout all three new scenes and all three
  scene boundaries. Reviewed full-resolution builder controls, network portraits
  and indicators, and the final customer/staff connection.
- Studio loaded the master and standalone scenes without an error overlay.
  Playback advanced through the sequence and looped; Studio framing and pointer
  placement were checked against rendered frames.
- Corrected the builder Purpose cursor position, early network portrait framing,
  a branch that passed behind an unrelated portrait, and the direct handoff line's
  SVG gradient coordinates.
- Corrected the builder's initial pending-action preview so existing actions are
  visible before the Google Review action is added.
- Native boundary comparisons: Calendar/Builder and Network/Handoff have zero
  pixel difference at their joins. Builder/Network differs by 0.258 mean RGB levels
  out of 255, consistent with continuing video and subpixel motion.

## Pass 3 — assembled encoded preview

- Full ffmpeg decode with error termination passed.
- All 7,176 frames decoded in the separate frame-analysis pass.
- No unexpected black frames and no blank Piper region during the network.
- Inspected temporal contact sheets sampled at 12 fps, with closer sequences for
  line → portrait → indicator timing and the three scene boundaries.
- Inspected encoded 1080p frames for builder text/cursor placement, language and
  follow-up indicators, network spacing, and the final direct handoff connection.
- The corrected builder and network sections are included in the assembled film.

## Review limits and delivery

The review combines source checks, native frames, encoded temporal samples and
Studio playback checks. It is not a claim that every individual frame received
manual visual inspection. The film remains silent as requested.

The brief's 75+ language count conflicts with the homepage's 30+ claim and was not
verified in runtime behavior. The delivered headline is therefore “Speak your
customers’ language.” The animation does not assert a numeric count or mid-call
language switching.

Source, review evidence and preview are packaged in revision 06. Publishing verifies
the source archive and prior release hashes before refreshing the latest files.
Prior release folders remain immutable. See VERSIONS.md for restoration instructions.
