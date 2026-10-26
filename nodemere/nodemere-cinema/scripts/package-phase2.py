"""Package the current film with prepared local assets, omitting render caches."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--destination',type=Path,required=True)
args=parser.parse_args()
args.destination.mkdir(parents=True,exist_ok=True)
files=list((root/'src').rglob('*'))
for directory in ['fonts','audition','videos/v4-directed']:
    files+=list((root/'public'/directory).rglob('*'))
files+=list((root/'public/catalog').glob('*.png'))
files += [root/'public/catalog/4-portrait.mp4',root/'public/catalog/collection-field-directed-v4.jpg']
files += [root/f'public/videos/{identity}-source.mp4' for identity in [12,8,3,7,4,6]]
files += list((root/'scripts').glob('*.py'))+list((root/'scripts').glob('*.cjs'))
files += [root/name for name in ['package.json','package-lock.json','tsconfig.json','remotion.config.ts','eslint.config.mjs','.gitignore','AGENTS.md','README.md','QA.md','PHASE2.md','QA-PHASE2.md','VERSIONS.md']]
target=args.destination/'nodemere-scenes-1-4-source.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=6) as archive:
    for path in sorted(set(files)):
        if path.is_file() and '__pycache__' not in path.parts: archive.write(path,path.relative_to(root))
    metadata=args.destination/'nodemere-scenes-1-4-metadata.json'
    if metadata.exists(): archive.write(metadata,metadata.name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    names=set(archive.namelist())
    for name in ['src/FullFilm.tsx','src/AuditionScene.tsx','src/CalendarScene.tsx','src/product/FrameMotion.jsx','public/audition/friendly_woman.png','public/catalog/collection-field-directed-v4.jpg','PHASE2.md','QA-PHASE2.md']:
        assert name in names, name
print(f'Verified {target}: {len(names)} files, {target.stat().st_size:,} bytes.')
