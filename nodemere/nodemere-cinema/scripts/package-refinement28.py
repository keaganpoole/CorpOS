from pathlib import Path
import json, zipfile, hashlib, shutil
from PIL import Image, ImageChops
r=Path.cwd(); out=Path(r'C:/Users/Keagan/Documents/Codex/2026-10-14/realtime-voice-chat-2/outputs'); rev='28-centered-psych-impact'; d=out/'versions'/rev
d.mkdir(exist_ok=True)
assert not (d/'nodemere-scenes-1-12-source.zip').exists()
review=r/'review/refinement28'; checks=json.loads((review/'validation.json').read_text())
a=Image.open(review/'06-Network-1362.png'); b=Image.open(review/'Nodemere-Film-6804.png'); checks['handoffJoinIdentical']=ImageChops.difference(a,b).getbbox() is None
assert checks['handoffJoinIdentical']
with zipfile.ZipFile(out/'versions/before-psych-impact28/nodemere-scenes-1-12-source.zip') as z:
 changed=[f.relative_to(r).as_posix() for f in (r/'src').rglob('*') if f.is_file() and z.read(f.relative_to(r).as_posix())!=f.read_bytes()]
assert set(changed)=={'src/NetworkScene.tsx'},changed
checks['changedExistingSourceFiles']=changed
(review/'validation.json').write_text(json.dumps(checks,indent=2))
comps=json.loads((review/'compositions.json').read_text()); film=next(c for c in comps if c['id']=='Nodemere-Film')
notes=f'''# Revision 28 - Centered Psych impact

The End now holds, then Psych rises into it with a quick centered collision. The End recoils a short distance upward and fades; Psych gives a compact scale pulse, catches the impact, and settles. A soft, brief light bloom marks contact. The whole exchange takes roughly a third of a second and stays near center. Hero styling remains the established 99px regular Inter.

Verification: ESLint and TypeScript passed. Sampled frames around contact and follow-through plus the feature sequence, full grid, and outgoing Handoff join reviewed. The settled grid is pixel-identical to revision 27. Only NetworkScene.tsx changed among existing scene files. No video export.
'''
(r/'REVISION28.md').write_text(notes,encoding='utf-8');(d/'README.md').write_text(notes,encoding='utf-8')
v=r/'VERSIONS.md';v.write_bytes(b'# Latest Studio release: 28 - Centered Psych impact\n\nSee REVISION28.md and versions/28-centered-psych-impact.\n\n---\n\n'+v.read_bytes())
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
indexpath=out/'versions/index.json'; index=json.loads(indexpath.read_text());index['current']=index['currentStudioRevision']=rev;index['versions'].append(dict(id=rev,frames=meta['frames'],seconds=meta['seconds'],description='Quick centered Psych collision replaces the long offscreen exit.',videoExported=False));indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps(meta,indent=2))
