from pathlib import Path
import json,zipfile,hashlib,shutil
from PIL import Image,ImageChops,ImageStat
root=Path.cwd()
out=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs')
revision='20-builder-teams-indicators'
prev=out/'versions'/'19-opening-portrait-corrections'
dest=out/'versions'/revision;dest.mkdir(exist_ok=True)
changes=[
'Removed the Scenarios bottom toolbar and Stripe disclaimer.',
'Variables pane holds for 1.35 seconds before touring tables; clicked rows have no solid strip; table headers and form chips retained.',
'Replaced Send Email with Update Person / Flag missing contact details on the no-contact branch.',
'Intro node holds the CTA, then rapidly pushes into its white surface before the selection menu.',
'Teams: Maggie inbound, Kayla outbound, Bonnie off; active videos play; native role font, spacing and directional icons.',
'Nest camera position, scale and tilt stay fixed after the entrance.',
'Final logo is 40% smaller; native ripple and exact 150-frame hold unchanged.',
'Tree flags and feature icons are centered, enlarged and backed by dimmed portraits.',
'Conversation containers enter first, followed by overlapping label and dialogue reveals.',
'Added matching small Nodemere Audition, Collection, Drop Ins and Scenarios labels above their existing heroes.'
]
meta=json.loads((prev/'nodemere-scenes-1-12-metadata.json').read_text())
meta.update(revision=revision,previousStudioRevision='19-opening-portrait-corrections',changes=changes)
checks=json.loads((root/'review/refinement20-checks.json').read_text())
p=root/'review/finale/stills'
checks['logoHoldPixelIdentical']=Image.open(p/'12-Final-Logo-144.png').tobytes()==Image.open(p/'12-Final-Logo-293.png').tobytes()
checks['fullFilmFinalFrameBlack']=Image.open(p/'Nodemere-Film-17001.png').convert('RGB').getbbox() is None
assert checks['logoHoldPixelIdentical'] and checks['fullFilmFinalFrameBlack']
a=Image.open(p/'10-Nest-220.png').convert('RGB');b=Image.open(p/'10-Nest-275.png').convert('RGB')
checks['teamsVideoReview']={}
for name,box in [('Maggie',(270,320,600,570)),('Kayla',(650,320,990,570)),('Bonnie',(1035,320,1365,570))]:
 delta=sum(ImageStat.Stat(ImageChops.difference(a.crop(box),b.crop(box))).mean)/3
 checks['teamsVideoReview'][name]=delta
 assert (delta>0) if name!='Bonnie' else delta==0
shots={}
for file in ['refinement20-shots.json','refinement20-second.json','refinement20-final.json','refinement20-handoff.json','refinement20-full-film.json']:
 for comp,frames in json.loads((root/'review'/file).read_text()).items():
  shots.setdefault(comp,set()).update(f for f in frames if (p/f'{comp}-{f}.png').exists())
checks['reviewedStillCount']=sum(map(len,shots.values()))
meta['review']={'lint':'passed','frameReview':'Two visual passes in native stills and Studio; representative boundaries reviewed in full film','checks':checks,'videoExported':False}
meta['logoSizeFactorVsPrevious']=.6
(root/'review/refinement20-checks.json').write_text(json.dumps(checks,indent=2))
(dest/'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(meta,indent=2))
readme='# Revision 20 — Builder, Teams and indicator refinements\n\nStudio preview only. No video was exported. Production application files were not modified.\n\n## Changes\n\n'+'\n'.join('- '+x for x in changes)+'\n\n## Review\n\n- ESLint and TypeScript pass.\n- '+str(checks['reviewedStillCount'])+' representative native PNG frames reviewed across the changed scenes and handoffs.\n- Studio playback of Scenarios completed without an error overlay.\n- Nest transform is identical for all 3,342 frames after its entrance.\n- Maggie and Kayla frame crops change; Bonnie is pixel-identical.\n- Logo hold boundary frames are identical; native ripple path checks pass; final full-film frame is black.\n- No claim of a full encoded-video review: no video export was requested or made.\n\n## Restore\n\nThis folder contains the complete prepared source archive. The prior revision remains separately saved under 19-opening-portrait-corrections, with a second before-refinement20 backup. Restore into a separate folder to compare safely; install dependencies with npm ci and use npm run dev.\n'
(dest/'README.md').write_text(readme)
(root/'REVISION20.md').write_text(readme)
reviewdest=dest/'review';reviewdest.mkdir(exist_ok=True)
add={}
for f in root.glob('src/**/*'):
 if f.is_file():add[f.relative_to(root).as_posix()]=f
for f in [root/'REVISION20.md',root/'scripts/check-refinement20.cjs']+list((root/'review').glob('refinement20*')):
 if f.is_file():add[f.relative_to(root).as_posix()]=f
for comp,frames in shots.items():
 for frame in frames:
  f=p/f'{comp}-{frame}.png';add[f.relative_to(root).as_posix()]=f
for f in (root/'review').glob('refinement20*'):
 if f.is_file():shutil.copy2(f,reviewdest/f.name)
add['nodemere-scenes-1-12-metadata.json']=dest/'nodemere-scenes-1-12-metadata.json'
archive=dest/'nodemere-scenes-1-12-source.zip'
with zipfile.ZipFile(prev/'nodemere-scenes-1-12-source.zip') as old,zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as new:
 for item in old.infolist():
  if item.filename not in add:new.writestr(item,old.read(item.filename))
 for name,file in add.items():new.write(file,name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for f in root.glob('src/**/*'):
  if f.is_file():assert z.read(f.relative_to(root).as_posix())==f.read_bytes()
 hashes={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
(dest/'source-hashes.json').write_text(json.dumps(hashes,indent=2))
for name in ['nodemere-scenes-1-12-source.zip','nodemere-scenes-1-12-metadata.json']:shutil.copy2(dest/name,out/name)
indexpath=out/'versions/index.json';index=json.loads(indexpath.read_text())
index['current']=index['currentStudioRevision']=revision
index['versions']=[v for v in index['versions'] if v['id']!=revision]+[{'id':revision,'frames':17002,'seconds':17002/60,'description':'Builder cleanup and white push, native Teams roles/videos, fixed Nest, centered indicators, delayed conversation text, hero labels and smaller logo.','videoExported':False}]
indexpath.write_text(json.dumps(index,indent=2))
print(json.dumps({'revision':revision,'archiveBytes':archive.stat().st_size,'crcVerified':True,'sourceMatches':True,'reviewedFrames':checks['reviewedStillCount'],'videoExported':False},indent=2))
