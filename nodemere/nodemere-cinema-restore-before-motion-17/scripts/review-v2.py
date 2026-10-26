from pathlib import Path
from PIL import Image, ImageDraw
import subprocess,sys,json
root=Path(__file__).resolve().parents[1]
video=root/(sys.argv[1] if len(sys.argv)>1 else 'out/nodemere-scenes-1-2-v2-preview.mp4')
dest=root/'review/v2-encoded';dest.mkdir(exist_ok=True,parents=True)
def sheet(name,start,duration,fps,cols,width):
    folder=dest/name;folder.mkdir(exist_ok=True)
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
sheet('collection-motion',11.9,5,8,5,384)
sheet('tile-to-strip-motion',16.9,2.8,12,5,384)
for t in [10.4,20.9,23.9,26.9,29.9,32.9,34.9]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(dest/f'frame-{t}.png')],check=True)
mobile=Image.new('RGB',(780,3*244),'black')
for i,t in enumerate([10.4,20.9,23.9,26.9,29.9,32.9]):
    im=Image.open(dest/f'frame-{t}.png');im.thumbnail((390,220),Image.Resampling.LANCZOS)
    mobile.paste(im,(i%2*390,i//2*244))
mobile.save(dest/'phone-width.png')
probe=subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)],text=True)
(dest/'preview-metadata.json').write_text(probe,encoding='utf8')
print('Encoded film and dense temporal review sheets extracted.')
