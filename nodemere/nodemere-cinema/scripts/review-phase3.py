"""Three-scene temporal review and all-frame checks of the assembled preview."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,subprocess,json,math,numpy as np
parser=argparse.ArgumentParser();parser.add_argument('video',type=Path);parser.add_argument('destination',type=Path);args=parser.parse_args()
args.destination.mkdir(parents=True,exist_ok=True);frames=args.destination/'frames';frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.video),'-vf','fps=12,scale=960:540','-q:v','2',str(frames/'%04d.jpg')],check=True)
available=len(list(frames.glob('*.jpg')))
def sheet(name,times,cols=4,width=400):
 h=round(width*9/16);canvas=Image.new('RGB',(cols*width,math.ceil(len(times)/cols)*(h+24)),'#18181a');draw=ImageDraw.Draw(canvas)
 for i,t in enumerate(times):
  index=min(available,max(1,round(t*12)+1));im=Image.open(frames/f'{index:04d}.jpg').resize((width,h),Image.Resampling.LANCZOS)
  x=i%cols*width;y=i//cols*(h+24);canvas.paste(im,(x,y));draw.text((x+8,y+h+5),f'{t:.2f}s',fill='white')
 canvas.save(args.destination/f'{name}.jpg',quality=95)
sheet('whole-film',list(range(0,120,2)),6,320)
sheet('builder',[59.3+t for t in [0,.3,.65,1.4,2.3,2.8,3.5,4.1,4.8,5.5,5.9,6.5,7.1,7.6,8.4,8.9,9.3,10,11.3,12,12.9,13.4,14.5,15.1,15.9,16.5,17.3,18,19.5,20.5,21.2,21.9]])
sheet('network',[81.3+t for t in [0,1,1.8,2.3,3,3.8,4.8,5.4,6,6.7,7.2,8.5,9,9.6,10.3,11,12,12.8,13.3,14,14.8,15.8,16.4,17,17.7,19.1,19.8,20.5,21.4,22.4,23.8,25.6]])
sheet('network-line-portrait-icon',[81.3+8.4+i/12 for i in range(24)])
sheet('handoff',[107.3+i*.4 for i in range(31)])
for name,start in [('calendar-builder',59.1),('builder-network',80.8),('network-handoff',107.05)]:sheet(name,[start+i/12 for i in range(20)])
process=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-i',str(args.video),'-vf','scale=320:180','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
count=0;black=[];blank=[];size=320*180*3
while True:
 raw=process.stdout.read(size)
 if not raw:break
 assert len(raw)==size
 f=np.frombuffer(raw,dtype=np.uint8).reshape(180,320,3);t=count/60
 if t>.35 and f.max()<8:black.append(count)
 if 81.3<=t<104.9:
  crop=f[80:115,145:175]
  if crop.mean()<12 or crop.std()<5:blank.append(count)
 count+=1
process.wait();assert process.returncode==0 and count==7176
checks={'decoded_frames':count,'unexpected_black_frames':black,'blank_piper_regions':blank,'temporal_sample_fps':12,'review_method':'Encoded temporal contact sheets, native full-resolution frame review, Studio stills and source checks.'}
(args.destination/'checks.json').write_text(json.dumps(checks,indent=2));assert not black and not blank
print(json.dumps(checks,indent=2))
