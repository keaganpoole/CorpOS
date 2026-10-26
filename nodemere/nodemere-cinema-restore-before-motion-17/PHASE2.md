# Film revision 05 - Salon examples and expressive motion

## Project and delivery

Project: C:/Users/Keagan/.openclaw/workspace/nodemere/nodemere-cinema
Studio: http://localhost:3100/Nodemere-Film
Delivery: C:/Users/Keagan/Documents/Codex/2026-10-14/realtime-voice-chat-2/outputs
The live website is not changed or deployed.

## Timeline

| Master time | Content |
| --- | --- |
| 0-16.7 s | Unchanged incoming call, collection and five conversations. |
| 16.7-27.3 s | Create your own, name, gender and age. |
| 27.3-34.5 s | African, American, then left-column accent hovers; Italian/Sicilian. |
| 34.5-40.7 s | All seven Set the vibe options, with native face previews. |
| 40.7-42.75 s | Appointments, handled hero. |
| 42.75-48.8 s | Calendar pushes title up, pans down, swings to the left-facing angle. |
| 48.8-52.2 s | Missed Hair Coloring appointment; Reschedule and Cancel. |
| 52.2-53.2 s | Call Emma to reschedule prompt and perimeter sweep. |
| 53.2-59.3 s | Confirmation and concluding pullback. |

## Targeted changes

- Calendar tilt reversal lasts 1.2 seconds instead of 3.1 seconds. Its smooth cubic
  easing accelerates and decelerates with zero endpoint velocity; downward pan
  and zoom paths are unchanged and continue during the swing.
- Appointment records are Hair Coloring / Missed / Emma Reed, Haircut / Completed /
  Noah Blake, and Hair Styling / Pending / Olivia Park. Emma remains the selected
  reschedule target. Date dots match these statuses.
- Accent path: African, American, Australian, Canadian, Indian, Italian.
  American/Californian and Italian/Sicilian remain selected. Irish stays in the
  native list but is never hovered or previewed. Four rows initially fit.
- Options scroll visually inside the fixed viewport using a frame-derived
  translation. This avoids a renderer scroll-reset issue. No scrollbar appears;
  headings, Accent DNA and Continue stay fixed. Italian regional options fit.
- Set the vibe visits Calm, Caring, Charming, Friendly, Motivational, Playful and
  Serious in order at 0.7-second intervals, with the native 0.52-second crossfade.
  The cursor glides down the labels. Audition is three seconds longer.

## Preserved

Opening and showcase source are unchanged: Nikki at Bennett Law in row five,
Kayla third, titanium frame, faint seam shadows, left frost and lighter right
frost, dimmed collection backdrop, and existing sizes. Calendar keeps its native
UI, dot cascade, direct appointment interaction, Emma prompt and border sweep.
The create-your-own title has no icon. All data is fictional; no live operations.

## Source and recovery

Changed source: src/AuditionScene.tsx, src/CalendarScene.tsx,
src/product/AccentDna.jsx. New native face assets and source hashes are listed in
public/audition/revision05-provenance.json. Durations derive automatically in
FullFilm.tsx and Root.tsx: 3,558 frames at 60 fps.

Delivery is a silent 59.3-second 1920 by 1080 preview. No 4K export is authorized.
The first 1,002 frames reuse revision 04 with matching Rec.709 normalization;
remaining frames use current source, including the corrected accent segment.
Use scripts/finalize-salon-revision.py, review-salon-revision.py and
publish-salon-revision.py. Older scripts apply to their historical releases.
See VERSIONS.md for restoring to a fresh sibling folder.
