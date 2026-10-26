from pathlib import Path
import json, zipfile, hashlib, shutil
from PIL import Image, ImageChops
r=Path.cwd(); out=Path(r'C:/Users/Keagan/Documents/Codex/2026-10-14/realtime-voice-chat-2/outputs'); rev='26-kinetic-features-grid'; d=out/'versions'/rev
d.mkdir(exist_ok=True)
assert not (d/'nodemere-scenes-1-12-source.zip').exists()
review=r/'review/refinement26'; checks=json.loads((review/'validation.json').read_text())
a=Image.open(review/'06-Network-1362.png'); b=Image.open(review/'Nodemere-Film-6804.png'); checks['handoffJoinIdentical']=ImageChops.difference(a,b).getbbox() is None
assert checks['handoffJoinIdentical']
with zipfile.ZipFile(out/'versions/before-feature-finale26/prepared-source.zip') as z:
 changed=[f.relative_to(r).as_posix() for f in (r/'src').rglob('*') if f.is_file() and z.read(f.relative_to(r).as_posix())!=f.read_bytes()]
assert set(changed)=={'src/NetworkScene.tsx','src/FullFilm.tsx'},changed
checks['changedExistingSourceFiles']=changed
(review/'validation.json').write_text(json.dumps(checks,indent=2))
comps=json.loads((review/'compositions.json').read_text()); film=next(c for c in comps if c['id']=='Nodemere-Film')
notes=f'''# Revision 26 — Kinetic features and reference grid

Replaces the conversation tree after the Future headline with The End / Psych, all 17 selected feature titles, and the reference grid. The first four titles each receive 1.18 seconds. A smooth exponential duration curve reduces successive beats to approximately 0.095 seconds. Psych rises and launches The End upward, with recoil and settling. Titles land with scale compression and sweep left. The final title anchors the camera pullback as the tiles assemble, with staggered arrivals and a restrained border highlight. Grid holds for over seven seconds after settling.

The grid follows grid1.jpg: 5 / 5 / 5 / 2 centered cards, condensed italic titles, small descriptions, dark contour texture, and no header or footer. Uses locally bundled Barlow Condensed with its OFL license.

Verification: ESLint and TypeScript passed. All 17 titles fit in Studio; descriptions have positive clearance. Sampled 1080p stills reviewed at the impact, feature beats, grid pullback, settled grid, and outgoing transition. Studio playback sampled at approximately 60fps. Grid final frame is pixel-identical to the incoming Handoff bridge. Only NetworkScene.tsx and its timeline label in FullFilm.tsx changed among existing source files. This is sampled playback and visual QA, not a full encoded-film performance benchmark.

Film: {film['durationInFrames']} frames at 60fps. No video export. Studio: http://localhost:3100/Nodemere-Film

Recovery: ../before-feature-finale26 contains the verified pre-edit prepared source and prior preview stills. Restore into a fresh sibling directory, preserving the current checkout.
'''
(r/'REVISION26.md').write_text(notes,encoding='utf-8');(d/'README.md').write_text(notes,encoding='utf-8')
v=r/'VERSIONS.md';v.write_bytes(b'# Latest Studio release: 26 - Kinetic features and reference grid\n\nSee REVISION26.md and versions/26-kinetic-features-grid.\n\n---\n\n'+v.read_bytes())
shutil.copytree(review,d/'preview')
files=[]
for folder in ['src','public','scripts']:
 files.extend(f for f in (r/folder).rglob('*') if f.is_file() and '__pycache__' not in f.parts)
files.extend(f for f in r.iterdir() if f.is_file() and f.suffix in ['.md','.json','.ts','.mjs'])
archive=d/'nodemere-scenes-1-12-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
 for f in files:z.write(f,f.relative_to(r))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for f in files:assert z.read(f.relative_to(r).as_posix())==f.read_bytes()
meta=dict(revision=rev,frames=film['durationInFrames'],seconds=film['durationInFrames']/60,videoExported=False,checks=checks,archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest())
(d/'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(meta,indent=2))
for name in ['nodemere-scenes-1-12-source.zip','nodemere-scenes-1-12-metadata.json']:shutil.copy2(d/name,out/name)
indexpath=out/'versions/index.json'; index=json.loads(indexpath.read_text());index['current']=index['currentStudioRevision']=rev;index['versions'].append(dict(id=rev,frames=meta['frames'],seconds=meta['seconds'],description='Psych impact, accelerating 17-feature sequence, and reference grid camera reveal.',videoExported=False));indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps(meta,indent=2))
