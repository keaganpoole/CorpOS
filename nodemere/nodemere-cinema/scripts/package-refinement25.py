from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
out = Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs')
revision = '25-nest-reveal-call-state-polish'
dest = out / 'versions' / revision
assert not (dest / 'nodemere-scenes-1-12-source.zip').exists(), 'Do not overwrite a packaged revision'
dest.mkdir(exist_ok=True)
review = root / 'review/refinement25'
changes = [
    'Animated pink/purple call borders in the Drop-ins preview and its Calendar return, using the existing native animation.',
    'One gradient-only Future text layer, removing the white duplicate beneath it.',
    'Handoff explains why a caller is connected, how the team is briefed, and why the caller can continue without starting over. Caption sizing and spacing reviewed.',
    'Scenarios uses native node descriptions with Stripe omitted. Descriptions wrap beneath titles without changing node geometry.',
    'Condition labels sit centered immediately above their branches, parallel to each curve at its midpoint.',
    'Nest conversations show the receptionist source videos in the portrait and softened background. Video frames remain continuous into Encryption.',
    'Nest replaces Everything in Real Time: initial NEST hold, measured expansion to Nodemere Events & Signal Terminal, reading hold, and return to NEST before the dashboard. Adds 6.5 seconds.',
]
checks = json.loads((review / 'validation.json').read_text())
assert checks['scenariosCameraUnchanged']
assert checks['nestEncryptionJoin']['maximumDifference'] == 0
assert checks['lastFrameBlack']
assert all(x['meanChannelDifference'] > 0 for x in checks['portraitMotion'].values())
notes = '# Revision 25 — Nest reveal and film refinements\n\n'
notes += 'Studio: http://localhost:3100/Nodemere-Film\n\n'
notes += '18,081 frames at 60 fps; 301.35 seconds. Studio and PNG review only; no new encoded video.\n\n## Changes\n\n'
notes += '\n'.join('- ' + c for c in changes)
notes += '\n\n## Verification\n\n'
notes += ('ESLint and TypeScript passed. Representative 1920×1080 stills and Studio playback reviewed for sizing, placement, timing and transitions. '
          'Computed styles confirm the call border advances in both previously static appearances. '
          'Separate portrait crops confirm movement for Maggie, Piper and Kayla. '
          'The final Nest frame and first Encryption bridge frame are pixel-identical; the last film frame is black. '
          'The Scenarios camera source remains byte-identical to revision 24 (the revision 21 rollback). '
          'This is sampled visual and playback verification, not an encoded-video or comprehensive performance benchmark.\n\n')
notes += ('## Recovery\n\nThe pre-edit prepared source and matching preview are retained in `../before-refinement25`. '
          'This folder contains the complete prepared source archive and final review previews. '
          'Restore into a fresh sibling folder, run `npm ci`, then `npm run dev`; preserve the current checkout.\n')
(root / 'REVISION25.md').write_text(notes, encoding='utf-8')
(dest / 'README.md').write_text(notes, encoding='utf-8')
versions = root / 'VERSIONS.md'
versions.write_bytes(('# Latest Studio release: 25 — Nest reveal and film refinements\n\n'
    '`versions/25-nest-reveal-call-state-polish` contains the complete source, final previews, metadata, and review notes. '
    '18,081 frames; 301.35 seconds. See REVISION25.md. The Scenarios camera retains the revision 21 rollback. '
    'No new video export. `before-refinement25` retains the verified pre-edit archive and matching preview.\n\n---\n\n'
    ).encode('utf-8') + versions.read_bytes())
preview = dest / 'preview'
preview.mkdir()
for f in review.glob('*.png'):
    shutil.copy2(f, preview / f.name)
for name in ['validation.json', 'compositions.json']:
    shutil.copy2(review / name, dest / name)
metadata = dict(revision=revision, previousStudioRevision='24-scenarios-reverted-to-rev21',
    frames=18081, seconds=301.35, fps=60, width=3840, height=2160,
    scene11={'startFrame':16745}, scene12={'startFrame':17495},
    changes=changes, review=checks, videoExported=False,
    previewFrameCount=len(list(preview.glob('*.png'))))
(dest / 'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(metadata, indent=2))
files = {}
for directory in ['src', 'public', 'scripts']:
    for f in (root / directory).rglob('*'):
        if f.is_file() and '__pycache__' not in f.parts:
            files[f.relative_to(root).as_posix()] = f
for f in root.iterdir():
    if f.is_file() and (f.suffix == '.md' or f.name in ['package.json', 'package-lock.json', 'remotion.config.ts', 'tsconfig.json', 'eslint.config.mjs', '.gitignore']):
        files[f.name] = f
for f in review.iterdir():
    if f.suffix in ['.png', '.json']:
        files[f.relative_to(root).as_posix()] = f
archive = dest / 'nodemere-scenes-1-12-source.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=5) as z:
    for name, f in sorted(files.items()):
        z.write(f, name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name, f in files.items():
        assert z.read(name) == f.read_bytes(), name
hashes = {name:hashlib.sha256(f.read_bytes()).hexdigest() for name, f in sorted(files.items())}
(dest / 'source-hashes.json').write_text(json.dumps(hashes, indent=2))
metadata['archive'] = dict(bytes=archive.stat().st_size, sha256=hashlib.sha256(archive.read_bytes()).hexdigest(), crcVerified=True, workingFilesMatch=True, files=len(files))
(dest / 'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(metadata, indent=2))
for name in ['nodemere-scenes-1-12-source.zip', 'nodemere-scenes-1-12-metadata.json']:
    shutil.copy2(dest / name, out / name)
indexpath = out / 'versions/index.json'
index = json.loads(indexpath.read_text())
index['current'] = index['currentStudioRevision'] = revision
index['versions'].append(dict(id=revision, frames=18081, seconds=301.35,
    description='Call-state animation, gradient Future, Handoff value, native Scenarios descriptions and aligned labels, receptionist videos, and paced Nest acronym reveal.', videoExported=False))
indexpath.write_text(json.dumps(index, indent=2))
print(json.dumps(dict(revision=revision, **metadata['archive'], previews=metadata['previewFrameCount']), indent=2))
