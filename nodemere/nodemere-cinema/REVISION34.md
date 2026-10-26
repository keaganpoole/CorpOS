# Revision 34 — Hero typography

Working preview: http://localhost:3100/Nodemere-Film
Studio was reviewed on the actual working checkout, including the Booking contrast beat, Collection layout, and Intercom phrase build. No video exported. Production frontend untouched.

## Treatments
- Fully → Autonomous → Booking. Booking cuts to black type on white, holds for approximately 0.75 seconds before the existing Calendar transition begins.
- Talk → with → your → receptionist: earlier words remain; receptionist enters at the original size and then grows 3.5%, with a smooth non-bouncing ease. Background remains black.
- Collection: Deploy / the world's most advanced / AI receptionists. Existing two-line arrangement and label remain.
- Audition: Or / create / your own. Drop-ins: Make it / yours. Scenarios: Build / Powerful Automations.
- Always-on: Keep your front desk / running / 24/7. Closing welcome: Welcome to the / future / of the front desk. Original gradient animation is preserved.
- CRM: One. / Stunning. / CRM. Original Stunning prism animation remains byte-for-byte unchanged.
- Encryption explanation: The encryption standard used / to protect / U.S. classified information.
- Longer early feature titles build in meaningful groups within their existing beat duration. The rapid late montage retains hard replacements so it remains readable at its original speed. The grid is untouched.
- One/two-word heroes (Incoming call, Smart Handoffs, World-Class Encryption, The End, Psych) retain their established treatments. The distinctive NEST acronym expansion is preserved.

## Reference analysis
Reference: https://www.youtube.com/watch?v=jk6sz25OZgw (Apple — Don't Blink).
Actual YouTube imagery was accessed in the browser and sampled using paused frame steps; this was not metadata-only analysis. Observed small centered hard word replacements (not/blink), an oversized Hello on white, restrained centered Black, and Lightning port changing to a much larger black or on white, then a smaller white you on black. These demonstrate rhythmic contrast, changes of typographic scale, and deliberate changes in spatial emphasis. This film adapts those principles to its existing regular Inter typography and restrained palette, rather than copying the reference's heavier type or product footage.
Limitation: this was a sampled visual/frame-step study, not an uninterrupted audiovisual review or an audio-synchronized recreation.

## Audit and verification
- Shared Hero handles current Calendar, Audition, RevisionFour Collection, Scenarios, Nest Intercom, Handoff and Encryption heroes. Their scene files, clocks, cameras and interface demos are unchanged.
- HomepageHeadlines custom gradient heroes and People custom CRM hero updated through separate phrase wrappers.
- CollectionTitle.tsx is only referenced by the legacy CollectionScene/Previous-Opening compositions, not the current FullFilm; audited and left unchanged.
- Network feature grid source is byte-for-byte unchanged, as is the Stunning effect implementation and the complete eyebrow markup.
- ESLint and TypeScript pass.
- 41 hero/hold/transition stills visually inspected. Studio playback and selected key frames inspected; no current Studio error.
- Six sampled eyebrow regions are pixel-identical to baseline (Collection, Audition, Drop-ins, Scenarios, Intercom, Encryption).
- Sampled Emma preview, feature grid, outgoing Audition, settled Calendar after the hero, and closing logo entry are pixel-identical to baseline.
- FullFilm.tsx and every composition duration unchanged: 16,758 frames / 279.3 seconds at 60fps. Earlier release index claimed a different duration; this update preserves the actual working source duration captured before edits.
- Existing source changes limited to PhaseTwoShared.tsx, HomepageHeadlines.tsx, PeopleScene.tsx, NetworkScene.tsx; new helper HeroTypography.tsx. No assets, demo UI, choreography, scene schedules or production app files changed.

## Recovery
The verified baseline is ../before-hero34-20261017/source.zip, with a SHA-256 manifest and matching still previews. It captures the actual working revision 33 source, including unarchived user changes. To restore, extract into a fresh sibling folder and compare; never overwrite the working checkout with an old archive.
This folder contains the completed source archive, checks, still previews, comparison frames and Studio screenshot. No MP4 was produced.
