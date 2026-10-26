# Nodemere promo — revision 09

## Scope

This revision changes only the film's Scenarios and Nest scenes. Scenes 1–8 keep their approved source and encoded pixels. Production Nodemere files are read only; the prepared film runs entirely on local demo data.

The preview is 254.1 seconds, 1920 × 1080, 60 fps, silent H.264 / Rec.709. The composition remains 3840 × 2160 for future delivery. No 4K video is exported.

## Scenarios — 150.1 to 192.1 seconds

- Original unconfigured circle and “Click it. Click it real good.” reveal, followed by a close camera move into that phrase.
- Appointment Completed is configured first; Payments → Create Invoice is configured second.
- The Variables pane joins the left edge of the invoice configuration. Native table order, colors, icons and all 122 field definitions are preserved across Staff, Business, Receptionists, Services, Appointments, Invoices, Payments and People.
- A quick scroll exposes the table list. The cursor then moves between invoice fields and the appropriate table variables: person ID, service price, service name, customer name/email, appointment ID and service ID. Form scrolling is deterministic and aligned to each selection.
- Twelve further nodes appear in a rapid stagger with connections drawing toward them. Fourteen nodes and thirteen connections form the completed branching canvas. The camera pulls back as the graph grows.
- Existing native execution styling follows one illustrative path; no live workflow is executed.

## Nest — 192.1 to 254.1 seconds

- Brief Teams dashboard overview with Maggie, Kayla and Piper. Maggie and Kayla play their source videos; Piper is inactive.
- One connected camera move centers and enlarges the Nest. Its incoming-call reveal begins during that move.
- Close angled sweeps emphasize native incoming calls, appointments, people and milestone notifications. The view eases back enough to read the event details.
- Native Intercom content, receptionist switching and waveform behavior remain intact. The camera widens into that section.
- Additional internal raster density keeps the native text sharp during extreme close-ups without altering its typography or keyframes.

## Rendering

`npm run render:film-preview` uses the normal-density browser and scales only the final output to 1080p. It derives the duration from the current composition.

Revision09's incremental capture is `node scripts/render-refinement09.cjs`. It starts after the first three unchanged frames of the Scenarios hero at a closed-GOP boundary. `scripts/finalize-refinement09.py` appends it to the copied prefix and verifies the first 9006 decoded frames against revision08.

## Rollback

The previous release is retained at `versions/08-people-scenarios-nest`, with a verified pre-edit duplicate at `versions/before-scenarios-nest-refinement`. Revision09 is stored separately at `versions/09-scenarios-nest-refinement`.

Restore the selected source archive into a fresh sibling folder, run `npm ci`, then start Studio on an available port. Do not extract over the current project. Each release includes its matching preview and SHA-256 manifest.
