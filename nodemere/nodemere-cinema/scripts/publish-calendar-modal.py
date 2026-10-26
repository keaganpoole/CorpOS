"""Publish revision07 after source, visual and encoded review; retain all prior releases."""
from pathlib import Path
from zipfile import ZipFile
import json,hashlib,shutil,argparse
p=argparse.ArgumentParser();p.add_argument('--delivery',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];release=a.delivery/'versions/07-calendar-dropins';review=root/'review/calendar-modal'
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
checks=json.loads((review/'encoded/checks.json').read_text(encoding='utf-8'))
assert checks['decoded_frames']==7176 and not checks['unexpected_black_frames'] and not checks['blank_piper_regions']
source=json.loads((review/'source-checks.json').read_text(encoding='utf-8'));assert source['existing_sources_changed']==['src/DropInsScene.tsx']
for folder in ['06-network-handoff','before-calendar-modal']:
 prior=a.delivery/'versions'/folder
 for name,info in json.loads((prior/'restore-manifest.json').read_text(encoding='utf-8')).items():assert sha(prior/name)==info['sha256'],name
with ZipFile(release/'nodemere-scenes-1-7-source.zip') as archive:
 assert archive.testzip() is None
 for name in ['src/product/CalendarDropInsFilm.jsx','src/product/calendar-modal/scoped.css','CALENDAR-MODAL.md','QA-CALENDAR-MODAL.md']:assert name in archive.namelist()
 for name in archive.namelist():
  if name.startswith('src/'):assert archive.read(name)==(root/name).read_bytes(),name
meta=json.loads((release/'nodemere-scenes-1-7-metadata.json').read_text(encoding='utf-8'))
assert(meta['width'],meta['height'],meta['frames'],meta['full_decode'])==(1920,1080,7176,'passed')
assert sha(release/'nodemere-scenes-1-7-preview.mp4')==meta['sha256']
for name in ['CALENDAR-MODAL.md','QA-CALENDAR-MODAL.md','VERSIONS.md']:shutil.copy2(root/name,release/name)
shutil.copy2(review/'source-checks.json',release/'source-checks.json')
shutil.copy2(review/'encoded/checks.json',release/'encoded-checks.json')
shutil.copy2(review/'encoded/builder.jpg',release/'review-calendar-builder.jpg')
manifest={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in release.iterdir() if f.is_file() and f.name!='restore-manifest.json'}
(release/'restore-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
index_path=a.delivery/'versions/index.json';index=json.loads(index_path.read_text(encoding='utf-8'))
assert not any(v['id']=='07-calendar-dropins' for v in index['versions'])
index['current']='07-calendar-dropins';index['versions'].append({'id':'07-calendar-dropins','seconds':119.6,'description':'Scene5 corrected to the Calendar Drop-ins modal; all other scenes preserved.'})
index_path.write_text(json.dumps(index,indent=2),encoding='utf-8')
for name in ['nodemere-scenes-1-7-preview.mp4','nodemere-scenes-1-7-source.zip','nodemere-scenes-1-7-metadata.json']:
 shutil.copy2(release/name,a.delivery/name);assert sha(a.delivery/name)==manifest[name]['sha256']
print('Published verified revision07. Revision06 and pre-edit snapshot remain unchanged.')
