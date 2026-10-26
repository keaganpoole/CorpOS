"""Build deterministic local display assets; never changes catalog originals."""
from pathlib import Path
from PIL import Image, ImageOps
import json, subprocess
root=Path(__file__).resolve().parents[1]
public=root/'public'
heights=[380,572,448,668]
order=[4,3,8,12,9,10,11,5,6,7]
chosen=[(-2,-2,4),(1,-1,8),(0,0,12),(-1,1,9),(2,2,10)]
tiles=[]
for c in range(-9,10):
    base=-224+(145 if c%2 else -120) if c else -224
    h=lambda r: heights[(r+c+2)%4]
    for r in range(-6,7):
        y=base+sum(h(j)+8 for j in range(r)) if r>=0 else base-sum(h(j)+8 for j in range(r,0))
        sel=next((i for i,(cc,rr,_) in enumerate(chosen) if cc==c and rr==r),-1)
        person=chosen[sel][2] if sel>=0 else order[((r+(c//2)*2)%5)*2+c%2]
        tiles.append(dict(key=f'{c}:{r}',c=c,r=r,x=c*428-210,y=y,w=420,h=h(r),id=person,selected=sel))
x0=min(t['x'] for t in tiles); y0=min(t['y'] for t in tiles)
x1=max(t['x']+t['w'] for t in tiles); y1=max(t['y']+t['h'] for t in tiles)
ratio=0.7
canvas=Image.new('RGB',(round((x1-x0)*ratio),round((y1-y0)*ratio)), '#030303')
for t in tiles:
    if t['selected']>=0: continue
    pic=Image.open(public/'catalog'/f"{t['id']}.png").convert('RGB')
    pic=ImageOps.fit(pic,(round(t['w']*ratio),round(t['h']*ratio)),method=Image.Resampling.LANCZOS,centering=(.5,.35))
    canvas.paste(pic,(round((t['x']-x0)*ratio),round((t['y']-y0)*ratio)))
canvas.save(public/'catalog/collection-field.jpg',quality=96,subsampling=0)
(root/'src/field.json').write_text(json.dumps(dict(tiles=tiles,x=x0,y=y0,w=x1-x0,h=y1-y0)),encoding='utf8')

# One decoder, five precisely cropped native-resolution performances, 30fps
# with 1-second keyframes for inexpensive deterministic arbitrary seeking.
ids=[4,8,12,9,10]
offsets=[120,2120,0,2000,80]
tops=[36,36,170,30,20]
for i,id in enumerate(ids):
    src=public/'videos'/f'{id}-source.mp4'
    dst=public/'videos'/f'{id}-strip.mp4'
    crop=f'crop=1500:416:0:{tops[i]},scale=1240:344:flags=lanczos' if id==12 else f'crop=1280:356:0:{tops[i]},scale=1240:344:flags=lanczos'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-stream_loop','-1','-i',str(src),'-t','17','-an','-vf',crop+',fps=30,setsar=1', '-c:v','libx264','-preset','fast','-crf','16','-g','30','-pix_fmt','yuv420p',str(dst)],check=True)
args=['ffmpeg','-hide_banner','-loglevel','error','-y']
for id in ids: args+=['-i',str(public/'videos'/f'{id}-strip.mp4')]
filters=[]
for i,x in enumerate(offsets): filters.append(f'[{i}:v]pad=3360:376:{x}:0:color=black[v{i}]')
filters.append(''.join(f'[v{i}]' for i in range(5))+'vstack=inputs=5,crop=3360:1848:0:0[out]')
args+=['-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','17','-g','30','-pix_fmt','yuv420p','-movflags','+faststart',str(public/'videos/showcase-atlas.mp4')]
subprocess.run(args,check=True)
print('Prepared 247-portrait field and five-performance video atlas.')
