"""Package the editable directed V4 and its local assets; omit prior exports."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--destination", type=Path, default=root / "out/directed-v4-delivery")
args = parser.parse_args()
args.destination.mkdir(parents=True, exist_ok=True)
target = args.destination / "nodemere-v4-source.zip"

files = list((root / "src").rglob("*"))
files += list((root / "public/fonts").rglob("*"))
files += list((root / "public/catalog").glob("*.png"))
files += [root / "public/catalog/4-portrait.mp4", root / "public/catalog/collection-field-directed-v4.jpg"]
files += list((root / "public/videos/v4-directed").rglob("*"))
files += [root / f"public/videos/{identity}-source.mp4" for identity in [12, 8, 3, 7]]
files += list((root / "scripts").glob("*-directed-v4.py"))
files += [root / name for name in ["package.json", "package-lock.json", "tsconfig.json", "remotion.config.ts", "eslint.config.mjs", ".gitignore", "README.md", "QA.md"]]
files = sorted({file for file in files if file.is_file() and "__pycache__" not in file.parts})

with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        archive.write(file, file.relative_to(root))
    metadata = args.destination / "nodemere-v4-export-metadata.json"
    if metadata.exists():
        archive.write(metadata, metadata.name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    for required in ["src/RevisionFour.tsx", "src/Root.tsx", "public/catalog/collection-field-directed-v4.jpg", "public/fonts/Inter-400.ttf"]:
        assert required in names, required
    for identity in [12, 8, 3, 7]:
        assert f"public/videos/v4-directed/{identity}.mp4" in names
        assert f"public/videos/{identity}-source.mp4" in names
print(f"Verified {target.name}: {len(names)} files, {target.stat().st_size:,} bytes.")
