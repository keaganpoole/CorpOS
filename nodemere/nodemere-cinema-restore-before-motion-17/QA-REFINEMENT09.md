# Revision09 verification record

## Confirmed before encoding

- ESLint and TypeScript checks pass.
- Only `src/ScenariosScene.tsx` and `src/NestScene.tsx` differ among existing scene sources in the approved revision08 archive. Added files are isolated film adaptations and extracted variable metadata.
- All 17 referenced native product source hashes match their recorded values. Production source files were not edited.
- Variables metadata retains 8 table categories and 122 native field definitions, with the original table ordering, labels, icons and colors.
- Studio and full-size PNG review confirm the left-connected pane, invoice-field cursor alignment, 14 nodes and 13 branching connections, and two active Teams videos plus one inactive receptionist.
- The dashboard zoom keeps the Nest moving toward the center and begins its incoming-call animation during the zoom. Close-up raster density was increased to preserve text sharpness.
- The first 9006 decoded frames of the copied prefix match revision08 exactly: `ad4d62f53c511db4284916aa690362b358f62d6f59013de740a620d3eb8c6566`.
- Previous release and pre-edit restore packages were verified before editing.

## Encoded release checks

- All 15,246 frames decode successfully; no unexpected black frames remain.
- Twelve native-to-encoded comparisons pass. Maximum mean absolute RGB error is 0.816 out of 255.
- Temporal contact sheets at 12 fps cover the intro fly-in, connected Variables pane, field insertion, rapid branching, Teams-to-Nest zoom, notification sweeps and Intercom transitions.
- Final review corrected a three-frame dark interval in the initial circle reveal, retained visible content through the menu handoff, and widened the framing for the longest milestone detail.
- Native and encoded Teams footage confirm motion in Maggie and Kayla. The inactive Piper portrait is unchanged in native PNG comparisons; encoded variations are compression noise.
- Preview properties: one video stream, 1920 x 1080, 60 fps, H.264, yuv420p, Rec.709, 254.1 seconds. No audio and no 4K export.
- The assembled preview's first 9006 decoded frames match revision08 exactly.

## Publication gates

The publication script requires the passing decoded-frame and source checks, verifies the source ZIP against the current source bytes, checks every previous-release manifest hash, and checks the new preview hash before updating the current release pointer. Each delivered file receives a SHA-256 entry in the new restore manifest.
