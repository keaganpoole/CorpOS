from pathlib import Path
from zipfile import ZipFile
import json,hashlib
root=Path.cwd();product=root.parent
old=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs\versions\08-people-scenarios-nest\nodemere-scenes-1-10-source.zip')
changed=[]
with ZipFile(old) as z:
 for name in z.namelist():
  if name.startswith('src/') and z.read(name)!=(root/name).read_bytes(): changed.append(name)
assert sorted(changed)==['src/NestScene.tsx','src/ScenariosScene.tsx'],changed
native=[]
for provenance in ['src/product/phase4/provenance.json','src/product/phase4/refinement-provenance.json']:
 for item in json.loads((root/provenance).read_text(encoding='utf-8-sig')):
  f=product/item['source'];assert hashlib.sha256(f.read_bytes()).hexdigest()==item['sha256'],item['source'];native.append(item['source'])
tables=json.loads((root/'src/product/phase4/refinement-tables.json').read_text())
assert len(tables)==8 and sum(len(t['fields']) for t in tables)==122
result={'changed_existing_source_files':changed,'native_product_hashes_verified':len(set(native)),'table_categories':{t['label']:len(t['fields']) for t in tables},'earlier_scene_source':'byte-identical to revision08'}
(root/'review/refinement09/source-check.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
