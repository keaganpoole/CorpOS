"""Encoded contact sheets plus all-frame checks; does not claim real-time viewing."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, json, subprocess, math
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('video',type=Path)
parser.add_argument('destination',type=Path)
args=parser.parse_args()
args.destination.mkdir(parents=True,exist_ok=True)
frames=args.destination/'frames'
frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.video),'-vf','fps=12,scale=960:540',
    '-q:v','2',str(frames/'%04d.jpg')],check=True)
available=len(list(frames.glob('*.jpg')))
def sheet(name,times,cols=4,width=400):
    height=round(width*9/16)
    canvas=Image.new('RGB',(cols*width,math.ceil(len(times)/cols)*(height+24)),'#18181a')
    draw=ImageDraw.Draw(canvas)
    for i,time in enumerate(times):
        index=min(available,max(1,round(time*12)+1))
        image=Image.open(frames/f'{index:04d}.jpg').resize((width,height),Image.Resampling.LANCZOS)
        x=i%cols*width;y=i//cols*(height+24)
        canvas.paste(image,(x,y));draw.text((x+8,y+height+5),f'{time:.3f}s',fill='white')
    canvas.save(args.destination/f'{name}.jpg',quality=94)

sheet('whole-film',[i for i in range(60)],6,320)
sheet('audition-hover',[16.7+t for t in [4.9,5.15,5.5,5.8,6.1,6.45,7.45,7.8,8.25,8.65,9.05,9.4,9.85,10.25,10.95,11.3]])
sheet('accent-scroll',[16.7+t for t in [11.65,12,12.5,12.8,13.35,13.8,14,14.5,14.7,15.1,15.4,15.65,16,16.35,16.8,17.4]])
sheet('personality',[16.7+17.8+i/12 for i in range(72)])
sheet('scene2-to-audition',[16.5+i/12 for i in range(16)])
sheet('audition-to-calendar',[40.5+i/12 for i in range(16)])
sheet('calendar-camera',[40.7+t for t in [2.4,2.55,2.7,2.85,3.1,3.6,4.5,5.1,5.8,6.3,6.8,7.3,7.8,8.1,9.5,11.8]])
sheet('calendar-swing',[40.7+5.5+i/12 for i in range(20)])
sheet('calendar-entry-dense',[40.7+2.4+i/60 for i in range(0,48,3)])
sheet('drop-in-cascade',[40.7+9.05+i/60 for i in range(0,39,3)])
sheet('inline-confirmation',[40.7+11.35+i/12 for i in range(12)])

process=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-i',str(args.video),'-vf','scale=320:180',
    '-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
size=320*180*3;count=0;black=[];blank_rows=[]
while True:
    raw=process.stdout.read(size)
    if not raw: break
    assert len(raw)==size
    frame=np.frombuffer(raw,dtype=np.uint8).reshape(180,320,3)
    time=count/60
    if time>.35 and frame.max()<8: black.append(count)
    if 10<=time<16.7:
        for row in range(5):
            crop=frame[round((42+row*199.2+8)/6):round((42+(row+1)*199.2-8)/6),128:186]
            if float(crop.mean())<7 or float(crop.std())<3: blank_rows.append([count,row])
    count+=1
process.wait()
assert process.returncode==0 and count==3558
result={'decoded_frames':count,'unexpected_black_frames':black,'blank_conversation_video_regions':blank_rows,
    'contact_sheet_sample_fps':12,'review_method':'Encoded temporal contact sheets and representative native frames; no real-time playback claim.'}
(args.destination/'checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
assert not black and not blank_rows
print(json.dumps(result,indent=2))
