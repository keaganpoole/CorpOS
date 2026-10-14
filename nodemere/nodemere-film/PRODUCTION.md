# Nodemere opening — scenes 1 and 2

Scope: silent Nest cold open, spatial transition, Receptionist Collection reveal, selection, and original receptionist detail modal. No later scenes.

## Source audit and isolation

- Brand variables and system UI font: `../src/index.css` (`#ff32ac` → `#8B5CF6`). Collection uses Inter.
- Nest shell and states: `../src/sonar/nest/NestDock.jsx`, `NestStage.jsx`, `NestIntercom.jsx`, `nest.css`.
- Waveform: `IntercomVoiceLine.jsx`. Preserve its four layered sine functions, Gaussian envelope, phase offsets, pinned ends, stroke styles, and attack/release spring; sample with fixed timesteps for arbitrary-frame rendering.
- Call loader: `../src/sonar/components/CirclePreloader.jsx`. Same geometry and spring, driven by frame time.
- Collection: `../src/sonar/studio/ReceptionistGallery.jsx`, `catalogGeometry.js`, `receptionistGallery.css`.
- Detail modal: embedded branch of `../src/sonar/pages/HireReceptionistModal.jsx`, styled by `studio.css` and `receptionistGallery.css`.
- Public catalog records and original media are frozen locally. No private records or application credentials enter the bundle. The public homepage includes catalog records regardless of their `is_active` field; this snapshot follows that existing behavior.
- Later production locations identified only: `studio/ReceptionistEntry.jsx`, `studio/useAudition.js`, `pages/CalendarPage.jsx`, `components/DropInsModal.jsx`, `pages/HomepagePeopleCrmDemo.jsx`, `pages/Scenarios/Scenarios.jsx`, `pages/Scenarios/VariablesPane.jsx`, `utils/crypto.js`.

The production app and its dependencies are unchanged. Port 5173 serves the existing checkout; Remotion Studio is a separate tool on port 3000.

Video-only adapters retain source markup/styles and replace live service state, RAF clocks, and event handlers with deterministic fixtures. DOM and SVG render directly at the master resolution, without enlarged screenshots. Media remains unmodified. Camera transforms affect the entire UI presentation.

## Proposed timing

- 0–1.2s: NEST wordmark, original letter separation.
- 1.2–2.4s: select Kayla using the original picker.
- 2.4–3.4s: calling state, portrait and original circle waveform.
- 3.4–5.5s: caller transcript: “Hey Kayla. What are you up to?”
- 5.5–8.7s: receptionist transcript: “Oh, not much. Just chillin’ at the front desk.” Camera lands on the punchline.
- 8.7–11.2s: spatial move from the intimate conversation to Kayla’s portrait and the masonry world; rapid pullback.
- 11.2–14.4s: collection settles and “Choose your receptionist.” lands.
- 14.4–18.2s: lateral travel, then focus/select Kayla.
- 18.2–25s: original detail layout with silent portrait video; calm final hold for review.

Master: 3840×2160, 60 fps, 25 seconds, no audio. Review encode: 1920×1080 at 60 fps. Separate Studio compositions expose each scene.

## Review checkpoint

Review rendered keyframes, arbitrary-frame repeatability, full motion, and scaled desktop/tablet/phone readability. Render the preliminary opening, then stop for Keagan’s feedback. The headline remains provisional. Source portrait detail is bounded by the original media resolution; extreme magnification targets DOM transcript text rather than faces.
