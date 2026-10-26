"""Real footage only: individual portrait crops, no extension or distortion."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
destination = root / "public/videos/v4-directed"
destination.mkdir(parents=True, exist_ok=True)
field = json.loads((root / "src/field.json").read_text())
ratio = 0.7
mosaic = Image.new("RGB", (round(field["w"] * ratio), round(field["h"] * ratio)), "#000")
for tile in field["tiles"]:
    portrait = ImageOps.fit(Image.open(root / f"public/catalog/{tile['id']}.png").convert("RGB"),
        (round(tile["w"] * ratio), round(tile["h"] * ratio)), method=Image.Resampling.LANCZOS, centering=(0.5, 0.35))
    mosaic.paste(portrait, (round((tile["x"] - field["x"]) * ratio), round((tile["y"] - field["y"]) * ratio)))
mosaic.save(root / "public/catalog/collection-field-directed-v4.jpg", quality=96, subsampling=0)
crops = {12: (1280, 316, 0, 170), 8: (1280, 316, 0, 60), 3: (1280, 316, 0, 90), 7: (1280, 316, 0, 38), 4: (1280, 252, 0, 95), 6: (1280, 316, 0, 75)}
manifest = []
for identity, crop in crops.items():
    source = root / f"public/videos/{identity}-source.mp4"
    target = destination / f"{identity}.mp4"
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-vf", "crop=" + ":".join(map(str, crop)) + ",setsar=1",
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-g", "24",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target)
    ], check=True)
    manifest.append({"id": identity, "source": source.name, "crop": crop, "output": target.name})
    print(f"Prepared original footage for receptionist {identity}", flush=True)
(destination / "crops.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
