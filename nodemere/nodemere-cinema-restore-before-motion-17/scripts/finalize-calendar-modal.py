"""Replace only Scene 5 in revision06, normalize to Rec.709 and verify the full preview."""
from pathlib import Path
import argparse,hashlib,json,subprocess
p=argparse.ArgumentParser();p.add_argument('--previous',type=Path,required=True);p.add_argument('--scene',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
a.destination.mkdir(parents=True,exist_ok=True)
def probe(file):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(file)],text=True))['streams']
old=probe(a.previous);new=probe(a.scene)
assert len(old)==len(new)==1
for s in old+new:assert(s['width'],s['height'],s['avg_frame_rate'])==(1920,1080,'60/1')
assert int(old[0]['nb_frames'])==7176 and int(new[0]['nb_frames'])==1320
def color(s):return f"scale=in_range={'pc' if s.get('color_range')=='pc' else 'tv'}:out_range=tv:in_color_matrix={'bt709' if s.get('color_space')=='bt709' else 'bt601'}:out_color_matrix=bt709,format=yuv420p,setsar=1"
filters=f"[0:v]split[x][y];[x]trim=end_frame=3558,setpts=PTS-STARTPTS,{color(old[0])}[before];[1:v]setpts=PTS-STARTPTS,{color(new[0])}[scene];[y]trim=start_frame=4878,setpts=PTS-STARTPTS,{color(old[0])}[after];[before][scene][after]concat=n=3:v=1:a=0[v]"
target=a.destination/'nodemere-scenes-1-7-preview.mp4'
assert not target.exists(),'Never overwrite a delivered release'
subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(a.previous),'-i',str(a.scene),'-filter_complex',filters,'-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-video_track_timescale','90000','-movflags','+faststart',str(target)],check=True)
s=probe(target);assert len(s)==1 and int(s[0]['nb_frames'])==7176
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
meta=json.loads((a.previous.parent/'nodemere-scenes-1-7-metadata.json').read_text(encoding='utf-8'))
meta.update(revision='07-calendar-dropins',assembly='Revision06 before frame3558 and from frame4878; Calendar DropInsModal replaces the 1320-frame Scene5.',sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size)
(a.destination/'nodemere-scenes-1-7-metadata.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print(json.dumps(meta,indent=2))
