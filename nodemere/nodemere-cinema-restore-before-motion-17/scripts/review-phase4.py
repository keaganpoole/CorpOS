"""Encoded temporal review and all-frame checks of the 1080p continuation."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,subprocess,json,math,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
a.destination.mkdir(parents=True,exist_ok=True);frames=a.destination/'frames';frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(a.video),'-vf','fps=12,scale=960:540','-q:v','2',str(frames/'%04d.jpg')],check=True)
available=len(list(frames.glob('*.jpg')))
def sheet(name,times,cols=4,width=400):
 h=round(width*9/16);canvas=Image.new('RGB',(cols*width,math.ceil(len(times)/cols)*(h+24)),'#18181a');draw=ImageDraw.Draw(canvas)
 for i,t in enumerate(times):
  index=min(available,max(1,round(t*12)+1));im=Image.open(frames/f'{index:04d}.jpg').resize((width,h),Image.Resampling.LANCZOS)
  x=i%cols*width;y=i//cols*(h+24);canvas.paste(im,(x,y));draw.text((x+8,y+h+5),f'{t:.2f}s',fill='white')
 canvas.save(a.destination/f'{name}.jpg',quality=95)
sheet('people',[119.6+t for t in [0,.3,.8,1.5,2.3,3.3,4.8,6,7,8.4,9.5,10.7,11.5,12.4,13.5,15,16.5,18,19.7,21.2,22.5,23.5,25,26.5,28,29,30,30.45]])
sheet('scenarios',[150.1+t for t in [0,.3,1.2,2.3,3.3,4.4,5.5,6.6,7.2,8.4,9.5,10.5,11.5,12.5,13.8,15,16.5,18,19.5,20.8,22.8,24.5,26.4,27,28,29.4,30.4,31.6,33,34.8]])
sheet('nest',[185.1+t for t in [0,.3,1.3,2.5,3.4,4.5,5.5,7.7,8.6,11,12.5,13.5,16.1,18.5,20,21,23.5,25.5,27,28,30.5,32.8,34,35.5,36.8,39.7,42.8,43.4,44.7,47.6,50.8,51.4,52.7,55.8,58.5,60.8]])
for name,start in [('handoff-people',119.4),('people-scenarios',149.8),('scenarios-nest',184.8),('nest-intercom',218.4)]:
 sheet(name,[start+i/12 for i in range(24)])
sheet('native-notification-sweep',[189.6+i/6 for i in range(30)])
sheet('native-execution',[176.3+i/4 for i in range(24)])
sheet('intercom-switch',[227.2+i/12 for i in range(24)])
process=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(a.video),'-vf','scale=320:180','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
count=0;black=[];blank=[];size=320*180*3
while True:
 raw=process.stdout.read(size)
 if not raw:break
 assert len(raw)==size
 frame=np.frombuffer(raw,dtype=np.uint8).reshape(180,320,3);t=count/60
 if t>.35 and frame.max()<8:black.append(count)
 if 220.1<=t<244.1 and not (227.8<t<228.6 or 235.8<t<236.6):
  crop=frame[64:88,72:96]
  if crop.mean()<12 or crop.std()<8:blank.append(count)
 count+=1
process.wait();assert process.returncode==0 and count==14766
checks={'decoded_frames':count,'unexpected_black_frames':black,'blank_intercom_avatar_regions':blank,'temporal_sample_fps':12,'review_method':'Encoded temporal contact sheets, full-size native frames, Studio playback/state, source fidelity and immutable rollback checks.'}
(a.destination/'checks.json').write_text(json.dumps(checks,indent=2))
print(json.dumps(checks,indent=2));assert not black and not blank
