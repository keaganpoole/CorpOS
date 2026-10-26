# Revision 30 — Calendar drop-ins inline sequence

- Removed the separate Drop-ins Builder segment from the main film and integrated its editing sequence into Calendar.
- After the appointment previews, the camera moves to the existing Drop-ins control, which changes to “Back.”
- Reused the “Make it yours” hero immediately before the inline builder and carried over the existing timed template, edit, and save sequence.
- Removed the added Calendar return control and the separate Edit drop-ins control. The Back control returns to the calendar, and the camera continues down to the appointment previews.
- Removed the inline panel shadow.

Review: inspected rendered stills from the standalone Calendar scene and the full-film composition at the hero, builder, and return moments. `npm run lint` passed (ESLint and TypeScript). No video export.
