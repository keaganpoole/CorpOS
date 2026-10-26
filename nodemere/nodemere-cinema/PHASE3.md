# Nodemere cinematic film — revision 06

## Preview

119.6 seconds, 60 fps, 1920 × 1080, silent H.264 / Rec.709.
The editable master remains 3840 × 2160. No 4K video was exported.

| Scene | Start | Duration | Source |
|---|---:|---:|---|
| Incoming call / Collection | 0.0 | 16.7 | `src/RevisionFour.tsx` |
| Audition | 16.7 | 24.0 | `src/AuditionScene.tsx` |
| Calendar | 40.7 | 18.6 | `src/CalendarScene.tsx` |
| Drop-ins Builder | 59.3 | 22.0 | `src/DropInsScene.tsx` |
| Conversation Network | 81.3 | 26.0 | `src/NetworkScene.tsx` |
| Live Handoff | 107.3 | 12.3 | `src/HandoffScene.tsx` |

## Preserved work

Opening, five-person conversation showcase, Audition and all their assets are unchanged.
Calendar retains its camera path, salon records, dot cascade and Reschedule border sweep.
Its hero icon is removed as requested. The surface and border are exported for Scene 5;
the optional record slot leaves the original Calendar behavior unchanged.

## Drop-ins Builder

The deterministic film adapter retains native `DropInsPage`, `DropInGraph` and
`DropInAppointmentPreview` markup/classes. CSS and template data are copied from the
product. The only layout overrides fix the cinematic viewport independently of
the Studio browser size; timers and CSS animations use the frame clock instead.

The story selects Completed, adds Google Review from Reviews & Reputation, opens
Details, customizes Purpose and Instructions, saves, and returns to Noah's completed
Haircut. The saved action opens the native call-confirmation treatment and sweep.
It does not place the call. All customers, business examples and saved state are fixtures.

## Network and handoff

Piper's original video plays inside the central circle. A prepared forward/reverse loop
avoids abrupt resets; the media clock continues from Scene 5 into Scene 6. Fourteen
customer portraits come from the public portrait URLs already used by IntercomShowcase.
Provenance is recorded in `public/phase3/provenance.json`.

The camera pulls back while the branches expand. Each feature reveals its own new paths,
then endpoint portraits, then small indicators inside the circles. Prior connections
remain visible. Customer nodes are terminal leaves, never intermediary parents.
Language indicators combine a small flag with IT/FR labels. No numeric language claim
or simulated mid-call language switch is asserted.

The last move follows Sarah's existing endpoint into the isolated Seamless Handoffs
title and the three-person composition. Sarah requests a cancellation-policy exception;
Piper briefs Alex, the salon manager. Alex accepts and the direct customer/staff
connection draws while Piper steps back. These are fictional explanatory captions,
not a fabricated application interface.

## Capability evidence and copy decisions

- **Google Review:** `backend/drop_in_templates.py` defines the Completed-only template;
  `src/sonar/pages/DropInsPage.jsx` provides the editor and save flow.
- **Inbound/outbound calls:** product homepage copy and scenario call dispatch support
  both directions; `backend/scenario_engine.py` includes `call_customer`.
- **Payments:** homepage copy explicitly describes payments/deposits/payment links
  during calls; backend handlers create payment intents and payment links. The film
  depicts an abstract request/confirmation, not spoken card collection or a real charge.
- **Languages:** the supplied brief says 75+; current homepage says 30+. The source does
  not establish the exact runtime count or switching behavior. The preview therefore
  uses “Speak your customers’ language.” Pending product-owner verification, do not
  restore the numeric claim. This discrepancy was raised before implementation.
- **Booking:** the scenario executor includes `create_appointment` and the server
  scheduling handlers.
- **Follow-ups:** scheduled scenario jobs can invoke customer calls. This represents
  configured automation, not an unconditional promise for every account or appointment.
- **Handoff:** `build_escalation_whisper_prompt` in `backend/main.py` supplies a staff
  briefing followed by “Press 1 to accept and connect”; declining hangs up.

No production product files, credentials, calls, transactions or customer records were changed.

## Review and restore

See `QA-PHASE3.md` for completed checks and limitations. Revision 05 and the verified
`before-phase3` snapshot remain alongside revision 06 in the delivery versions folder.
Extract a source archive into a fresh sibling directory, run `npm ci`, and start
`npm run dev` on an available port. Do not restore over the active project.
