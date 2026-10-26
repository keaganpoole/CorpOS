"""Copy authentic UI styles/data and cache public, already-used product media."""
from pathlib import Path
import concurrent.futures, hashlib, importlib.util, json, re, shutil, urllib.request

root=Path(__file__).resolve().parents[1]
product=root.parent
assets=root/'public/phase3'; assets.mkdir(exist_ok=True)
for source in ['pages/dropInsPage.css','components/dropInPreview.css']:
    shutil.copy2(product/'src/sonar'/source,root/'src/product'/Path(source).name)
spec=importlib.util.spec_from_file_location('film_templates',product/'backend/drop_in_templates.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
(root/'src/product/dropInTemplates.json').write_text(json.dumps(module.TEMPLATES,indent=2))
source=(product/'src/components/IntercomShowcase.jsx').read_text(encoding='utf-8')
urls=re.findall(r"'(https://images.unsplash.com/[^']+)'",source.split('const USER_AVATARS = [')[1].split('];')[0])[:16]
entries=[(f'customer-{i:02}.jpg',u.replace('w=160','w=640')) for i,u in enumerate(urls)]
entries.append(('piper-source.mp4','https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/videos/piper_video.mp4'))
def fetch(entry):
    name,url=entry; target=assets/name
    if not target.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'Nodemere-Film-Asset-Preparation/1.0'})
        with urllib.request.urlopen(req,timeout=90) as response: target.write_bytes(response.read())
    return {'file':name,'source':url,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: manifest=list(pool.map(fetch,entries))
(assets/'provenance.json').write_text(json.dumps(manifest,indent=2))
print(f'Prepared {len(manifest)} original media assets, native styles and template definitions.')
