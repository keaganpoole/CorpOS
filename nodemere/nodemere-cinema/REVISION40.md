# Revision 40 — Audition right-to-left wipe

Preview: http://localhost:3100/03-Audition

## Change

The Audition interface now enters as a solid, full-frame layer moving from right to left in front of Chloe's reveal. Chloe's clip freezes as the wipe begins and remains underneath it, so the interface physically covers the image without scaling Chloe or exposing her around the panel. The interface settles into its prior framing and continues the existing scene. Scene duration and downstream choreography are unchanged.

## Review

Reviewed the opening, midpoint, and settled frames in Remotion Studio and rendered matching still previews. ESLint and TypeScript pass. No video was exported.

## Recovery

The pre-edit source and matching preview are preserved at `before-audition-wipe-20261017`. The source package in this release is based on Revision 38 with only `src/AuditionScene.tsx` updated.
