from pathlib import Path
import json, zipfile, hashlib, shutil
from PIL import Image, ImageChops
r=Path.cwd(); out=Path(r'C:/Users/Keagan/Documents/Codex/2026-10-14/realtime-voice-chat-2/outputs'); rev='27-hero-typography-motion'; d=out/'versions'/rev
d.mkdir(exist_ok=True)
assert not (d/'nodemere-scenes-1-12-source.zip').exists()
review=r/'review/refinement27'; checks=json.loads((review/'validation.json').read_text())
a=Image.open(review/'06-Network-1362.png'); b=Image.open(review/'Nodemere-Film-6804.png'); checks['handoffJoinIdentical']=ImageChops.difference(a,b).getbbox() is None
assert checks['handoffJoinIdentical']
with zipfile.ZipFile(out/'versions/before-hero-motion27/nodemere-scenes-1-12-source.zip') as z:
 changed=[f.relative_to(r).as_posix() for f in (r/'src').rglob('*') if f.is_file() and z.read(f.relative_to(r).as_posix())!=f.read_bytes()]
assert set(changed)=={'src/NetworkScene.tsx'},changed
checks['changedExistingSourceFiles']=changed
(review/'validation.json').write_text(json.dumps(checks,indent=2))
comps=json.loads((review/'compositions.json').read_text()); film=next(c for c in comps if c['id']=='Nodemere-Film')
notes=f'''# Revision 27 - Hero typography and continuous motion

Restores the established Inter hero styling: regular 400 weight, 99px logical size, 1.12 line height, tight -.055em tracking and sentence case. The End, Psych and all 17 feature statements share this styling. Card typography remains independent and the settled grid is pixel-identical to revision 26.

Psych follows a continuous Hermite path through its rise, impact and settling. The End takes on its upward velocity and exits with a restrained rotation. Feature sweeps overlap, with subtle scale changes and a smoothly accelerating rhythm after the first four. The grid camera now starts its pullback smoothly, with a short blend and spatially ordered tile arrivals.

Verification: ESLint and TypeScript passed. Computed Studio styles checked for The End and Psych. Twenty sampled frames reviewed across impact, feature transitions, grid assembly and Handoff. Studio playback sampled at about 60fps. The grid-to-Handoff frame comparison passed. Only NetworkScene.tsx changed among existing scene source files. Film remains {film['durationInFrames']} frames. No video export.

Recovery: ../before-hero-motion27 retains the verified prior source package and previews. Restore into a fresh sibling folder.
'''
(r/'REVISION27.md').write_text(notes,encoding='utf-8');(d/'README.md').write_text(notes,encoding='utf-8')
v=r/'VERSIONS.md';v.write_bytes(b'# Latest Studio release: 27 - Hero typography and motion\n\nSee REVISION27.md and versions/27-hero-typography-motion.\n\n---\n\n'+v.read_bytes())
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
indexpath=out/'versions/index.json'; index=json.loads(indexpath.read_text());index['current']=index['currentStudioRevision']=rev;index['versions'].append(dict(id=rev,frames=meta['frames'],seconds=meta['seconds'],description='Established Inter hero styling and smoother continuous transitions.',videoExported=False));indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps(meta,indent=2))
