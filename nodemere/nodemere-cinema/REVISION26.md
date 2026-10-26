# Revision 26 — Kinetic features and reference grid

Replaces the conversation tree after the Future headline with The End / Psych, all 17 selected feature titles, and the reference grid. The first four titles each receive 1.18 seconds. A smooth exponential duration curve reduces successive beats to approximately 0.095 seconds. Psych rises and launches The End upward, with recoil and settling. Titles land with scale compression and sweep left. The final title anchors the camera pullback as the tiles assemble, with staggered arrivals and a restrained border highlight. Grid holds for over seven seconds after settling.

The grid follows grid1.jpg: 5 / 5 / 5 / 2 centered cards, condensed italic titles, small descriptions, dark contour texture, and no header or footer. Uses locally bundled Barlow Condensed with its OFL license.

Verification: ESLint and TypeScript passed. All 17 titles fit in Studio; descriptions have positive clearance. Sampled 1080p stills reviewed at the impact, feature beats, grid pullback, settled grid, and outgoing transition. Studio playback sampled at approximately 60fps. Grid final frame is pixel-identical to the incoming Handoff bridge. Only NetworkScene.tsx and its timeline label in FullFilm.tsx changed among existing source files. This is sampled playback and visual QA, not a full encoded-film performance benchmark.

Film: 17224 frames at 60fps. No video export. Studio: http://localhost:3100/Nodemere-Film

Recovery: ../before-feature-finale26 contains the verified pre-edit prepared source and prior preview stills. Restore into a fresh sibling directory, preserving the current checkout.
