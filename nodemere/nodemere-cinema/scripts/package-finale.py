"""Create a complete reversible Studio release. Never exports or replaces a video."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse, hashlib, json, shutil

p=argparse.ArgumentParser()
p.add_argument('--destination',type=Path,required=True)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
a.destination.mkdir(parents=True,exist_ok=True)
target=a.destination/'nodemere-scenes-1-12-source.zip'
assert not target.exists(),'Never overwrite a delivered source archive'
metadata={
 'revision':'13-encryption-brand-finale','delivery':'Remotion Studio; no video export',
 'composition':'Nodemere-Film','url':'http://localhost:3100/Nodemere-Film',
 'width':3840,'height':2160,'fps':60,'frames':16765,'seconds':16765/60,
 'scene11':{'startFrame':15246,'frames':960},
 'scene12':{'startFrame':16206,'frames':559,'holdStart':144,'holdEndExclusive':294,'holdFrames':150},
 'logoAnimation':{'id':'braking','name':'Perimeter · decelerate','source':'Native logoPresets.js; original animated page at commit 64109a8'},
 'claim':'Built with AES-256-GCM encryption and per-business key protection.',
 'previousStudioRevision':'12-b2c-intercom','lastVideoExport':'10-scenarios-logic-nest-hover',
 'videoExported':False,'productionAppChanged':False,
}
(a.destination/'nodemere-scenes-1-12-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
files=list((root/'src').rglob('*'))
for directory in ['fonts','audition','videos/v4-directed','phase3','phase4','finale']:
 files+=list((root/'public'/directory).rglob('*'))
files+=list((root/'public/catalog').glob('*.png'))
files+=[root/'public/catalog/4-portrait.mp4',root/'public/catalog/collection-field-directed-v4.jpg']
files+=[root/f'public/videos/{identity}-source.mp4' for identity in [12,8,3,7,4,6]]
files+=list((root/'scripts').glob('*.py'))+list((root/'scripts').glob('*.cjs'))
files+=list(root.glob('*.md'))
files+=list((root/'review/finale').rglob('*.png'))+list((root/'review/finale').rglob('*.jpg'))
files+=[root/'review/finale/verification.json']
files+=[root/name for name in ['package.json','package-lock.json','tsconfig.json','remotion.config.ts','eslint.config.mjs','.gitignore']]
files=sorted({f for f in files if f.is_file() and '__pycache__' not in f.parts})
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
 for file in files:z.write(file,file.relative_to(root))
 z.write(a.destination/'nodemere-scenes-1-12-metadata.json','nodemere-scenes-1-12-metadata.json')
with ZipFile(target) as z:
 assert z.testzip() is None
 for file in files:assert z.read(file.relative_to(root).as_posix())==file.read_bytes(),file
 manifest={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
(a.destination/'source-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
for name in ['FINALE.md','QA-FINALE.md','VERSIONS.md']:
 shutil.copy2(root/name,a.destination/name)
shutil.copytree(root/'review/finale/stills',a.destination/'review-stills',dirs_exist_ok=True)
shutil.copy2(root/'review/finale/contact-sheet.jpg',a.destination/'contact-sheet.jpg')
shutil.copy2(root/'review/finale/verification.json',a.destination/'verification.json')
(a.destination/'README.md').write_text('''# Revision 13 — final scenes

Open http://localhost:3100/Nodemere-Film in Remotion Studio. The ending begins
at frame 15246 (4:14.10). No video was exported for this update.

Restore: extract `nodemere-scenes-1-12-source.zip` into a fresh sibling folder,
run `npm ci`, then `npm run dev` on an available port. Do not overlay a prior release
onto the working project. This archive includes prepared local media.

Previous prepared source remains in `../before-final-scenes/prepared-source.zip`.
Revision 12 is the preceding Studio version; revision 10 is the last exported MP4.
See FINALE.md for claim verification and the exact selected logo animation.
''',encoding='utf-8')
print(f'Verified {len(files)} packaged files against current bytes; {target.stat().st_size:,} bytes: {target}')
