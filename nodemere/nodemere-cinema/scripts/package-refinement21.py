from pathlib import Path
import json, zipfile, hashlib, shutil
root=Path.cwd()
out=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs')
revision='21-headlines-network-choreography'
prev=out/'versions'/'20-builder-teams-indicators'
dest=out/'versions'/revision
dest.mkdir(exist_ok=True)
changes=[
 'First collection hero: Deploy the world’s most advanced AI receptionist. Existing collection choice hero moves to the second pan.',
 'Calendar dots delayed 0.3 seconds; reschedule border uses the exact homepage gradient keyframes and 4.8-second cycle, with existing sweeps retained.',
 'Added 24/7 Call Handling with exact homepage description and centered 2 AM indicators, then Document Uploads with document icons.',
 'CRM Stunning word uses the homepage prism animation layers, keyframes and timing, driven by film frames.',
 'White intro push flows into the existing close node sweep, then resumes the original builder choreography and later pullback.',
 'Added Talk with your receptionist and the Nodemere Intercom label before live conversations.',
 'Added the Nodemere Encryption label above the encryption hero.',
 'Added Welcome to the future of the front desk before the tree, with the homepage gradient on future.',
 'Nest notifications cycle faster; calendar-ready message replaced by a received appointment deposit; live conversation banners slightly darker.'
]
checks=json.loads((root/'review/refinement21-checks.json').read_text())
checks['handoffs']=json.loads((root/'review/refinement21-handoffs.json').read_text())
checks['studioError']=None
checks['lint']='passed'
shots={}
for name in ['refinement21-shots.json','refinement21-second.json','refinement21-final.json','refinement21-transition.json']:
 for comp,frames in json.loads((root/'review'/name).read_text()).items():
  shots.setdefault(comp,set()).update(frames)
# Exclude superseded exploratory frames from the approved review set.
shots['09-Scenarios']=set(json.loads((root/'review/refinement21-second.json').read_text())['09-Scenarios'])
shots['04-Calendar']={800,860,920}
shots.get('Nodemere-Opening',set()).discard(705)
p=root/'review/finale/stills'
shots={k:sorted(f for f in v if (p/f'{k}-{f}.png').exists()) for k,v in shots.items()}
(root/'review/refinement21-approved.json').write_text(json.dumps(shots,indent=2))
checks['savedReviewFrameCount']=sum(map(len,shots.values()))
(root/'review/refinement21-checks.json').write_text(json.dumps(checks,indent=2))
meta=json.loads((prev/'nodemere-scenes-1-12-metadata.json').read_text())
meta.update(revision=revision,previousStudioRevision=prev.name,frames=17631,seconds=17631/60,changes=changes)
meta['scene11']['startFrame']=16295
meta['scene12']['startFrame']=17045
meta.pop('logoSizeFactorVsPrevious',None)
meta['review']={'lint':'passed','frameReview':'Repeated representative still review and Studio playback, including corrected transition frames. No encoded video produced.','checks':checks,'videoExported':False}
(dest/'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(meta,indent=2))
readme='# Revision 21 — Headlines, network and choreography\n\nPreview in Remotion Studio: http://localhost:3100/Nodemere-Film\n\nNo video was exported. Production application source was not modified.\n\n## Changes\n\n'+'\n'.join('- '+x for x in changes)+'\n\n## Review\n\n- ESLint and TypeScript pass.\n- Reviewed representative native PNGs and Studio playback in multiple passes.\n- Corrected hidden nodes during the added Scenarios sweep, a CSS rule suppressing the calendar gradient, and an overlapping black title surface clipping the tree reveal.\n- Homepage CRM and border keyframes match their source.\n- Collection timeline is monotonic with continuous joins.\n- Four sampled scene boundaries are pixel-identical; the tree-to-handoff boundary differs by only 0.0000023 mean RGB levels.\n- Final logo hold remains 150 frames; its boundary frames are pixel-identical; final full-film frame is pure black.\n- Film duration: 17,631 frames / 293.85 seconds at 60 fps.\n\n## Restore\n\nThe complete prepared source archive is saved here. Revision 20 remains separately available in 20-builder-teams-indicators and before-refinement21. Extract into a separate directory, run npm ci, then npm run dev. The archive includes the current source and supporting assets.\n'
(dest/'README.md').write_text(readme)
(root/'REVISION21.md').write_text(readme)
add={f.relative_to(root).as_posix():f for f in (root/'src').rglob('*') if f.is_file()}
for f in [root/'REVISION21.md',root/'scripts/check-refinement21.cjs',root/'scripts/package-refinement21.py']+list((root/'review').glob('refinement21*.json')):
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
for f in (root/'review').glob('refinement21*.json'):shutil.copy2(f,dest/'review'/f.name)
for name in ['nodemere-scenes-1-12-source.zip','nodemere-scenes-1-12-metadata.json']:shutil.copy2(dest/name,out/name)
indexpath=out/'versions/index.json';index=json.loads(indexpath.read_text())
index['current']=index['currentStudioRevision']=revision
index['versions']=[v for v in index['versions'] if v['id']!=revision]+[{'id':revision,'frames':17631,'seconds':293.85,'description':'New heroes and tree capabilities, native homepage animation, reordered Scenarios sweep, faster Nest and darker banners.','videoExported':False}]
indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps({'revision':revision,'archiveBytes':archive.stat().st_size,'crcVerified':True,'sourceMatches':True,'videoExported':False},indent=2))
