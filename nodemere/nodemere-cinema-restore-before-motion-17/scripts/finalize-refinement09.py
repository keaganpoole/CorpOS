"""Assemble revision09 and verify the copied earlier scenes."""
from pathlib import Path
import argparse,subprocess,json,hashlib
p=argparse.ArgumentParser();p.add_argument('--delivery',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];release=a.delivery/'versions/09-scenarios-nest-refinement';release.mkdir(parents=True,exist_ok=True)
prefix=root/'out/refinement09-prefix.mp4';tail=root/'out/refinement09-tail.mp4'
def probe(f):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(f)],text=True))['streams']
for f,frames in [(prefix,9009),(tail,6237)]:
 s=probe(f);assert len(s)==1;s=s[0];assert int(s['nb_frames'])==frames,(f,s['nb_frames']);assert (s['width'],s['height'],s['avg_frame_rate'],s['codec_name'],s['pix_fmt'],s['color_space'])==(1920,1080,'60/1','h264','yuv420p','bt709')
normalized=root/'out/refinement09-tail-normalized.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(tail),'-map','0:v:0','-c','copy','-video_track_timescale','90000',str(normalized)],check=True)
listing=root/'out/refinement09-concat.txt';listing.write_text('\n'.join("file '"+f.resolve().as_posix()+"'" for f in [prefix,normalized]))
target=release/'nodemere-scenes-1-10-preview.mp4';assert not target.exists(),'Do not overwrite a release'
subprocess.run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',str(listing),'-map','0:v:0','-c','copy','-video_track_timescale','90000','-movflags','+faststart',str(target)],check=True)
s=probe(target);assert len(s)==1 and int(s[0]['nb_frames'])==15246
reference=json.loads((root/'review/refinement09/prefix.json').read_text())
h=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(target),'-frames:v','9006','-an','-f','hash','-hash','sha256','-'],text=True).strip().split('=')[-1]
assert h==reference['decoded_sha256'],'Earlier scenes changed'
meta=json.loads((a.delivery/'versions/08-people-scenarios-nest/nodemere-scenes-1-10-metadata.json').read_text())
meta.update(revision='09-scenarios-nest-refinement',file=target.name,frames=15246,seconds=254.1,assembly='9009 original packets copied through the unchanged hero entrance at a closed GOP; revised Scenarios and Nest continuation appended.',preserved_prefix_frames=9006,preserved_prefix_decoded_sha256=h,full_decode='pending',sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size)
meta['scenes'].update(scenarios=150.1,nest=192.1)
(release/'nodemere-scenes-1-10-metadata.json').write_text(json.dumps(meta,indent=2));print('Assembled',target,flush=True)
