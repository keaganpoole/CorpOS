> Current release: revision09. See `REFINEMENT09.md` for the Scenarios and Nest refinements and current timing. The notes below document the original revision08 continuation.

# Nodemere cinematic film — revision 08

## Continuation: People CRM, Scenarios, Nest

The complete preview is 246.1 seconds, 60 fps, 1920 × 1080, silent H.264 / Rec.709.
The editable master remains 3840 × 2160. No 4K video is exported by this update.

| Scene | Starts | Duration | Composition |
| --- | ---: | ---: | --- |
| Existing scenes 1–7 | 0.0 s | 119.6 s | Preserved from revision 07 |
| People CRM | 119.6 s | 30.5 s | `08-People` |
| Scenarios Builder | 150.1 s | 35.0 s | `09-Scenarios` |
| Nest and Intercom | 185.1 s | 61.0 s | `10-Nest` |

The new scenes append to `Nodemere-Film`. Scene 11 is not implemented.
The previous Calendar page Drop-ins correction remains intact.

## Native implementation and cinematic shell

`src/product/phase4/provenance.json` records hashes for the 13 product sources
used for this adaptation. The production application itself is not edited.
The film keeps prepared local assets and does not call the application backend.

- **People:** native homepage demo rows and column configuration, table cells,
  headers, Zone palette, field settings, row/cell cascade and Zone flicker.
  The camera explores the Zone, a drag across headers, purple selection,
  a new Yes/No field named “Loyalty member,” and the original Color Bar sweep.
- **Scenarios:** the original configured node markup, sphere layers, connections,
  selection menu classes, real trigger/action definitions, variable table entries,
  condition styling, and execution states. The example starts with Appointment
  Missed and branches to Call Customer or fallback Send Email. Person Record ID
  is inserted into the native Person ID input. The appointment trigger starts
  the simulated execution. The film does not display a manual Run button for
  this trigger, because the native product only exposes it for No Trigger mode.
- **Nest:** native notification content mapping, two-stage reel, incoming-call
  color sweep and icon animations. Four notifications retain their full reveal
  and detail stages, with progressively shorter pauses. The shell expands into
  Intercom for Maggie, Piper and Kayla; its outer frame stays fixed between
  conversations. The original banner assets, waveform geometry and spring
  response are driven by fictional dialogue timing. The ending pulls back for
  a later continuation without introducing another scene.

The three hero statements are text only on isolated black compositions.
Camera framing and shell dimensions are authored for the film; native UI
typography, colors, gradients and characteristic animation keyframes remain.

## Deterministic animation

Native CSS keyframes are namespaced and scoped under `.phase4-product`.
All 58 extracted keyframe bodies match their product sources. Native durations,
easing and original delay offsets are preserved. Paused animations receive
negative delays from the Remotion frame clock, including pseudo-elements.
Configured-node and execution origins are separate so a run does not replay
the node's creation reveal. Portals render locally inside the cinematic shell.

Prepared CSS is committed. Normal installation/rendering needs only `npm ci`;
it does not require regenerating Tailwind or re-extracting product files.
`prepare-phase4.py` is a one-time extraction record, not a normal build step.
`phase4-css.cjs` is an optional regeneration tool for the full product checkout.

## Render and restore

```powershell
npm ci
npm run dev
npm run lint
npm run render:film-preview
```

The new tail uses the verified direct-renderer script with PNG capture and
H.264 CRF 15 to keep fine text and borders crisp. The delivered preview appends it to revision 07 without
re-encoding the approved prefix. Metadata records the decoded prefix hash.
`scripts/finalize-phase4.py` assembles and verifies that file. The source ZIP
also renders the entire composition independently.

Revision 07 and `versions/before-phase4` are retained. Revision 08 is saved in
`versions/08-people-scenarios-nest` with its own preview, source, metadata,
review evidence and manifest. Restore into a fresh sibling folder as described
in `VERSIONS.md`; never extract over the current project.

These are deterministic product demonstrations with fictional records and
simulated calls/execution. The preview is intentionally silent for later audio.
See `QA-PHASE4.md` for the completed review and its limits.
