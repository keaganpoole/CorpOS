"""Verify and publish revision 05 only after render and encoded review pass."""
from pathlib import Path
from zipfile import ZipFile
import argparse, json, hashlib, shutil
parser=argparse.ArgumentParser()
parser.add_argument('--release',type=Path,required=True)
parser.add_argument('--delivery',type=Path,required=True)
parser.add_argument('--review',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
checks=json.loads((args.review/'checks.json').read_text())
assert checks['decoded_frames']==3558 and not checks['unexpected_black_frames'] and not checks['blank_conversation_video_regions']
metadata=json.loads((args.release/'nodemere-scenes-1-4-metadata.json').read_text())
assert metadata['width']==1920 and metadata['height']==1080 and metadata['frames']==3558
with ZipFile(args.release/'nodemere-scenes-1-4-source.zip') as archive:
    assert archive.testzip() is None
    for name in ['src/RevisionFour.tsx','src/CalendarScene.tsx','src/AuditionScene.tsx','PHASE2.md','QA-PHASE2.md']:
        assert archive.read(name)==(root/name).read_bytes(),name
previous=args.delivery/'versions/04-continuous-nikki'
for name,info in json.loads((previous/'restore-manifest.json').read_text()).items():
    assert hashlib.sha256((previous/name).read_bytes()).hexdigest()==info['sha256'],name
for name in ['PHASE2.md','QA-PHASE2.md','VERSIONS.md']:
    shutil.copy2(root/name,args.release/name)
for name in ['source-checks.json','camera-checks.json']:
    shutil.copy2(root/'review/revision05'/name,args.release/name)
shutil.copy2(args.review/'checks.json',args.release/'encoded-checks.json')
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in args.release.iterdir() if p.is_file() and p.name!='restore-manifest.json'}
(args.release/'restore-manifest.json').write_text(json.dumps(manifest,indent=2))
index_path=args.delivery/'versions/index.json'
index=json.loads(index_path.read_text())
assert not any(v['id']=='05-salon-swing' for v in index['versions'])
index['current']='05-salon-swing'
index['versions'].append({'id':'05-salon-swing','seconds':59.3,'description':'Faster eased calendar swing, salon appointments, left-column accents and full personality hover pass'})
index_path.write_text(json.dumps(index,indent=2))
for name in ['nodemere-scenes-1-4-preview.mp4','nodemere-scenes-1-4-source.zip','nodemere-scenes-1-4-metadata.json']:
    shutil.copy2(args.release/name,args.delivery/name)
    assert hashlib.sha256((args.delivery/name).read_bytes()).hexdigest()==manifest[name]['sha256']
print('Verified source archive, previous release integrity, new restore manifest and latest delivery copies.')
