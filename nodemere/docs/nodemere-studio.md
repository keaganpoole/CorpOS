# Nodemere Studio

Implemented September 21, 2026. This extends the existing Team experience; it does not introduce a new application route or replace the receptionist catalog.

## Product and implementation audit

- **Application shell:** `src/sonar/SonarDashboard.jsx` owns local page selection and caches mounted views. Team now has `team`, `entry`, and `studio` content states. Studio replaces Team's content, so receptionist cards are not rendered beneath it.
- **Catalog:** `src/sonar/pages/HireReceptionistModal.jsx` retains its carousel, previews, filtering, and existing hire operation. The Hire path invokes it unchanged.
- **Existing Studio:** `src/pages/VoiceCloneExperience.jsx` contains consent, signature, recording, uploads, cloning, profile editing, and image saving. It now accepts an embedded session without changing the existing `/clone/:token` route. Switching to Design preserves the mounted clone session but stops its recording/playback.
- **Splash:** `src/components/SplashScreenAlternate.jsx` remains the introduction. The office variant reuses its Studio wordmark while the image moves toward the desk. The transition lasts 2.7 seconds; reduced motion skips the travel. Other splash consumers retain the original behavior.
- **Brand:** the implementation uses the existing Inter/system type stack, near-black backgrounds, white primary buttons, 12px control corners, neutral borders, letterspaced labels, Lucide icons, and existing brand variables. The supplied office image supplies the desk, architectural lighting, and restrained LED accent.
- **Scenarios Builder:** the Variables pane's actual interaction was extracted into `useInstrumentTilt`. The rest angle is X=0/Y=6 degrees; pointer movement uses the existing 3.6/2.8 degree factors and 0.1 frame interpolation. The panel uses 1600px perspective, center origin, and the original 0.2s ease-out entrance. Resting frames stop, and touch/reduced-motion contexts do not tilt.
- **Stack:** React 18, Vite 4, and existing Framer Motion. Studio-specific Three.js, procedural character, renderer, camera loop, and model assets have been removed. No other source imports Three.js; its package dependency was removed.

## Image environment refinement

`OfficeExperience` owns a persistent `OfficeEnvironment` and the entry/create/hire/studio states. The Dashboard keeps the same mounted shell as creation begins, so the supplied office stays continuous and the Team list remains unmounted. Hire completes a 1.6-second lateral move before opening the existing catalog.

The user-supplied September 21 image is 1817 × 866. Measured focal points are logo (50%, 23%), desk crown (50%, 53%), desk front (50%, 70%), and right lounge (85%, 52%). The desktop Create move scales from 1.015 to 1.34 around (50%, 62%), translating 6% right and 5% down to preserve the logo while bringing the desk forward. Cubic Bézier easing [0.22, 0.61, 0.36, 1] decelerates the travel. Hire translates left 10% with a 1.2 scale to reveal the right lounge. Guided stages change scale by only 0.004. No image is generated or reconstructed.

The original guided selector typography, options, selection logic, spacing, and chapters are retained. A wrapper adds the exact shared Variables-pane tilt to all five selectors. The control room retains its instrument panel and editable definition. Once prose is edited, it remains authoritative until the user explicitly rebuilds it from choices.

### Dynamic portrait layer

`PortraitPreview.jsx` is a reusable, asset-driven compositor. `studioPortraits.js` is the production manifest and intentionally contains no portraits until the approved option-specific set is available. Entries are keyed by characteristic and exact option label; each may provide `src`, `position`, and `scale` so eyes, nose, and mouth can be aligned across age or accent variants without changing component code.

The current stage's assets preload and decode before interaction. Hover and keyboard focus preview an option, pointer/focus leave restores the selected portrait, and selection persists as the user advances or revisits a stage. The previous portrait remains visible until the requested asset is decoded. Transitions use a 420ms crossfade with only a 1–2% scale/position change and a small resolving blur; reduced motion uses a short opacity change without travel. Layered masks dissolve the left, top, bottom, and far-right edges while the facial area stays sharp. On mobile, the portrait becomes a dedicated 310px visual header instead of a scaled-down desktop layer.

The supplied close-up face remains unchanged and is not a production asset. A copy exists only in `tests/assets` so the development fixture can exercise the real masking, preloading, preview, selection, and responsive code before the final art set is connected.

The final guided selector and Control Room instrument share a Framer Motion layout identity, so Enter Control Room reads as the same primary surface expanding into deeper controls. The Room is one centered two-column workspace with a 1050px maximum width, 60–88px large-screen gap, and 44px laptop gap. The instrument panel is 350–430px wide, uses the same neutral black treatment as the guided Studio, and retains the exact Variables-pane pointer behavior. The Voice Definition surface is 390–520px wide. On mobile the surfaces stack without horizontal overflow. A selected portrait may remain behind the workspace at 8.5% opacity, reduced saturation, and reduced brightness.

Auditions display the actual returned candidate count, decoded audio waveforms, exclusive playback, selection, regeneration, and save. Playback gently changes a dark overlay's opacity; the photographed LED is never animated. The unused character audio analyser is removed; the playback progress loop runs only while audio is playing.

Dirty state starts with a meaningful input or selection, not entering Studio or switching modes. Design and clone dirtiness are tracked separately. In-app navigation and browser Back use a focus-trapped discard dialog; reload/closing the tab use the browser's unsaved-work warning. Entering Studio writes no draft or contract. Begin voice cloning explicitly creates a consent session through the existing contract API.

## ElevenLabs mapping and limitations

Primary sources reviewed:

