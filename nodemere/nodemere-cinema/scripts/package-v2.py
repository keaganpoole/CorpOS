from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
target=root/'out/nodemere-scenes-1-2-v2-source.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=6) as archive:
    for folder in ['src','public','scripts']:
        for file in sorted((root/folder).rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                archive.write(file,file.relative_to(root))
    for file in root.iterdir():
        if file.is_file() and file.suffix not in ['.log']:
            archive.write(file,file.name)
    metadata=root/'out/export-metadata-v2.json'
    if metadata.exists():archive.write(metadata,'export-metadata-v2.json')
print(f'{target.name}: {target.stat().st_size:,} bytes')
