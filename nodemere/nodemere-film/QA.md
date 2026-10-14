# Opening review checks

- Scope: scenes 1 and 2, 25 seconds. Production Nodemere files and root dependencies unchanged; existing user edits left intact.
- TypeScript and Remotion ESLint pass.
- Review MP4: H.264, 1920×1080, 60/1 fps, exactly 1,500 frames and 25.000 seconds. No audio stream. Full FFmpeg decode succeeds.
- Inspected rendered frames at 1, 2, 3, 4.5, 7.5, 9, 9.75, 11, 12.5, 17, 20, and 24 seconds. Inspected the full encoded trajectory at 2 fps, plus the transition at 6 fps.
- Corrected initial transcript crop, incorrect downloaded font weight, detail-card frame overflow, and the source video's fitting mode during review.
- Compared independent arbitrary-frame renders with one and three workers. Frames 450 and 1440 are pixel-identical. Frame 750 differs by a mean 0.0091/255 per red channel (0.0078 green, 0.0076 blue), confined to portrait raster sampling; composition geometry, text, and timing agree.
- Examined actual review frames downscaled to 390px (phone) and 768px (tablet). Punchline and collection headline remain legible. Full modal fine print is secondary; the final close-up brings name and details forward.
- Studio registers the master plus both independent scenes, loads without a current error, and supports seeking. An earlier hot-reload font 404 was cleared by reloading after asset preparation.
- Original Kayla portrait source: 1280×720, 24 fps, 10.005 seconds. Muted in composition; audio omitted at encoding. Public catalog contains ten stock records and provides no public MBTI value for the featured receptionist.

The 4K master is rendered from the same DOM/SVG composition, rather than upscaled from the review MP4. This is a preliminary opening for creative review, not approval of the remainder of the production.

4K delivery verified: H.264, 3840×2160, 60/1 fps, 1,500 frames, 25.000 seconds, 71,064,206 bytes, no audio stream. Full FFmpeg decode completed without errors. Inspected a native-resolution transcript crop from the encoded master.
