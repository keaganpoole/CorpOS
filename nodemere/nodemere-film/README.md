# Nodemere — opening film

Scenes 1 and 2 only. A silent 25-second, 60 fps Remotion composition, authored at 3840×2160.

## Preview

Run `npm ci`, then `npm run dev` from this folder. Studio opens at http://localhost:3000/Nodemere-Opening. The normal Nodemere app remains on port 5173.

The master and both individual scenes are registered in Studio. Edit scene choreography in `src/scenes/`, shared camera helpers in `src/motion.tsx`, and scene placement in `src/Opening.tsx`. Match the standalone duration in `src/Root.tsx` when changing a scene length.

## Export

- `npm run render:preview` — 1920×1080, 60 fps, silent H.264 review MP4.
- `npm run render:4k` — 3840×2160, 60 fps, silent H.264 master.
- `npm run lint` — ESLint and TypeScript.

Outputs are in `out/`, excluded from Git.

## Authentic UI, isolated playback

`src/product/` contains source-derived snapshots of the real product CSS, gallery geometry, embedded detail-card markup, and waveform equations. `scripts/prepare-assets.mjs` freezes the public stock catalog and its original media. It uses the parent application's public Supabase configuration only during preparation; credentials are never copied into the video project. `scripts/prepare-adapters.mjs` extracts the card and waveform from product source and caches the product's Inter font weights. Render and playback use only local fixtures and media. No live service, microphone, call, hiring, or payment handlers are present.

Only the outer cinematic containers and camera transforms change the presentation. Product internal styles and assets remain intact. See `PRODUCTION.md` for source locations and choreography.

## Review notes

- Collection headline is provisional: “Choose your receptionist.”
- The public collection snapshot has ten stock receptionists. The original masonry algorithm repeats that roster; no larger unique count is claimed.
- Kayla's supplied video is 1280×720 at 24 fps. The film is 60 fps; the original portrait cadence and source detail are preserved. No invented frames or sharpening.
- The public catalog returns no personality classification for Kayla, including its public personality lookup. Her actual description, age, and core traits are shown; an MBTI type is not invented.
- The final camera push prioritizes her name and details. Fine modal text is still a secondary element on phone-sized playback.
- Stop here for review. Audition and subsequent scenes are intentionally not implemented.
