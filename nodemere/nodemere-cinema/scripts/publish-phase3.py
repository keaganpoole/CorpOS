"""Publish only a reviewed release, preserving all older releases and their hashes."""
from pathlib import Path
from zipfile import ZipFile
import argparse,json,hashlib,shutil
parser=argparse.ArgumentParser();parser.add_argument('--release',type=Path,required=True);parser.add_argument('--delivery',type=Path,required=True);parser.add_argument('--review',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
checks=json.loads((args.review/'checks.json').read_text(encoding='utf-8'))
assert checks['decoded_frames']==7176 and not checks['unexpected_black_frames'] and not checks['blank_piper_regions']
meta=json.loads((args.release/'nodemere-scenes-1-7-metadata.json').read_text(encoding='utf-8'));assert(meta['width'],meta['height'],meta['frames'])==(1920,1080,7176)
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
for folder in ['05-salon-swing','before-phase3']:
 prior=args.delivery/'versions'/folder
 for name,info in json.loads((prior/'restore-manifest.json').read_text(encoding='utf-8')).items():assert sha(prior/name)==info['sha256'],name
with ZipFile(args.release/'nodemere-scenes-1-7-source.zip') as z:
 assert z.testzip() is None
 for name in z.namelist():
  if name.startswith('src/'):assert z.read(name)==(root/name).read_bytes(),name
for name in ['PHASE3.md','QA-PHASE3.md','VERSIONS.md']:shutil.copy2(root/name,args.release/name)
for name in ['source-checks.json','scope-checks.json','geometry-clearance.json','bridge-checks.json']:shutil.copy2(root/'review/phase3'/name,args.release/name)
shutil.copy2(args.review/'checks.json',args.release/'encoded-checks.json')
for name in ['builder.jpg','network.jpg','handoff.jpg']:shutil.copy2(args.review/name,args.release/f'review-{name}')
manifest={p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in args.release.iterdir() if p.is_file() and p.name!='restore-manifest.json'}
(args.release/'restore-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
index_path=args.delivery/'versions/index.json';index=json.loads(index_path.read_text(encoding='utf-8'))
assert not any(v['id']=='06-network-handoff' for v in index['versions'])
index['current']='06-network-handoff';index['versions'].append({'id':'06-network-handoff','seconds':119.6,'description':'Native Drop-ins Builder, Piper conversation network, live staff handoff; scenes 1–7'})
index_path.write_text(json.dumps(index,indent=2),encoding='utf-8')
for name in ['nodemere-scenes-1-7-preview.mp4','nodemere-scenes-1-7-source.zip','nodemere-scenes-1-7-metadata.json']:
 shutil.copy2(args.release/name,args.delivery/name);assert sha(args.delivery/name)==manifest[name]['sha256']
print('Release verified and published. Revision05 and pre-edit snapshot remain unchanged.')