- [Design a voice API](https://elevenlabs.io/docs/api-reference/text-to-voice/design)
- [Save a designed voice API](https://elevenlabs.io/docs/api-reference/text-to-voice/create)
- [Voice Design guidance](https://elevenlabs.io/docs/eleven-creative/voices/voice-design)

| Studio control | Provider behavior |
| --- | --- |
| Gender, age, accent, tone, personality | Natural-language `voice_description`, not invented provider attributes |
| Editable definition | `voice_description`, 20–1000 characters |
| Audition script | `text`, 100–1000 characters, or `auto_generate_text` |
| Loudness | `loudness`, -1 to 1 |
| Guidance | `guidance_scale`, 0 to 100 |
| Advanced model | `eleven_ttv_v3` or `eleven_multilingual_ttv_v2` |
| Advanced seed | Optional integer 0–2147483647 |
| Enhance description | `should_enhance` |
| Quality | `quality`, -1 to 1; exposed only for v2 |
| Generate / regenerate | POST `/v1/text-to-voice/design`; another set is a new provider generation and consumes provider credits |
| Save selected audition | POST `/v1/text-to-voice` with its `generated_voice_id` |

The live API rejected `quality` on v3 even though its reference description was ambiguous. Both client and server now enforce the observed v2-only restriction. Candidate count is never hardcoded; the successful live request returned three candidates. Voice characteristics are descriptive guidance, not guarantees of a precise identity or accent. Reference audio/prompt strength exist for v3 but are intentionally not exposed here; the existing consent-backed cloning flow remains the supported path for a user's own voice.

## Server and storage

`backend/voice_design.py` validates requests and keeps provider credentials server-side. API routes require authentication and existing receptionist plan access. Returned candidate tickets are HMAC-signed, scoped to the business owner and generated description, and expire after one hour.

Save uses a deterministic database reservation per owner/candidate to prevent duplicate provider creation across retries. A definite provider rejection allows retry. An uncertain timeout leaves the reservation pending rather than risking a second provider voice. Pending saves may require operator reconciliation against the ElevenLabs library. A catalog-write failure after provider success is explicitly reported and must also be reconciled.

### Required activation migration

Apply `sql/2026_09_21_nodemere_studio.sql` after the existing voice-contract schema. It adds explicit `voice_source` provenance and allows a designed voice to have no cloning contract, while continuing to require a contract for clones. Designed voices must have both user and business ownership. Existing RLS is unchanged.

**The migration has not been applied to the remote database. Live saving/hiring of a newly designed voice has therefore not been verified.** No real voice, receptionist, or cloning contract was created during QA. The working live check generated temporary audition previews only.

## Performance and accessibility

- The office code and image load only when New Receptionist is entered. The image decodes before choices appear, with retry and Return to Team available on failure.
- Responsive WebP files are 89 KB (960px), 172 KB (1440px), and 244 KB (1816px). The original supplied PNG is 2.22 MB. The original image remains untouched on the user's desktop.
- Only transforms and overlay opacity animate. Pointer parallax is limited to ±2.5px/±1.5px, settles after 1.1 seconds, and uses no rendering loop. Shared selector tilt stops its requestAnimationFrame when settled.
- Mobile uses a dedicated office header above full-sized controls; compact travel is limited to 1.12 scale for Create and 1.1 for Hire. Logo and desk stay prioritized. The Studio header remains accessible while scrolling.
- Reduced motion disables travel, parallax, entrance animations, and tilt. No WebGL support or fallback is needed.
- Keyboard focus moves to stage headings. The existing focus-trapped exit dialog and all backend access checks remain unchanged.

## Verification

Automated commands:

```text
python -m unittest backend.test_voice_design -v
node --test src/sonar/studio/voiceDefinition.test.js
python -m py_compile backend/voice_design.py backend/main.py
npm run build
git diff --check
```

Eight backend tests cover request bounds, signed ownership/expiry, provider candidate count, invalid provider results, idempotent saving, definitive versus uncertain failures, and cross-owner rejection. Two frontend tests cover prompt construction.

Original implementation browser checks covered the integrated Create/Hire paths, existing catalog content, splash, all guided stages, clean exit, dirty sidebar and browser-Back guards, keep/discard behavior, editable prompt preservation, mobile scrolling, model-specific controls, cloning entry and mode continuity, and visual camera/panel composition. A live provider request returned three playable 10.5-second auditions with decoded waveforms and the speaking state.

The development-only `tests/studio.browser.html` fixture uses synthetic audio and stubbed design/save/hire operations. It was used for provider-error recovery, successful selection/naming/save/hire, and a reduced-motion path (`?motion=reduce`). Its banner identifies it as a test fixture. It is not a production build entry. Fresh cloning/signing was not executed in QA.

Original implementation screenshots are in `artifacts/studio`; image refinement captures are in `artifacts/studio-office`. Existing build warnings remain for the global CSS import order, stale Browserslist data, and large application chunks; the build succeeds.

## Image refinement validation

The browser fixture uses synthetic audio and local save/hire responses to validate the full UI without remote writes. Actual Team entry and catalog navigation are checked against the running application. The production voice backend is preserved; the activation migration above remains required before live designed-voice saving can be claimed as verified.

Image refinement checks: desktop/mobile composition, all five guided stages, control room, synthetic generation/playback/selection/save/hire, cloning entry, reduced motion, actual Team Create/Hire navigation, clean return, dirty return, browser Back, keep/discard, and zero canvas elements.

The portrait refinement additionally covered focus/hover-equivalent previews for all three Age options, rapid changes, selection persistence, leave-to-selection restoration, portrait masking at desktop and mobile sizes, the shared panel transition, Control Room widths/gaps at 1920px and 1024px, 390px no-overflow behavior, and browser console output. The side-by-side browser comparison is `tests/studio-comparison.html`; the final report is `design-qa.md`.
