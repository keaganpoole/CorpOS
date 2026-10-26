"""Assemble the approved prefix and revised Calendar/new scenes as a 1080p preview."""
from pathlib import Path
import argparse,hashlib,json,subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--previous',type=Path,required=True)
parser.add_argument('--tail',type=Path,required=True)
parser.add_argument('--network-fix',type=Path,required=True)
parser.add_argument('--builder-fix',type=Path,required=True)
parser.add_argument('--destination',type=Path,required=True)
args=parser.parse_args();args.destination.mkdir(parents=True,exist_ok=True)
def probe(file):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(file)],text=True))['streams']
old=probe(args.previous);tail=probe(args.tail);network=probe(args.network_fix);builder=probe(args.builder_fix)
assert len(old)==len(tail)==len(network)==len(builder)==1
for s in old+tail+network+builder:assert (s['width'],s['height'],s['avg_frame_rate'])==(1920,1080,'60/1')
assert int(tail[0]['nb_frames'])==4734
assert int(network[0]['nb_frames'])==1608
assert int(builder[0]['nb_frames'])==1320
def color(s):
 return f"scale=in_range={'pc' if s.get('color_range')=='pc' else 'tv'}:out_range=tv:in_color_matrix={'bt709' if s.get('color_space')=='bt709' else 'bt601'}:out_color_matrix=bt709,format=yuv420p,setsar=1"
filters=f"[0:v]trim=end_frame=2442,setpts=PTS-STARTPTS,{color(old[0])}[a];[1:v]split[t1][t2];[t1]trim=end_frame=1116,setpts=PTS-STARTPTS,{color(tail[0])}[b];[3:v]setpts=PTS-STARTPTS,{color(builder[0])}[e];[2:v]setpts=PTS-STARTPTS,{color(network[0])}[c];[t2]trim=start_frame=4044,setpts=PTS-STARTPTS,{color(tail[0])}[d];[a][b][e][c][d]concat=n=5:v=1:a=0[v]"
target=args.destination/'nodemere-scenes-1-7-preview.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.previous),'-i',str(args.tail),'-i',str(args.network_fix),'-i',str(args.builder_fix),'-filter_complex',filters,'-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-video_track_timescale','90000','-movflags','+faststart',str(target)],check=True)
streams=probe(target);s=streams[0]
assert len(streams)==1 and int(s['nb_frames'])==7176 and s['width']==1920 and s['height']==1080
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
metadata={'revision':'06-network-handoff','file':target.name,'width':1920,'height':1080,'fps':60,'frames':7176,'seconds':119.6,'audio_streams':0,'codec':'H.264 High','pixel_format':'yuv420p','color_space':'bt709','full_decode':'passed','scenes':{'opening':0,'audition':16.7,'calendar':40.7,'drop_ins':59.3,'network':81.3,'handoff':107.3},'language_copy':'Speak your customers’ language. (Numeric count omitted: brief and homepage conflict.)','assembly':'Approved revision05 first 2442 frames; Calendar with text-only hero and new scenes 5–7.','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
(args.destination/'nodemere-scenes-1-7-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
