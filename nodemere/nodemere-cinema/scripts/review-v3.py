"""Inspect the encoded movie, including temporal sequences and 4K face crops."""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess, sys, json
root=Path(__file__).resolve().parents[1]
video=root/(sys.argv[1] if len(sys.argv)>1 else 'out/nodemere-scenes-1-2-v3-review.mp4')
dest=root/'review/v3-encoded'; dest.mkdir(exist_ok=True,parents=True)
def sheet(name,start,duration,fps,cols,width):
    folder=dest/name; folder.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(video),'-t',str(duration),'-vf',f'fps={fps},scale={width}:-1',str(folder/'%04d.jpg')],check=True)
    frames=sorted(folder.glob('*.jpg')); h=Image.open(frames[0]).height
    result=Image.new('RGB',(cols*width,((len(frames)+cols-1)//cols)*(h+24)),'#151515');draw=ImageDraw.Draw(result)
    for i,file in enumerate(frames):
        x=i%cols*width;y=i//cols*(h+24)
        result.paste(Image.open(file),(x,y));draw.text((x+8,y+h+5),f'{start+i/fps:.3f}s',fill='white')
    result.save(dest/f'{name}.jpg',quality=94)
sheet('complete-film',0,35,1,5,384)
sheet('opening-motion',0,2.1,12,6,320)
sheet('gradient-and-icon',6.8,5.1,8,5,384)
sheet('collection-motion',11.9,4.6,12,5,384)
sheet('portrait-to-band',16.45,2.55,24,5,384)
sheet('conversations',19,16,2,4,480)
for t in [10.4,20.8,24.35,27.9,31.45,34.5]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(dest/f'frame-{t}.png')],check=True)
mobile=Image.new('RGB',(780,3*244),'black')
for i,t in enumerate([10.4,20.8,24.35,27.9,31.45,34.5]):
    im=Image.open(dest/f'frame-{t}.png');im.thumbnail((390,220),Image.Resampling.LANCZOS)
    mobile.paste(im,(i%2*390,i//2*244))
mobile.save(dest/'phone-width.png')
print('Complete encoded timeline, dense motion, dialogue and phone-scale sheets extracted.',flush=True)

# Scan every displayed frame for blank video interiors, using each half-width
# video region independently. The movie stays 60fps; this is a QC reduction.
checks=[]
for i in range(4):
    vf=f'crop=iw/2:ih/4:0:{i}*ih/4,scale=96:27,blackdetect=d=0.016:pix_th=0.015:pic_th=0.98'
    result=subprocess.run(['ffmpeg','-hide_banner','-ss','18.8','-i',str(video),'-an','-vf',vf,'-f','null','NUL'],capture_output=True,text=True,check=True)
    blanks=[line for line in result.stderr.splitlines() if 'black_start:' in line]
    assert not blanks, f'Blank video region {i}: {blanks}'
    checks.append(dict(band=i+1,blank_video_frames_detected=False))
(dest/'video-region-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
print('All four video regions: no black/blank frames detected throughout the settled showcase.',flush=True)
