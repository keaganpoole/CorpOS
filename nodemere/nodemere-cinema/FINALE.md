> Revision 13 historical notes. Revision 14 supersedes the logo implementation and timing; see LOGO-CORRECTION.md.

# Scenes 11â€“12: encryption and final brand reveal

Revision 13, prepared for Remotion Studio review. No video export was made.
User direction to review in the editor overrides rendering instructions in the brief.

## Open the film

Run `npm ci` if dependencies are missing, then `npm run dev`.
Open http://localhost:3100/Nodemere-Film and seek to frame 15246 (4:14.10).
Individual compositions: `11-Encryption` and `12-Final-Logo`.
The full film is 16,765 frames / 279.416667 seconds, 3840 Ã— 2160, 60 fps.
Both new scenes are silent. Prior scenes and their timing are preserved.

## Direction and implementation

Scene 11 uses the existing text-only hero reveal. Its upward handoff leads into a
close pass through five chamfered metal layers. The camera pulls back while the
gaps close in sequence and four independent compartments seat within the frame.
A single thin pink-purple inlay completes the structure. This is a visual metaphor
for layered, business-specific protection, not a literal implementation diagram.

All geometry and lighting are procedural and local. Three.js supplies real depth,
occlusion, bevels and metal shading. The camera and assembly are calculated directly
from the current frame; there is no accumulated simulation, random state or timer.
Each inter-layer gap remains at least 39 units, preserving physical clearance.

The previous Nest scene's last frame is frozen only inside the first 0.72 seconds
of Scene 11 to connect the transition. No Scene 1â€“10 implementation was changed.

## Security wording and evidence

Used: **Built with AES-256-GCM encryption and per-business key protection.**

The proposed U.S. government classified-information comparison was omitted. An
algorithm choice is not evidence of an approved or FIPS-validated application or
deployment. No certification, government approval, complete-data coverage or
production compliance is asserted by this film.

Read-only review of the native project confirmed:

| Capability | Evidence and limit |
| --- | --- |
| AES-256-GCM | `backend/envelope.py`: 32-byte random DEKs, AESGCM, 12-byte random nonces. |
| Per-business keys | `Envelope.current` resolves/creates a business-specific key record. |
| Server-side protection | DEKs are wrapped using server-configured KEKs; database rows contain wrapped keys. This is not evidence of an HSM or a managed KMS. |
| Authentication | Resource/record/field/business/key context is authenticated; invalid context or ciphertext fails closed in `Envelope.open`. |
| Rotation | `security_maintenance.py` implements explicit DEK rotation and KEK rewrapping. No automatic rotation claim. |
| Activation | `docs/security-phases5-7-development-acceptance.md` records development acceptance for a documented protected-field/file scope. It explicitly is not production signoff or proof that all data has been encrypted. |

Native files inspected are hashed in `src/product/finale/provenance.json`.
No security settings, keys, backend services or business data were accessed or changed.

Primary standards references:

- [NIST SP 800-38D: GCM](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [NIST CMVP FAQs](https://csrc.nist.gov/Projects/cryptographic-module-validation-program/FAQs)
- [NIST validated modules](https://csrc.nist.gov/Projects/cryptographic-module-validation-program/validated-modules)

## Authentic final logo and selected animation

Asset: native `public/logo/nodemere.svg`, copied byte-for-byte to
`public/finale/nodemere.svg`; unchanged SVG geometry is also embedded for layering.

Selected animation: **Perimeter Â· decelerate**, preset ID **`braking`**.
The current `/logo` page is static, but its `logoPresets.js` retains the brand's
developed animations. The earlier animated `logoAnimation.js` was inspected in
Git commit `64109a8`. Its default `braking` mode supplies the reference treatment.

The film directly reuses the native `presetDisplacement` function, group 2,
1.25Ã— travel clock, independent oscillation clock, segment anchors and layer weights.
The displacement is mapped onto the authentic asset's perimeter. Only the base's
colored underlay moves; the original white logo stays stable. Brand colors come
from `index.css`. No extra bloom, particles, title, URL or end-card text is added.

## Exact timeline

All intervals below are half-open, with the end frame excluded.

| Event | Local frames | Duration |
| --- | --- | --- |
| Scene 11 | 0â€“960 | 16 s |
| Scene 11 fade to pure black | 906â€“933 | 0.45 s |
| Scene 11 black remainder | 933â€“960 | 0.45 s |
| Scene 12 black pause | 0â€“12 | 0.2 s |
| Logo fade-in | 12â€“144 | 2.2 s |
| Fully visible, completely still hold | **144â€“294** | **150 frames / 2.5 s** |
| Native base signature | 294â€“469 | 175 frames / 2.916667 s |
| Fade out | 469â€“523 | 54 frames / 0.9 s |
| Pure black tail | 523â€“559 | 36 frames / 0.6 s |

Scene 11 starts at global frame 15246. Scene 12 starts at 16206.
The still hold occupies global frames 16350â€“16499 inclusive.
The last frame is 16764, pure black. The base animation finishes before the fade.

## Review and recovery

`scripts/review-finale-stills.cjs` captures still PNGs only; it does not encode a video.
`scripts/verify-finale.py` checks the still hold, black boundaries, source preservation,
native asset hashes and contact sheets. Review evidence is in `review/finale`.

The release source ZIP includes prepared local media and can be extracted into a
fresh sibling folder, followed by `npm ci` and `npm run dev`. Do not overlay an old
release onto the working project. The pre-edit source is separately saved in
`outputs/versions/before-final-scenes`. Revision 12 is the preceding Studio version;
revision 10 remains the last exported MP4, not a preview of this update.
