"""Publish an immutable, reviewed film release and update the convenient current copies."""
from pathlib import Path
from zipfile import ZipFile
import argparse,json,hashlib,shutil
p=argparse.ArgumentParser();p.add_argument('--delivery',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1]
release=a.delivery/'versions/10-scenarios-logic-nest-hover';review=root/'review/refinement10'
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
checks=json.loads((review/'encoded/checks.json').read_text());assert checks['decoded_frames']==15246 and not checks['unexpected_black_frames']
source=json.loads((review/'source-check.json').read_text());assert sorted(source['changed_existing_source_files'])==['src/NestScene.tsx','src/PeopleScene.tsx','src/ScenariosScene.tsx','src/product/phase4/ScenarioRefinement.jsx']
comparison=json.loads((review/'encoded-comparison.json').read_text());assert max(c['mean_rgb_absolute_error'] for c in comparison)<2
for name in ['09-scenarios-nest-refinement','before-refinement10']:
 prior=a.delivery/'versions'/name
 for f,info in json.loads((prior/'restore-manifest.json').read_text()).items():assert sha(prior/f)==info['sha256'],f
for provenance in ['provenance.json','refinement-provenance.json']:
 for record in json.loads((root/'src/product/phase4'/provenance).read_text(encoding='utf-8-sig')):assert sha(root.parent/record['source'])==record['sha256']
with ZipFile(release/'nodemere-scenes-1-10-source.zip') as z:
 assert z.testzip() is None
 for name in z.namelist():
  if name.startswith('src/'):assert z.read(name)==(root/name).read_bytes(),name
meta=json.loads((release/'nodemere-scenes-1-10-metadata.json').read_text());assert(meta['width'],meta['height'],meta['frames'],meta['full_decode'])==(1920,1080,15246,'passed');assert sha(release/meta['file'])==meta['sha256']
for name in ['REFINEMENT10.md','QA-REFINEMENT10.md','VERSIONS.md']:shutil.copy2(root/name,release/name)
for name in ['source-check.json','prefix.json','encoded-comparison.json','behavior-check.json']:shutil.copy2(review/name,release/name)
shutil.copy2(review/'encoded/checks.json',release/'encoded-checks.json')
for name in ['scenarios','nest','native-intro','workflow-growth','dashboard-nest-zoom','scenarios-nest-handoff','invoice-insertion','people-scenarios-handoff']:shutil.copy2(review/f'encoded/{name}.jpg',release/f'review-{name}.jpg')
manifest={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in release.iterdir() if f.is_file() and f.name!='restore-manifest.json'}
assert not (release/'restore-manifest.json').exists();(release/'restore-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
index_path=a.delivery/'versions/index.json';index=json.loads(index_path.read_text());assert not any(v['id']=='10-scenarios-logic-nest-hover' for v in index['versions'])
index['current']='10-scenarios-logic-nest-hover';index['versions'].append({'id':'10-scenarios-logic-nest-hover','seconds':254.1,'description':'Six-node salon billing workflow; corrected native configuration form and node-first connections; continuous title handoff and steady Nest camera. Scenes 1-7 preserved.'});index_path.write_text(json.dumps(index,indent=2))
for name in ['nodemere-scenes-1-10-preview.mp4','nodemere-scenes-1-10-source.zip','nodemere-scenes-1-10-metadata.json']:
 shutil.copy2(release/name,a.delivery/name);assert sha(a.delivery/name)==manifest[name]['sha256']
print('Published revision10; revision09 and its pre-edit snapshot verified unchanged.')
