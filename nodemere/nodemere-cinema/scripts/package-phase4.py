"""Package the complete film with prepared local assets and verify every source."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import argparse
p=argparse.ArgumentParser();p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];a.destination.mkdir(parents=True,exist_ok=True)
files=list((root/'src').rglob('*'))
for directory in ['fonts','audition','videos/v4-directed','phase3','phase4']:
 files+=list((root/'public'/directory).rglob('*'))
files+=list((root/'public/catalog').glob('*.png'))
files+=[root/'public/catalog/4-portrait.mp4',root/'public/catalog/collection-field-directed-v4.jpg']
files+=[root/f'public/videos/{identity}-source.mp4' for identity in [12,8,3,7,4,6]]
files+=list((root/'scripts').glob('*.py'))+list((root/'scripts').glob('*.cjs'))
files+=list(root.glob('*.md'))
files+=[root/name for name in ['package.json','package-lock.json','tsconfig.json','remotion.config.ts','eslint.config.mjs','.gitignore']]
target=a.destination/'nodemere-scenes-1-10-source.zip'
assert not target.exists(),'Never overwrite a delivered source archive'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
 for file in sorted(set(files)):
  if file.is_file() and '__pycache__' not in file.parts:z.write(file,file.relative_to(root))
 z.write(a.destination/'nodemere-scenes-1-10-metadata.json','nodemere-scenes-1-10-metadata.json')
with ZipFile(target) as z:
 assert z.testzip() is None
 for name in ['src/FullFilm.tsx','src/PeopleScene.tsx','src/ScenariosScene.tsx','src/NestScene.tsx','src/product/phase4/native.css','public/phase4/provenance.json','public/phase4/piper-banner.png','PHASE4.md','QA-PHASE4.md']:
  assert name in z.namelist(),name
 for name in z.namelist():
  if name.startswith('src/'):assert z.read(name)==(root/name).read_bytes(),name
 print(f'Verified {len(z.namelist())} files, {target.stat().st_size:,} bytes: {target}')
