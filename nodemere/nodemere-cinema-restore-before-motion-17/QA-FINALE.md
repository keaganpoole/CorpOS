> Revision 13 historical notes. Revision 14 supersedes the logo implementation and timing; see LOGO-CORRECTION.md.

# Finale review â€” revision 13

## Review performed

- Reviewed the latest prior exported film as reference and the current prepared source.
- Inspected native security implementation, brand definitions, authentic logo and
  current/historical Logo in Motion implementation before building.
- Reviewed representative native composition PNGs and the integrated transition.
- Played the ending in Remotion Studio and examined the assembly and base signature.
- Ran ESLint and TypeScript, source/hash checks, pixel comparisons and black-frame checks.
- Captured independent repeats of an assembly frame and an active logo signature frame.

## Corrections made during review

- Replaced the first flat geometric prototype with real solid geometry and depth testing.
- Refined local lighting, beveled surfaces and the restrained brand-color inlay.
- Contracted ordered layer gaps to prevent plates crossing during assembly.
- Waited for text metrics as well as geometry before releasing initial still capture.
- Faded the signature underlay after its native motion settles so antialiased color
  does not disappear abruptly when the full-logo fade begins.
- Delayed the hero reveal until the outgoing Nest transition has cleared to black.

## Verified results

- 72 prior source files preserved byte-for-byte; only `FullFilm.tsx` and `Root.tsx`
  changed among existing source files, to append/register the new scenes.
- Ten native reference sources retain their recorded hashes. Logo SVG and preset
  file match their native originals exactly.
- Full film: 16,765 frames, 3840 Ã— 2160, 60 fps; new scenes have no audio.
- Logo hold: exactly 150 frames, local 144â€“293 inclusive. First/middle/last sampled
  hold frames are pixel-identical, as are global hold endpoints.
- Base motion fully settled before fade-out; final pre-fade logo matches the hold.
- Six sampled reset/tail frames contain only RGB zero, including global final frame.
- Outgoing Nest's last frame equals the first frame of its Scene 11 bridge.
- Independently repeated assembly and signature still captures match exactly.
- A 24-frame contact sheet covers the hero, assembly, reset, fade-in, hold,
  signature, fade-out and tail. Additional transition/boundary stills are retained.
- Studio loaded the full composition with no error overlay during review.

Machine-readable check results: `review/finale/verification.json`.
Visual evidence: `review/finale/contact-sheet.jpg` and `review/finale/stills/`.

## Scope and practical limits

This is a Studio delivery, not an encoded-video delivery. No new video file was
rendered, decoded or compression-reviewed, following Keagan's explicit instruction.
Previously exported MP4s remain older revisions. WebGL playback speed depends on
the editor host/GPU; frame positions and timing do not depend on playback speed.

Security evidence supports the implemented architecture for its documented scope;
it is not production deployment attestation or government/FIPS certification.
The film uses the narrower, verified AES-256-GCM/per-business protection statement.
