"""Vendor product presentation code and fetch its public, original demo assets."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import shutil
import urllib.request
import re

root = Path(__file__).resolve().parents[1]
app = root.parent
dest = root / "src/product"
dest.mkdir(exist_ok=True)
assets = root / "public/audition"
assets.mkdir(exist_ok=True)
manifest = []
for relative in ["studio/studio.css", "studio/voiceDefinition.js", "studio/ReceptionistReviewDetails.jsx", "components/dropIns.css", "components/AppointmentRecord.jsx", "components/DropInStrip.jsx"]:
    source = app / "src/sonar" / relative
    text = source.read_text(encoding="utf-8")
    text = text.replace("from 'framer-motion'", "from './FrameMotion'")
    (dest / source.name).write_text(text, encoding="utf-8")
    if source.name == 'studio.css':
        film_css=re.sub(r'(-?\d*\.?\d+)vw',lambda m:f'{float(m[1])*38.4:g}px',text)
        film_css=re.sub(r'(-?\d*\.?\d+)(?:dvh|vh)',lambda m:f'{float(m[1])*21.6:g}px',film_css)
        (dest/'studio-film-viewport.css').write_text('/* Native studio rules resolved at the 3840x2160 composition viewport, so Studio preview matches export. */\n'+film_css,encoding='utf-8')
    manifest.append({"source": str(source.relative_to(app)), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "adaptation": "Framer Motion clock import redirected to frame adapter; presentation retained."})

source = app / "src/sonar/studio/PortraitPreview.jsx"
original = source.read_text(encoding="utf-8")
body = original[original.index("  if (!visible) return null;"):].replace('<img ', '<Img ')
(dest / "PortraitPreview.jsx").write_text(
    "// Original portrait presentation; decoded asset/state is supplied by the film timeline.\n"
    "import React from 'react';\nimport {Img} from 'remotion';\nimport {motion} from './FrameMotion';\nimport {CHARACTERISTICS} from './voiceDefinition';\n"
    "const EASE=[.22,1,.36,1];\nconst CROSSFADE_MS=520;\n"
    "/** @param {Record<string, any>} props */\nexport default function PortraitPreview({stage,values={},visible,previousVisible=null,fadeFromEmpty=false,reducedMotion=false,subdued=false}) {\n"
    "  const characteristic=CHARACTERISTICS[Math.min(stage,CHARACTERISTICS.length-1)];\n" + body,
    encoding="utf-8")
manifest.append({"source":"src/sonar/studio/PortraitPreview.jsx", "sha256":hashlib.sha256(source.read_bytes()).hexdigest(), "adaptation":"Only async image selection and timeout state replaced with supplied deterministic state. Original image styles, layers, masks and 520ms crossfade retained."})

paths = ["woman/temperament/friendly_woman.png", "woman/age/young_adult_2.png", "woman/age/middle_aged_3.png", "woman/ethnicity/american.png", "woman/temperament/calm_woman.png", "woman/temperament/caring_woman.png"]
base = "https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/"
def fetch(relative):
    url = base + "audition_faces/" + relative
    output = assets / Path(relative).name
    if not output.exists():
        urllib.request.urlretrieve(url, output)
    return {"file":str(output.relative_to(root / "public")), "url":url, "sha256":hashlib.sha256(output.read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    manifest.extend(executor.map(fetch,paths))
for name, relative in [("maggie-avatar.png","avatars/maggie.png"),("maggie-banner.png","banners/maggie_001.png")]:
    output=assets/name
    if not output.exists(): urllib.request.urlretrieve(base+relative,output)
    manifest.append({"file":str(output.relative_to(root / "public")),"url":base+relative,"sha256":hashlib.sha256(output.read_bytes()).hexdigest()})
(root / "public/audition/provenance.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(f"Prepared {len(manifest)} original product sources/assets.")
