"""Conform original performances into full-bleed panoramic video backgrounds.

The central source is uniformly scaled, never stretched. Side scenery is taken
from the same moving footage, uniformly enlarged, and feathered at the join.
No synthesized person, still filler, black padding, or opaque side panel.
"""
from pathlib import Path
from PIL import Image,ImageOps
import subprocess,json,sys
root=Path(__file__).resolve().parents[1];public=root/'public'
def run(args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y']+args,check=True)
field=json.loads((root/'src/field.json').read_text())
chosen=[(-2,-2,12),(1,-1,8),(-1,1,3),(2,2,7)]
for tile in field['tiles']:
    tile['selected']=next((i for i,(c,r,_) in enumerate(chosen) if(c,r)==(tile['c'],tile['r'])),-1)
    if tile['selected']>=0:tile['id']=chosen[tile['selected']][2]
ratio=.7;canvas=Image.new('RGB',(round(field['w']*ratio),round(field['h']*ratio)),'#030303')
for tile in field['tiles']:
    pic=ImageOps.fit(Image.open(public/'catalog'/f"{tile['id']}.png").convert('RGB'),(round(tile['w']*ratio),round(tile['h']*ratio)),method=Image.Resampling.LANCZOS,centering=(.5,.35))
    canvas.paste(pic,(round((tile['x']-field['x'])*ratio),round((tile['y']-field['y'])*ratio)))
canvas.save(public/'catalog/collection-field-v4.jpg',quality=96,subsampling=0)
(root/'src/field-v4.json').write_text(json.dumps(field),encoding='utf8')
# 1152x540 center, 80px feather on either side. Native master pixels.
mask=Image.new('L',(1152,540));mask.putdata([round(255*min(1,x/80,(1151-x)/80)) for y in range(540) for x in range(1152)])
mask.save(public/'videos/panorama-feather.png')
settings={12:('900:422:120:140',0,960,280),8:('1280:600:0:0',0,1024,180),3:('1280:600:0:0',0,1024,180),7:('960:450:160:0',0,1024,180)}
for id,(crop,lx,rx,sy) in settings.items():
    dst=public/'videos'/f'{id}-panorama-v4.mp4'
    if dst.exists() and '--rebuild-video' not in sys.argv and str(id) not in sys.argv: continue
    # Lower-resolution scenery is intentionally defocused; the person retains
    # source detail. Centers occupy x=840..1992, placing faces near 37% width.
    filters=(f'[0:v]fps=30,setsar=1,split=3[c][l][r];'
      f'[l]crop=256:156:{lx}:{sy},scale=920:560:flags=lanczos,crop=920:540,boxblur=12:1[ls];'
      f'[r]crop=256:74:{rx}:{sy},scale=1928:558:flags=lanczos,crop=1928:540,boxblur=18:1[rs];'
      f'[c]crop={crop},scale=1152:540:flags=lanczos,split=2[center][base];'
      '[base]scale=992:540:flags=lanczos[base2];'
      '[ls][base2][rs]hstack=inputs=3[background];'
      '[center][1:v]alphamerge[foreground];'
      '[background][foreground]overlay=840:0:shortest=1,format=yuv420p[out]')
    # First render one source duration, then precompute seamless repeated playback.
    part=public/'videos'/f'{id}-panorama-cycle-v4.mp4'
    run(['-i',str(public/'videos'/f'{id}-source.mp4'),'-loop','1','-i',str(public/'videos/panorama-feather.png'),'-filter_complex_threads','1','-filter_complex',filters,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','16','-g','30',str(part)])
    duration=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(part)],text=True))['format']['duration'])
    chain=f'[0:v]split=3[a][b][c];[a][b]xfade=transition=fade:duration=0.3:offset={duration-.3}[ab];[ab][c]xfade=transition=fade:duration=0.3:offset={2*duration-.6}[out]'
    run(['-i',str(part),'-filter_complex_threads','1','-filter_complex',chain,'-map','[out]','-t','19','-an','-c:v','libx264','-preset','fast','-crf','16','-g','30','-pix_fmt','yuv420p','-movflags','+faststart',str(dst)])
    run(['-ss','2','-i',str(dst),'-frames:v','1',str(public/'videos'/f'{id}-panorama-v4.jpg')])
    print(f'{id}: full-width moving panorama prepared.',flush=True)
