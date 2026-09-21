# Nodemere Studio

Implemented September 21, 2026. This extends the existing Team experience; it does not introduce a new application route or replace the receptionist catalog.

## Product and implementation audit

- **Application shell:** `src/sonar/SonarDashboard.jsx` owns local page selection and caches mounted views. Team now has `team`, `entry`, and `studio` content states. Studio replaces Team's content, so receptionist cards are not rendered beneath it.
- **Catalog:** `src/sonar/pages/HireReceptionistModal.jsx` retains its carousel, previews, filtering, and existing hire operation. The Hire path invokes it unchanged.
- **Existing Studio:** `src/pages/VoiceCloneExperience.jsx` contains consent, signature, recording, uploads, cloning, profile editing, and image saving. It now accepts an embedded session without changing the existing `/clone/:token` route. Switching to Design preserves the mounted clone session but stops its recording/playback.
- **Splash:** `src/components/SplashScreenAlternate.jsx` remains the introduction. Studio contains it within Team, adds an explicit skip action, and honors reduced motion.
- **Brand:** the implementation uses the existing Inter/system type stack, near-black backgrounds, white primary buttons, 12px control corners, neutral borders, letterspaced labels, Lucide icons, and existing brand variables. The scene uses graphite, porcelain, and restrained warm lighting.
- **Scenarios Builder:** the Variables pane's actual interaction was extracted into `useInstrumentTilt`. The rest angle is X=0/Y=6 degrees; pointer movement uses the existing 3.6/2.8 degree factors and 0.1 frame interpolation. The panel uses 1600px perspective, center origin, and the original 0.2s ease-out entrance. Resting frames stop, and touch/reduced-motion contexts do not tilt.
- **Stack:** React 18, Vite 4, Framer Motion 12, and the already installed Three.js 0.178. No new package was required. Direct Three.js suits a small procedural scene without introducing another renderer framework or external model dependency.

## Experience

New Receptionist offers two full-size paths. Create enters the splash and a sculptural receptionist at a black desk. Gender, perceived age, accent, tone, and up to three personality qualities progressively build a voice description. Selections change the camera and restrained aspects of appearance, posture, and light.

The control room retains the receptionist between the instrument panel and editable voice definition. Once the user edits the prose, it becomes authoritative: later character changes do not silently overwrite it. An explicit rebuild action restores generated prose.

Auditions use the actual returned candidate count and audio. Waveforms are decoded from that audio, playback is exclusive, and an analyser supplies subtle head movement. There is no fabricated lip synchronization. Saving records the description and characteristics of the generated audition, even if other state subsequently changes.

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

- Studio, entry, exit confirmation, and Three.js scene are dynamically imported. The production scene chunk is about 510 kB / 131 kB gzip and is requested only after Create is entered.
- Procedural geometry avoids model/texture downloads. Device pixel ratio is capped at 1.5, shadows at 1024px, and scene rendering at approximately 30fps while active.
- Rendering stops after the scene settles, and pauses while hidden/offscreen. Geometry, materials, renderer, audio contexts, and preview object URLs are disposed on exit.
- Reduced motion removes animated camera travel, idle movement, and panel tilt. WebGL failure/context loss presents a CSS sculpture while preserving the working creation controls.
- Container queries adapt to the actual Studio width. Phones use a scene above full-size stacked controls, with the ordinary sidebar hidden only while Studio is active. Desktop retains the two-panel composition.
- Keyboard controls have visible focus. Stage headings receive focus; exit confirmation makes background content inert and restores focus on dismissal. Sliders have explicit accessible names.

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

Browser checks covered the integrated Create/Hire paths, existing catalog content, splash, all guided stages, clean exit, dirty sidebar and browser-Back guards, keep/discard behavior, editable prompt preservation, mobile scrolling, model-specific controls, cloning entry and mode continuity, and visual camera/panel composition. A live provider request returned three playable 10.5-second auditions with decoded waveforms and the speaking state.

The development-only `tests/studio.browser.html` fixture uses synthetic audio and stubbed design/save/hire operations. It was used for provider-error recovery, successful selection/naming/save/hire, and a forced no-WebGL/reduced-motion path (`?fallback=1&motion=reduce`). Its banner identifies it as a test fixture. It is not a production build entry. Fresh cloning/signing was not executed in QA.

Screenshots are in `artifacts/studio`. Existing build warnings remain for the global CSS import order, stale Browserslist data, and large application chunks; the build succeeds.
