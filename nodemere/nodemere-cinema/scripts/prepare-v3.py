"""Four full-bleed performances. Originals remain untouched."""
from pathlib import Path
import json, subprocess
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
public = root / 'public'
# Preserve the authentic field, replacing only the selected identities/holes.
field = json.loads((root / 'src/field.json').read_text())
chosen = [(-2, -2, 4), (1, -1, 8), (0, 0, 12), (2, 2, 10)]
for tile in field['tiles']:
    tile['selected'] = next((i for i,(c,r,_) in enumerate(chosen) if (c,r)==(tile['c'],tile['r'])), -1)
    if tile['selected'] >= 0: tile['id'] = chosen[tile['selected']][2]
ratio = .7
canvas = Image.new('RGB', (round(field['w']*ratio), round(field['h']*ratio)), '#030303')
for tile in field['tiles']:
    if tile['selected'] >= 0: continue
    pic = Image.open(public / 'catalog' / f"{tile['id']}.png").convert('RGB')
    pic = ImageOps.fit(pic, (round(tile['w']*ratio), round(tile['h']*ratio)), method=Image.Resampling.LANCZOS, centering=(.5,.35))
    canvas.paste(pic, (round((tile['x']-field['x'])*ratio), round((tile['y']-field['y'])*ratio)))
canvas.save(public / 'catalog/collection-field-v3.jpg', quality=96, subsampling=0)
(root / 'src/field-v3.json').write_text(json.dumps(field), encoding='utf8')

# All pixels in these frames are footage: no padding and no embedded UI.
# The 720p originals receive one high-quality 1.5x Lanczos resample. Mason's
# 1080p original is cropped independently to exclude the foreground visitor.
crops = {4:'1280:360:0:28', 8:'1280:360:0:64', 12:'1280:360:0:150', 10:'1280:360:0:60'}
for id, crop in crops.items():
    src = public / 'videos' / f'{id}-source.mp4'
    duration = float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(src)], text=True))['format']['duration'])
    # Two gentle loop seams, precomputed rather than relying on playback clocks.
    # Each decoded stream is only 1920x540 with short GOPs, silent and local.
    chain = f'[0:v]crop={crop},scale=1920:540:flags=lanczos,fps=30,setsar=1,format=yuv420p,split=3[a][b][c];'
    chain += f'[a][b]xfade=transition=fade:duration=0.4:offset={duration-.4}[ab];'
    chain += f'[ab][c]xfade=transition=fade:duration=0.4:offset={2*duration-.8}[out]'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(src),'-filter_complex_threads','1','-filter_complex',chain,'-map','[out]','-t','19','-an','-c:v','libx264','-preset','fast','-crf','15','-g','30','-pix_fmt','yuv420p','-movflags','+faststart',str(public/'videos'/f'{id}-band-v3.mp4')], check=True)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','2','-i',str(public/'videos'/f'{id}-band-v3.mp4'),'-frames:v','1',str(public/'videos'/f'{id}-band-v3.jpg')], check=True)
    print(f'Prepared {id}: full-cover 1920x540, no audio.', flush=True)
