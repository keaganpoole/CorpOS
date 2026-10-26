from pathlib import Path
import json, zipfile, hashlib, shutil
root=Path.cwd()
out=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs')
revision='22-match-cut-headlines-encryption'
prev=out/'versions'/'21-headlines-network-choreography'
dest=out/'versions'/revision
dest.mkdir(exist_ok=True)
changes=[
 'Scenarios: fly into white intro surface and emerge from the configured white Appointment Completed node, easing into the existing sweep.',
 'CRM: show the settled title before the native Stunning effect begins at 1.65 seconds; equal word gaps. Added one second of headline time.',
 'Deploy headline and Nodemere Collection label reduced together to 86 percent.',
 'Collection-choice hero delayed 1.5 seconds during the pan, with continuous camera-clock joins.',
 'Future starts white; gradient fades in at 1.1 seconds and sweeps slowly across through 2.8 seconds.',
 'Encryption retains its geometry and motion with matte-black textured layers and restrained recessed pink-purple core illumination based on the approved concept.',
 'Intercom placement unchanged, per the withdrawn request.'
]
checks=json.loads((root/'review/refinement22-checks.json').read_text())

checks['studioError']=None
checks['lint']='passed'
shots={}
for name in ['refinement22-shots.json','refinement22-second.json','refinement22-final.json','refinement22-polish.json','refinement22-material.json']:
 for comp,frames in json.loads((root/'review'/name).read_text()).items():
  shots.setdefault(comp,set()).update(frames)
p=root/'review/finale/stills'
shots={k:sorted(f for f in v if (p/f'{k}-{f}.png').exists()) for k,v in shots.items()}
(root/'review/refinement22-approved.json').write_text(json.dumps(shots,indent=2))
checks['savedReviewFrameCount']=sum(map(len,shots.values()))
(root/'review/refinement22-checks.json').write_text(json.dumps(checks,indent=2))
meta=json.loads((prev/'nodemere-scenes-1-12-metadata.json').read_text())
meta.update(revision=revision,previousStudioRevision=prev.name,frames=17691,seconds=17691/60,changes=changes)
meta['scene11']['startFrame']=16355
meta['scene12']['startFrame']=17105
meta.pop('logoSizeFactorVsPrevious',None)
meta['review']={'lint':'passed','frameReview':'Repeated representative still review and Studio playback, including corrected transition frames. No encoded video produced.','checks':checks,'videoExported':False}
(dest/'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(meta,indent=2))
readme='# Revision 22 — Match transition, headline timing and encryption materials\n\nPreview in Remotion Studio: http://localhost:3100/Nodemere-Film\n\nNo video export. Production application source unchanged.\n\n## Changes\n\n'+'\n'.join('- '+x for x in changes)+'\n\n## Review\n\nRepeated still and Studio checks covered title timing, spacing, node emergence and encryption materials. TypeScript and ESLint pass. Native homepage keyframes remain unchanged. Camera-clock joins are continuous and monotonic. Sampled full-film handoffs match, with only subpixel antialiasing difference at CRM to Scenarios. Logo holds exactly 150 frames and the last frame is black. No encoded-video review was performed because no video was exported.\n\n## Restore\n\nThe complete source archive is here. Revision 21 and before-refinement22 remain separately saved. Extract into a separate folder, run npm ci, then npm run dev.\n'
(dest/'README.md').write_text(readme)
(root/'REVISION22.md').write_text(readme)
add={f.relative_to(root).as_posix():f for f in (root/'src').rglob('*') if f.is_file()}
for f in [root/'REVISION22.md',root/'scripts/check-refinement22.cjs',root/'scripts/package-refinement22.py']+list((root/'review').glob('refinement22*.json')):
 add[f.relative_to(root).as_posix()]=f
for comp,frames in shots.items():
 for frame in frames:
  f=p/f'{comp}-{frame}.png';add[f.relative_to(root).as_posix()]=f
add['nodemere-scenes-1-12-metadata.json']=dest/'nodemere-scenes-1-12-metadata.json'
archive=dest/'nodemere-scenes-1-12-source.zip'
with zipfile.ZipFile(prev/'nodemere-scenes-1-12-source.zip') as old,zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as new:
 for item in old.infolist():
  if item.filename not in add:new.writestr(item,old.read(item.filename))
 for name,f in add.items():new.write(f,name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for f in (root/'src').rglob('*'):
  if f.is_file():assert z.read(f.relative_to(root).as_posix())==f.read_bytes()
 hashes={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
(dest/'source-hashes.json').write_text(json.dumps(hashes,indent=2))
(dest/'review').mkdir(exist_ok=True)
for f in (root/'review').glob('refinement22*.json'):shutil.copy2(f,dest/'review'/f.name)
for name in ['nodemere-scenes-1-12-source.zip','nodemere-scenes-1-12-metadata.json']:shutil.copy2(dest/name,out/name)
indexpath=out/'versions/index.json';index=json.loads(indexpath.read_text())
index['current']=index['currentStudioRevision']=revision
index['versions']=[v for v in index['versions'] if v['id']!=revision]+[{'id':revision,'frames':17691,'seconds':294.85,'description':'White-to-white node emergence, delayed and balanced headline effects, later collection hero, matte-black encryption and pink-purple core.','videoExported':False}]
indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps({'revision':revision,'archiveBytes':archive.stat().st_size,'crcVerified':True,'sourceMatches':True,'videoExported':False},indent=2))
