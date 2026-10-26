# Revision 32 — Calendar transition and preview camera polish

- “Make it yours” appears over the calendar pan and fades away before the angle change.
- The calendar header switches from October 2026 to a lightbulb Drop-ins heading while the inline builder is active; the duplicate inner title is hidden.
- The selected-status underline is removed from the inline builder.
- Status color dots animate in with the Drop-ins panel reveal instead of waiting several seconds.
- The camera settles on Emma’s close framing before the avatar click and holds its position, zoom, and angle for the appointment preview.

Reviewed the Calendar composition in Remotion Studio and rendered representative still frames for the hero, Drop-ins transition, dot reveal, and Emma preview. `npm run lint` passed (ESLint and TypeScript). No video exported.
