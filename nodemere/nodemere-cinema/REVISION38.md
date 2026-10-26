# Revision 38 — Chloe reveal replacement

Preview: http://localhost:3100/03-Audition

## Change

Replaced only the receptionist reveal video with the newly supplied Chloe clip.
The new source is 4096×2160, 60 fps, and 155 frames (2.583 seconds). Audition
duration and the existing interface entrance are derived from those 155 frames,
so the calendar-style overlap remains continuous with no empty hold after the
clip. The reveal stays fixed at its native scale and position. At the Audition
entrance, the clip ends as the interface starts rising from the lower edge, so
Chloe does not shift, rotate, grow, or peek around the moving panel. The panel
continues upward over black and settles on its existing timing. The reveal
remains muted and keeps the existing flicker.

## Review

- Remotion Studio review is focused on the Audition reveal.
- Preview stills cover the reveal, the panel entering over black, and the
  completed UI handoff.
- No video was exported.

## Recovery

The complete pre-edit source package, prior reveal clip, preview still, and
hashes are preserved at `../before-chloe-reveal2-20261017` in the delivery
versions folder.
