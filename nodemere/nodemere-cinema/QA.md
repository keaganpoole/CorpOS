# Directed V4 — review record

## Current preview update

The connected-showcase revision is 16.7 seconds. It removes the title checkmark,
transitions directly after a single incoming-call sweep, and keeps the collection
blurred and dimmed behind the foreground conversation rows. Only a 1080p preview
was rendered for this update; no new 4K export was authorized.

The measurements and three-pass review below describe the prior 18-second
export, not the current preview. Its historical delivery files are preserved.

## Prior export — pass 1: source and composition

- Matched the actual Nest incoming-call gradient, sweep duration, reveal easing and upward reel timing.
- Replaced the old opening and full-viewport conversation layout with the approved centered showcase.
- Confirmed the actual Mason / Chloe / Maggie / Brian asset mapping and order.
- Removed the blurred side extensions, extra interface decorations, business mottos and oversized dialogue panels.
- Checked 18 representative initial Remotion stills. Moved the conversation column right to clear Maggie's face and corrected the shared label position.
- ESLint and TypeScript passed after implementation.

## Pass 2: encoded timing and coverage

- Reviewed the complete 18-second timeline in contact sheets, plus dense samples of the reel, title-to-catalog handoff, camera pullback, row cascade and overlapping dialogue.
- Extracted 12 frames per second from both the 1080p render and 4K render for temporal review.
- Decoded all 1,080 frames in each render for automated pixel checks.
- No unexpected globally black frames after the intentional opening reveal.
- No blank receptionist video regions during the settled showcase.
- No catalog corner coverage failures during the full-screen pullback.
- Text stays within its row; all four label insets/baselines and conversation columns align.

## Pass 3: native resolution and deterministic seeking

- Inspected the 4K showcase and original-pixel crops of labels and dialogue.
- Rendered frame 1,000 independently and compared it with frame 1,000 decoded from the 4K master.
- Mean absolute RGB difference: 0.560/255 across the frame; row differences 1.400, 1.151, 1.083 and 0.988/255. Differences are consistent with video compression; poses and dialogue timing match.
- The 4K renderer output has 1,080 frames at 60 fps, duration 18.000 s, H.264, no audio streams. Complete FFmpeg decoding with `-xerror` passed.
- Delivery conversion uses standard limited-range Rec.709, yuv420p and fast-start H.264. The matching preview is downsampled from that exact delivery master.

## Delivered files

- Final 4K master: 56,350,505 bytes. Final 1080p preview: 14,741,680 bytes.
- Both have exactly 1,080 frames, 18.000 s duration, 60 fps, one H.264 video stream and no audio. Both passed complete `-xerror` decoding and the Rec.709/yuv420p metadata assertions.
- Repeated the all-frame analysis on the delivered preview: no blank video regions or unexpected black frames.
- The conservative corner-darkness detector flagged six delivery-preview frames (398, 501–505). Inspected all six at full-frame and enlarged-corner views: these are dark details within the original catalog photos, not exposed mosaic boundaries. No layout change was needed.
- Inspected the delivered master at frame 1,000 after color conversion. Its mean RGB difference from the renderer output is 1.093/255; composition and performance timing are unchanged.

## Review limits

Visual motion review used rendered temporal frame sequences. Real-time browser
playback was not available and is not claimed. All footage remains limited by
the existing 720p/1080p, 24 fps sources; a 4K/60 fps composition does not create
new source detail or motion. The film covers the requested opening and
receptionist showcase only, leaving the final showcase available for a later
scene in the longer product film.

Detailed export specifications, sizes, hashes and full-decode results are in
`nodemere-v4-export-metadata.json` alongside the delivery files.

