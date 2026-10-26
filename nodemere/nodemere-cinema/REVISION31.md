# Revision 31 — Calendar drop-ins flow and surface

- Removed the inline Drop-ins panel fill, outer border, and shadow so its contents sit directly on the calendar surface.
- Moved “Make it yours” into the camera move toward the appointment previews.
- After the hero, the camera returns to the top Drop-ins control, which opens the inline builder and changes to “Back.”
- The builder starts at All, clicks the empty Cancelled status to reveal templates, then selects Pending and the Confirm Appointment template.
- Updated the instruction field to ask the customer to confirm they are coming and offer rescheduling if they need another time.
- After saving, Back returns to the calendar and the camera moves down to Emma’s appointment, where the existing call prompt plays.

Review: rendered and inspected still frames from the Calendar composition at the hero, All state, empty status/template reveal, Pending filter, Confirm editor, completed instructions, and Emma return/call prompt. `npm run lint` passed (ESLint and TypeScript). No video exported.
