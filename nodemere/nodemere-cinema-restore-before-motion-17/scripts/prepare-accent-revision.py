"""Prepare original public accent materials and a frame-driven Accent DNA adapter."""
from pathlib import Path
import json, hashlib, urllib.request
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
assets = root / 'public/audition'
base = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/audition_faces/'
manifest = []
for relative in ['countries/american_landscape2.png', 'countries/british_landscape2.png', 'woman/ethnicity/british.png']:
    output = assets / Path(relative).name
    if not output.exists(): urllib.request.urlretrieve(base + relative, output)
    manifest.append({'file': output.name, 'source': base + relative, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})

def representative(image, start, end, fallback):
    clusters = []
    for y in range(0, 28, 2):
        for x in range(start, end, 2):
            r,g,b,a = image.getpixel((x,y))
            brightness = (r+g+b)/3
            saturation = (max(r,g,b)-min(r,g,b))/max(r,g,b) if max(r,g,b) else 0
            if a<180 or brightness<34 or brightness>238 or saturation<.08: continue
            color=[r,g,b]
            existing=next((c for c in clusters if sum(abs(c['color'][i]-color[i]) for i in range(3))<48),None)
            if existing:
                existing['count']+=1; existing['saturation']+=saturation; existing['brightness']+=brightness
                existing['color']=[c*.76+color[i]*.24 for i,c in enumerate(existing['color'])]
            else: clusters.append(dict(color=color,count=1,saturation=saturation,brightness=brightness))
    def score(c):
        brightness=c['brightness']/c['count']
        return c['count']*(1+c['saturation']/c['count']*2.4)*(.86 if brightness>205 else .78 if brightness<65 else 1)
    if not clusters: return fallback
    return '#'+''.join(f'{round(c):02x}' for c in max(clusters,key=score)['color'])

glows={}
for country,fallback in [('American','#2c5cff'),('British','#6847d8')]:
    im=ImageOps.fit(Image.open(assets/f'{country.lower()}_landscape2.png').convert('RGBA'),(96,28),method=Image.Resampling.BILINEAR)
    glows[country]={key:representative(im,a,b,fallback) for key,a,b in [('left',0,32),('center',24,72),('right',63,96)]}
(assets/'accent-provenance.json').write_text(json.dumps({'assets':manifest,'imageGlows':glows},indent=2),encoding='utf-8')

original=(root.parent/'src/sonar/studio/NodemereStudio.jsx').read_text(encoding='utf-8')
helpers=original[original.index('const accentSelections'):original.index('const sampledImageColors')]
helpers=helpers.replace("ACCENT_LANDSCAPES[item.accent] || ''", "staticFile(`audition/${item.accent.toLowerCase()}_landscape2.png`)")
colors=original[original.index('function rgbToHex'):original.index('function colorDistance')]
body=original[original.index('function AccentDna('):original.index('export default function NodemereStudio')]
start=body.index('  const [imageGlows')
end=body.index("  if(previewOption?.key")
body=body[:start]+f'  const imageGlows={json.dumps(glows)};\n  let strands=chosen.map(item=>({{...item,preview:false}}));\n'+body[end:]
body=body.replace('function AccentDna({ values, previewOption })', 'export default function AccentDna({ values, previewOption, time })')
body=body.replace('return <motion.div','const since=time-(item.accent===\'American\'?9.35:11.05);\n        const layoutProgress=p(since,0,.28);\n        return <MotionClock key={item.accent} time={since}><motion.div')
body=body.replace("style={{'--dna-base':base", "style={{flexGrow:item.accent==='British'?layoutProgress:1,marginLeft:item.accent==='British'?-28*layoutProgress:0,'--dna-pan':`scale(${1.04+.05*p(since,0,22)}) translateX(${-1.5+3*p(since,0,22)}%)`,'--dna-base':base")
body=body.replace('<span className="ns-dna-image"/>', '<Img src={image} style={{position:"absolute",width:1,height:1,opacity:0}}/><span className="ns-dna-image"/>')
body=body.replace('</motion.div>})}', '</motion.div></MotionClock>})}')
(root/'src/product/AccentDna.jsx').write_text('// Native Accent DNA presentation; deterministic selections, motion clock and sampled local image colors.\nimport React from "react";\nimport {Img,staticFile} from "remotion";\nimport {p} from "../design";\nimport {MotionClock,motion,AnimatePresence,useReducedMotion} from "./FrameMotion";\nimport {ACCENT_PALETTES,SUB_ACCENT_PALETTES} from "./voiceDefinition";\nconst EASE=[.22,1,.36,1];\n'+helpers+colors+body,encoding='utf-8')
print('Prepared original American/British landscapes, British portrait and Accent DNA presentation.')
