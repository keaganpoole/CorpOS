# Revision 07 — Calendar Drop-ins correction

Scene 5 now demonstrates the DropInsModal opened by CalendarMonthView. Revision 06
used the separate DropInsPage graph studio, which was not the builder Keagan intended.

## Scope

Only Scene 5 presentation and camera framing change. Its duration remains 22 seconds,
from 59.3 to 81.3 seconds. Total duration remains 119.6 seconds at 60 fps. The incoming
Calendar bridge, completed-appointment payoff and outgoing Piper bridge retain their
timing. Scenes 1–4, 6 and 7 retain their source and their prior rendered sections.

## Native workflow

- The modal opens on Completed, matching its native default.
- Its floating appointment preview sits above status tabs and the template gallery.
- Reviews & Reputation filters the gallery; selecting Google Review opens the editor.
- The editor uses Button name, Purpose, and What should your receptionist do.
- Focusing Purpose reveals the native call confirmation in the appointment preview.
- Save drop-in returns to Your drop-ins and adds Google Review to the preview.
- The camera returns to Noah's completed Haircut and shows the new action.

The business and customer data are fictional. No application state, calls or external
actions are performed. The film adapter is deterministic.

## Source

- `src/DropInsScene.tsx`: existing scene, corrected camera framing and adapter import.
- `src/product/CalendarDropInsFilm.jsx`: frame-driven Calendar modal presentation.
- `src/product/calendar-modal/`: native CSS copies, Google icon paths, scoped desktop
  stylesheet and a small fixed-viewport adapter.
- `scripts/prepare-calendar-modal.cjs`: regenerates the scoped desktop stylesheet from
  the current Calendar component styles. Removes media queries only for a fixed film
  viewport; prefixes selectors so other scenes cannot inherit those style changes.

Native component references in the parent product checkout:
`src/sonar/pages/CalendarMonthView.jsx`, `src/sonar/components/DropInsModal.jsx`,
`src/sonar/components/DropInAppointmentPreview.jsx`.

The separate DropInsFilm adapter remains available as revision history and supplies
the unchanged shared appointment payoff. It is no longer rendered as the Scene 5 builder.

## Delivery and restore

1080p silent preview only. No 4K video export. Revision 06 and the verified
before-calendar-modal snapshot remain separate. The source ZIP includes this correction
and all prepared media. See QA-CALENDAR-MODAL.md and VERSIONS.md.
