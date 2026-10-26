from pathlib import Path
from PIL import Image, ImageDraw, ImageStat
import subprocess, json, math, sys
import numpy as np

video = Path(sys.argv[1])
dest = Path(sys.argv[2])
dest.mkdir(parents=True, exist_ok=True)
frames_dir = dest / "frames"
frames_dir.mkdir(exist_ok=True)
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video),
    "-vf", "fps=12,scale=960:540", "-q:v", "2", str(frames_dir / "%04d.jpg")], check=True)

def sheet(name, seconds, cols=4, width=480):
    height = round(width * 9 / 16)
    result = Image.new("RGB", (cols*width, math.ceil(len(seconds)/cols)*(height+24)), "#181818")
    draw = ImageDraw.Draw(result)
    for n, seconds in enumerate(seconds):
        index = min(216, max(1, round(seconds*12)+1))
        image = Image.open(frames_dir / f"{index:04d}.jpg").resize((width,height), Image.Resampling.LANCZOS)
        x,y = n%cols*width,n//cols*(height+24)
        result.paste(image,(x,y+24))
        draw.text((x+7,y+5),f"{seconds:.3f} s",fill="white")
    result.save(dest / f"{name}.jpg",quality=94)

sheet("complete-timeline",[i*.5 for i in range(36)],6,320)
sheet("incoming-to-title",[3+i/12 for i in range(13)])
sheet("title-to-catalog",[5.4+i/12 for i in range(13)])
sheet("catalog-to-showcase",[10+i/12 for i in range(16)])
sheet("conversation-cascade",[11.1+i*.25 for i in range(13)])
sheet("catalog-pullback",[6+i*.3 for i in range(14)])

# Decode every frame for blank images, gallery coverage, and all four video regions.
proc = subprocess.Popen(["ffmpeg","-v","error","-i",str(video),"-vf","scale=480:270","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
size=480*270*3; index=0; unexpected_black=[]; blank_rows=[]; edge_failures=[]; minimum=[255.0]*4
while True:
    raw=proc.stdout.read(size)
    if not raw: break
    if len(raw)!=size: raise RuntimeError("Incomplete decoded frame")
    frame=np.frombuffer(raw,dtype=np.uint8).reshape(270,480,3)
    t=index/60
    if t>.3 and frame.max()<8: unexpected_black.append(index)
    if 6.1<=t<=10.1:
        corners=[frame[:8,:8],frame[:8,-8:],frame[-8:,:8],frame[-8:,-8:]]
        if any(float(c.mean())<2 for c in corners): edge_failures.append(index)
    if t>=11.15:
        for row in range(4):
            crop=frame[round((42+row*249+8)/4):round((42+(row+1)*249-8)/4),round((456+310)/4):round((456+670)/4)]
            mean=float(crop.mean()); minimum[row]=min(minimum[row],mean)
            if mean<7 or float(crop.std())<3: blank_rows.append([index,row])
    index+=1
proc.wait()
if proc.returncode: raise RuntimeError("Decode failed")
result={"file":video.name,"decoded_frames":index,"unexpected_black_frames":unexpected_black,"blank_video_regions":blank_rows,"catalog_edge_flags":edge_failures,"minimum_video_region_mean_rgb":minimum,"review_method":"Full timeline at 12 fps plus all-frame pixel checks. No claim of real-time playback."}
(dest/"checks.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result,indent=2))
