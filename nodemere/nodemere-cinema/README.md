# Nodemere cinematic film — scenes 1–10

## Current release: revision 08 — People, Scenarios and Nest

The master is **`Nodemere-Film`**: 246.1 seconds, 60 fps, silent, with a
3840 × 2160 composition target. Export **1080p previews only** until Keagan
explicitly authorizes 4K. New compositions: `08-People`, `09-Scenarios`, `10-Nest`.
Scenes 1–7 remain preserved from revision 07, including the Calendar page's
Drop-ins modal.

See [PHASE4.md](PHASE4.md) for choreography and source mapping,
[QA-PHASE4.md](QA-PHASE4.md) for review evidence, and [VERSIONS.md](VERSIONS.md)
for rollback. Previous phase documents retain historical detail.

```powershell
npm ci
npm run dev
npm run lint
npm run render:film-preview
```

Studio: `http://localhost:3100/Nodemere-Film`.

The sections below document the original directed V4 opening. Later revisions
and their changes are described in `VERSIONS.md` and each phase document.

## Preserved opening — directed V4

Scenes 1 and 2, revised from the October 14 creative discussion. 16.7 seconds,
3840 × 2160, 60 fps, silent. Its independent composition is `Nodemere-Opening`.

## Run and render

```powershell
npm ci
npm run dev
npm run lint
npm run render:preview
```

Studio runs at `http://localhost:3100/Nodemere-Opening`.
Only render or export 4K when Keagan explicitly requests it. The current
connected-showcase update is a 1080p preview only. Previous 4K exports and
source archives represent the earlier revision.

`npm run render:preview` creates a quick independent 1080p review render.
The legacy V4 finalizer (use only after explicit 4K authorization) creates the delivery master and a matching 1080p preview under
`out/directed-v4-delivery/`, or the directory supplied with `--destination`.
It converts the renderer's color matrix and range to standard limited-range
Rec.709, writes fast-start H.264 files, checks metadata, fully decodes both
exports, and records SHA-256 hashes. FFmpeg and FFprobe must be on PATH.

## Choreography

| Time | Action |
| --- | --- |
| 0–1.8 s | Enlarged incoming-call type enters upward on black with one pass of the Nest color sweep. |
| 1.8–2.52 s | Immediately at sweep completion, the line reels up into “Choose your receptionist.” No checkmark. |
| 2.52–4.18 s | Centered title on black. |
| 4.18–4.78 s | Title and catalog share a connected upward handoff. |
| 4.78–8.82 s | Connected pullback impulses reveal the collection. |
| 8.84–9.81 s | Four rows cascade upward while the same collection blurs and dims behind them. |
| 9.9–12.43 s | Questions and replies cascade with overlapping entrances. |
| 12.43–16.7 s | Live full-row performances hover over the retained, blurred and dimmed collection. |

## Layout and media

- The logical stage is 1920 × 1080, rendered at 2× for 4K.
- The showcase is 1008 px wide, centered with 456 px side margins and 42 px top/bottom margins.
- Four touching rows are 249 px high. Each is filled entirely by its original video crop.
- Names use Inter Semibold at 24 px; “Receptionist for [business]” and dialogue use 14.5 px Inter.
- Left labels share an inset and baseline. Conversations share a right column with content-sized, lightly rounded dark/light backgrounds.
- A restrained local dark gradient protects labels on bright footage. The collection backdrop blurs by 10 logical pixels and dims to 46% brightness. The foreground footage remains sharp, without blurred extensions, text shadows, illuminated lines or extra controls.
- Portraits, clips, Inter fonts, brand pink `#ff32ac`, purple `#8B5CF6` and the Nest's reveal timing/color stops come from Nodemere's existing assets/source.
- Business names and exchanges are fictional demonstration copy.

All animation is driven by the Remotion frame. Four local video sequences are
premounted; they use the actual source cadence without interpolation or loops.
The source videos are 720p/1080p, so the footage remains limited by that source
detail inside the 4K composition. Maggie's original close-up requires a tighter
crop than the other performances to fill the same wide row.

## Source

- `src/RevisionFour.tsx`: opening, camera path, row layout and dialogue timing.
- `src/Root.tsx`: active composition and preserved earlier scene compositions.
- `src/design.tsx`: local fonts, timing helpers and logical stage.
- `src/field.json`: catalog layout, shared by the mosaic and high-resolution close-view overlays.
- `scripts/prepare-directed-v4.py`: regenerates the mosaic and individual source-video crops. Requires Python and Pillow, plus FFmpeg on PATH.
- `scripts/finalize-directed-v4.py`: production delivery and full decoding checks.
- `scripts/review-directed-v4.py`: encoded temporal contact sheets and all-frame blank-region checks. Requires Pillow and NumPy.
- `scripts/package-directed-v4.py`: packages and verifies editable source, fonts, prepared media and original footage.

Prepared assets are included; no preprocessing or network access is needed to
render after dependencies are installed. Original clips are retained for crop
adjustments. Earlier source and documentation are archived under
`recovery/pre-directed-v4/` in the working project. Earlier exports are retained.

See `QA.md` for review evidence and its limits.

