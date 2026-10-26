"""Create a verified, self-contained source release with the prepared original media."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--destination',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];args.destination.mkdir(parents=True,exist_ok=True)
files=list((root/'src').rglob('*'))
for directory in ['fonts','audition','videos/v4-directed','phase3']:files+=list((root/'public'/directory).rglob('*'))
files+=list((root/'public/catalog').glob('*.png'))
files += [root/'public/catalog/4-portrait.mp4',root/'public/catalog/collection-field-directed-v4.jpg']
files += [root/f'public/videos/{identity}-source.mp4' for identity in [12,8,3,7,4,6]]
files += list((root/'scripts').glob('*.py'))+list((root/'scripts').glob('*.cjs'))
files += [root/'CALENDAR-MODAL.md',root/'QA-CALENDAR-MODAL.md']
files += [root/name for name in ['package.json','package-lock.json','tsconfig.json','remotion.config.ts','eslint.config.mjs','.gitignore','AGENTS.md','README.md','QA.md','PHASE2.md','QA-PHASE2.md','PHASE3.md','QA-PHASE3.md','VERSIONS.md']]
target=args.destination/'nodemere-scenes-1-7-source.zip'
assert not target.exists(),'Release source must not be overwritten'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=6) as archive:
 for file in sorted(set(files)):
  if file.is_file() and '__pycache__' not in file.parts:archive.write(file,file.relative_to(root))
 archive.write(args.destination/'nodemere-scenes-1-7-metadata.json','nodemere-scenes-1-7-metadata.json')
with ZipFile(target) as archive:
 assert archive.testzip() is None
 names=set(archive.namelist())
 for name in ['src/FullFilm.tsx','src/DropInsScene.tsx','src/NetworkScene.tsx','src/HandoffScene.tsx','src/product/DropInsFilm.jsx','public/phase3/piper-loop.mp4','public/phase3/provenance.json','PHASE3.md','QA-PHASE3.md']:
  assert name in names,name
 for name in names:
  if name.startswith('src/'):assert archive.read(name)==(root/name).read_bytes(),name
print(f'Verified {len(names)} files, {target.stat().st_size:,} bytes: {target}')
