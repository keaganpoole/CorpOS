# Revision 35 — Centered hero phrases

Preview: http://localhost:3100/Nodemere-Film

## Changes
Long hero phrases now replace one another at one fixed center instead of accumulating from left to right. Existing small labels retain their exact shared styling, position, and animation.

Booking is 2.6 times the previous main-text size on white, with a short scale expansion, a restrained 1.8% overshoot, and a firm settle. Fully and Autonomous remain smaller lead-ins. The original scene transition and readable hold remain.

Other heroes use selected scale changes, controlled compression before a phrase cut, and slight tracking tightening. There is no horizontal translation. Collection ends with larger AI receptionists; Drop-ins emphasizes yours; Always-on emphasizes the gradient 24/7; the closing hero emphasizes gradient future. The Intercom words replace at center, with a restrained 3.5% expansion on receptionist.

CRM now reads One. → Stunning. → CRM. at center. The existing Stunning prism implementation is unchanged; its clock starts during its own phrase so the effect can finish before CRM replaces it.

Every feature statement after Psych is completely stationary and switches directly to the next title. No word build, slide, fade, scale, or tracking animation is applied there. Existing speed ramp and feature grid are unchanged.

## Verification
- ESLint and TypeScript pass.
- 54 representative still frames inspected, covering phrase boundaries, scale arrival/settle, gradient and prism effects, feature holds, and the Scenarios seam.
- Studio review includes Collection replacements, enlarged Booking, and post-Psych feature titles.
- Browser geometry confirms all three Collection phrases have the same center to within 0.001 preview pixels.
- Feature hold frames are pixel-identical within the same title.
- The feature grid and Emma preview match revision 34 pixel-for-pixel at checked frames. Sampled Drop-ins and Scenarios eyebrow regions match exactly.
- Only HeroTypography.tsx, HomepageHeadlines.tsx, NetworkScene.tsx, and the hero content in PeopleScene.tsx changed. Shared Hero/eyebrow source, scene schedules, native UI, assets, production app, and camera choreography are unchanged.
- Every composition duration is unchanged. Full film: 16,758 frames, 279.3 seconds, 60fps.
- No video export. This is editor/still verification, not a new encoded-video playback test.

## Recovery
The actual working source was archived and verified before editing at ../before-centered-heroes35-20261017/source.zip, with its manifest and matching Studio screenshot. Revision 34 is also preserved. Extract a restore copy into a fresh sibling folder; do not overwrite current source with an old archive.
