"""Publish only a reviewed release; retain all previous releases unchanged."""
from pathlib import Path
from zipfile import ZipFile
import argparse,json,hashlib,shutil
p=argparse.ArgumentParser();p.add_argument('--delivery',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];release=a.delivery/'versions/08-people-scenarios-nest';review=root/'review/phase4'
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
checks=json.loads((review/'encoded/checks.json').read_text())
assert checks['decoded_frames']==14766 and not checks['unexpected_black_frames'] and not checks['blank_intercom_avatar_regions']
source=json.loads((review/'source-checks.json').read_text())
assert sorted(source['existing_sources_changed'])==['src/FullFilm.tsx','src/Root.tsx']
native=json.loads((review/'native-animation-checks.json').read_text())
assert native['native_keyframes_preserved']==58 and not native['unscoped_selectors']
comparison=json.loads((review/'native-encoded-comparison.json').read_text())
assert len(comparison['samples'])==9
assert max(s['mean_rgb_absolute_error_out_of_255'] for s in comparison['samples'])<2
for record in json.loads((root/'src/product/phase4/provenance.json').read_text()):
 assert sha(root.parent/record['source'])==record['sha256'],record['source']
for folder in ['07-calendar-dropins','before-phase4']:
 prior=a.delivery/'versions'/folder
 for name,info in json.loads((prior/'restore-manifest.json').read_text()).items():assert sha(prior/name)==info['sha256'],name
with ZipFile(release/'nodemere-scenes-1-10-source.zip') as z:
 assert z.testzip() is None
 for name in z.namelist():
  if name.startswith('src/'):assert z.read(name)==(root/name).read_bytes(),name
meta=json.loads((release/'nodemere-scenes-1-10-metadata.json').read_text())
assert(meta['width'],meta['height'],meta['frames'],meta['full_decode'])==(1920,1080,14766,'passed')
assert sha(release/meta['file'])==meta['sha256']
for name in ['PHASE4.md','QA-PHASE4.md','VERSIONS.md']:shutil.copy2(root/name,release/name)
for name in ['source-checks.json','native-animation-checks.json','native-encoded-comparison.json']:shutil.copy2(review/name,release/name)
shutil.copy2(review/'encoded/checks.json',release/'encoded-checks.json')
for name in ['people','scenarios','nest','handoff-people','people-scenarios','scenarios-nest','nest-intercom']:
 shutil.copy2(review/f'encoded/{name}.jpg',release/f'review-{name}.jpg')
manifest={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in release.iterdir() if f.is_file() and f.name!='restore-manifest.json'}
assert not (release/'restore-manifest.json').exists(),'Published releases are immutable'
(release/'restore-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
index_path=a.delivery/'versions/index.json';index=json.loads(index_path.read_text())
assert not any(v['id']=='08-people-scenarios-nest' for v in index['versions'])
index['current']='08-people-scenarios-nest';index['versions'].append({'id':'08-people-scenarios-nest','seconds':246.1,'description':'Native People CRM, Scenarios Builder and Nest/Intercom; scenes 1-7 preserved.'})
index_path.write_text(json.dumps(index,indent=2),encoding='utf-8')
for name in ['nodemere-scenes-1-10-preview.mp4','nodemere-scenes-1-10-source.zip','nodemere-scenes-1-10-metadata.json']:
 shutil.copy2(release/name,a.delivery/name);assert sha(a.delivery/name)==manifest[name]['sha256']
print('Published verified revision08. Previous releases and pre-edit snapshot remain unchanged.')
