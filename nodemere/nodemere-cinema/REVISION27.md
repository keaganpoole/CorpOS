# Revision 27 - Hero typography and continuous motion

Restores the established Inter hero styling: regular 400 weight, 99px logical size, 1.12 line height, tight -.055em tracking and sentence case. The End, Psych and all 17 feature statements share this styling. Card typography remains independent and the settled grid is pixel-identical to revision 26.

Psych follows a continuous Hermite path through its rise, impact and settling. The End takes on its upward velocity and exits with a restrained rotation. Feature sweeps overlap, with subtle scale changes and a smoothly accelerating rhythm after the first four. The grid camera now starts its pullback smoothly, with a short blend and spatially ordered tile arrivals.

Verification: ESLint and TypeScript passed. Computed Studio styles checked for The End and Psych. Twenty sampled frames reviewed across impact, feature transitions, grid assembly and Handoff. Studio playback sampled at about 60fps. The grid-to-Handoff frame comparison passed. Only NetworkScene.tsx changed among existing scene source files. Film remains 17224 frames. No video export.

Recovery: ../before-hero-motion27 retains the verified prior source package and previews. Restore into a fresh sibling folder.
