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

sheet('whole-film',[i for i in range(55)],6,320)
sheet('audition-appearance',[16.7+t for t in [3.5,4.9,5.85,5.95,6.1,6.3,6.8,6.9,7,7.15,7.35,7.65,8.9,9.05,9.25,9.5]])
sheet('accent-dna',[16.7+t for t in [9,9.35,9.45,9.6,10,10.3,10.8,11.05,11.15,11.3,11.55,11.8,12.1,12.5,13,13.25]])
sheet('personality',[16.7+13.4+i/12 for i in range(30)])
sheet('scene2-to-audition',[16.5+i/12 for i in range(16)])
sheet('audition-to-calendar',[32.7+i/12 for i in range(16)])
sheet('calendar-camera',[32.9+t for t in [2.5,2.7,3.5,4.5,5.5,6.5,7.3,7.9,8.45,8.85,9.5,11,11.8,13.7,14,20.8]])
sheet('drop-in-cascade',[32.9+11.25+i/60 for i in range(0,39,3)])
sheet('inline-confirmation',[32.9+13.55+i/12 for i in range(12)])

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
assert process.returncode==0 and count==3252
result={'decoded_frames':count,'unexpected_black_frames':black,'blank_conversation_video_regions':blank_rows,
    'contact_sheet_sample_fps':12,'review_method':'Encoded temporal contact sheets and representative native frames; no real-time playback claim.'}
(args.destination/'checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
assert not black and not blank_rows
print(json.dumps(result,indent=2))
