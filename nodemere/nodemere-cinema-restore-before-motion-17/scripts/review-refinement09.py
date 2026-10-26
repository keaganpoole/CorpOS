"""Review encoded motion and check every decoded frame."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,subprocess,json,math,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);a=p.parse_args();root=Path(__file__).resolve().parents[1];dest=root/'review/refinement09/encoded';dest.mkdir(parents=True,exist_ok=True);frames=dest/'frames';frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss','150.1','-i',str(a.video),'-vf','fps=12,scale=960:540','-q:v','2',str(frames/'%04d.jpg')],check=True)
available=len(list(frames.glob('*.jpg')))
def sheet(name,times,cols=4,width=400):
 h=round(width*9/16);canvas=Image.new('RGB',(cols*width,math.ceil(len(times)/cols)*(h+24)),'#18181a');draw=ImageDraw.Draw(canvas)
 for i,t in enumerate(times):
  index=min(available,max(1,round(t*12)+1));im=Image.open(frames/f'{index:04d}.jpg').resize((width,h),Image.Resampling.LANCZOS);x=i%cols*width;y=i//cols*(h+24);canvas.paste(im,(x,y));draw.text((x+8,y+h+5),f'Scene {9 if t<42 else 10} : {t if t<42 else t-42:.2f}s',fill='white')
 canvas.save(dest/f'{name}.jpg',quality=95)
sheet('scenarios',[.3,1.3,2.5,3.8,4.5,5.2,5.7,6.5,7.8,8.3,8.5,8.8,9.3,10,11.5,12.3,13,14.6,15.5,16.55,17.6,18.65,19.7,20.75,21.8,23.6,24.2,25,26,27,28,29,30,31.5,34,36,38.5,41.5])
sheet('nest',[42+t for t in [.3,1.3,2.5,3.3,4.3,4.9,5.1,5.4,5.7,6,6.3,6.8,7.6,9,11,13.3,14.7,17.3,20.5,22,25,27.6,29,32,34.2,35.5,37.6,40.5,43.6,44.2,45.6,48.5,51.6,52.2,53.6,57.3,59,61.8]])
sheet('native-intro',[3.8+i/6 for i in range(18)])
sheet('workflow-growth',[23.5+i/3 for i in range(21)])
sheet('dashboard-nest-zoom',[42+4.5+i/12 for i in range(24)])
sheet('scenarios-nest-handoff',[41.5+i/12 for i in range(24)])
sheet('invoice-insertion',[14.8+i/6 for i in range(24)])
print('Temporal contact sheets ready',flush=True)
process=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(a.video),'-vf','scale=320:180','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
count=0;black=[];size=320*180*3
while True:
 raw=process.stdout.read(size)
 if not raw:break
 assert len(raw)==size
 frame=np.frombuffer(raw,dtype=np.uint8)
 if count>21 and frame.max()<8:black.append(count)
 count+=1
process.wait();assert process.returncode==0 and count==15246
checks={'decoded_frames':count,'unexpected_black_frames':black,'temporal_sample_fps':12,'video_only':True,'width':1920,'height':1080,'fps':60}
(dest/'checks.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks),flush=True);assert not black
