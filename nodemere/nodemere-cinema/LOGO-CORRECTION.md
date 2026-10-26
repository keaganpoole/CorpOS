# Revision 14 — native splash logo and Full perimeter

The final scene now uses the actual `LOGO_PATHS` shared by SplashLogo and the
Logo in Motion demo, with SplashLogo's native strokeWidth of 16 in its 520-unit
viewBox. The previous downloadable SVG is no longer displayed in Scene 12.
No logo geometry was redesigned; the centerline footprint remains centered.

The selected preset is **Full perimeter (`fullperimeter`)**, exactly as provided
by the native `presetDisplacement` function. Sampling, two-decimal coordinate
precision, segment anchors, layer weights, layer order, original gradient stops,
bloom and the stable white reference stroke follow the original demo code.
Only the clock is frame-based. The original 1.25x travel clock and independent
oscillation clock are retained. Stroke width follows the user's requested splash
logo rather than the thinner stroke used by the standalone demo page.

Verification: `scripts/verify-native-perimeter.cjs` executes the original draw
function from the historical demo and compares each generated SVG path with the
film. **1,524 exact path comparisons passed** across pre-roll, animation and tail.
ESLint and TypeScript passed. Studio playback and nine still frames were reviewed.
Hold endpoints and settled pre-fade frames match pixel-for-pixel; tail frames are
pure black. Only FinalLogoScene.tsx and finaleTiming.ts changed among scene sources.
Scenes 1–11 and the production application remain unchanged.

Timing at 60 fps: initial black 0–11, fade-in 12–143, still hold 144–293 (150 frames),
native perimeter pass 294–495 (202 frames), fade-out 496–549, black tail 550–585.
The original Full perimeter duration is 4.2 / 1.25 = 3.36 seconds, rounded up to
202 frames so it completes. The film is now 16,792 frames / 279.866667 seconds.
Scene 12 still starts at global frame 16206 (4:30.10).

Review in http://localhost:3100/Nodemere-Film. No video exported.
Revision 13 and `before-splash-perimeter` remain recoverable. Restore this complete
source ZIP into a fresh sibling directory, run npm ci, then npm run dev.
