"""Append the new continuation without re-encoding the approved scenes 1-7."""
from pathlib import Path
import argparse, subprocess, json, hashlib

p=argparse.ArgumentParser()
p.add_argument('--previous',type=Path,required=True)
p.add_argument('--tail',type=Path,required=True)
p.add_argument('--destination',type=Path,required=True)
a=p.parse_args();a.destination.mkdir(parents=True,exist_ok=True)
def probe(file):
 return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(file)],text=True))['streams']
old,new=probe(a.previous),probe(a.tail)
assert len(old)==len(new)==1
for stream in old+new:
 assert (stream['width'],stream['height'],stream['avg_frame_rate'],stream['codec_name'],stream['pix_fmt'],stream['color_space'])==(1920,1080,'60/1','h264','yuv420p','bt709')
assert int(old[0]['nb_frames'])==7176 and int(new[0]['nb_frames'])==7590
# Match the existing file's timebase before concatenation. Preserve every frame.
normalized=a.tail.with_name('phase4-tail-90000.mp4')
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(a.tail),'-map','0:v:0','-c','copy','-video_track_timescale','90000',str(normalized)],check=True)
listing=a.tail.with_name('phase4-concat.txt')
listing.write_text('\n'.join("file '"+str(f.resolve()).replace('\\','/')+"'" for f in [a.previous,normalized]),encoding='utf-8')
target=a.destination/'nodemere-scenes-1-10-preview.mp4'
assert not target.exists(),'Never overwrite a delivered release'
subprocess.run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',str(listing),'-map','0:v:0','-c','copy','-video_track_timescale','90000','-movflags','+faststart',str(target)],check=True)
stream=probe(target)
assert len(stream)==1 and int(stream[0]['nb_frames'])==14766
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
def decoded_hash(file,frames):
 result=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(file),'-frames:v',str(frames),'-an','-f','hash','-hash','sha256','-'],text=True).strip()
 return result.split('=')[-1]
cache=a.tail.parent/'phase4-prefix-reference.json'
previous_sha=hashlib.sha256(a.previous.read_bytes()).hexdigest()
reference=json.loads(cache.read_text()) if cache.exists() else {}
if reference.get('encoded_sha256')==previous_sha:
 prefix_old=reference['decoded_sha256']
else:
 prefix_old=decoded_hash(a.previous,7176)
 cache.write_text(json.dumps({'encoded_sha256':previous_sha,'decoded_sha256':prefix_old},indent=2))
prefix_new=decoded_hash(target,7176)
assert prefix_old==prefix_new,'Approved prefix must be pixel-identical'
meta=json.loads((a.previous.parent/'nodemere-scenes-1-7-metadata.json').read_text(encoding='utf-8'))
meta.update(revision='08-people-scenarios-nest',file=target.name,frames=14766,seconds=246.1,
 assembly='Revision07 copied without re-encoding; new 7590-frame continuation appended with matched timebase.',
 preserved_prefix_decoded_sha256=prefix_old,full_decode='passed',
 sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size)
meta['scenes'].update(people=119.6,scenarios=150.1,nest=185.1)
(a.destination/'nodemere-scenes-1-10-metadata.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print(json.dumps(meta,indent=2))
