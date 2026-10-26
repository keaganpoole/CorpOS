"""Assemble the revised 1080p preview from the unchanged intro and new film tail."""
from pathlib import Path
import argparse, json, subprocess, hashlib

parser=argparse.ArgumentParser()
parser.add_argument('--previous',type=Path,required=True)
parser.add_argument('--tail',type=Path,required=True)
parser.add_argument('--destination',type=Path,required=True)
parser.add_argument('--work',type=Path,required=True)
args=parser.parse_args()
args.destination.mkdir(parents=True,exist_ok=True)
args.work.mkdir(parents=True,exist_ok=True)
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],text=True))
def validate(path,frames):
    info=probe(path); streams=info['streams']; assert len(streams)==1
    s=streams[0]
    assert (s['width'],s['height'])==(1920,1080), 'Preview only. 4K needs explicit permission.'
    assert s['avg_frame_rate']=='60/1' and int(s['nb_frames'])==frames
    return s
tail=validate(args.tail,2724)
source=probe(args.previous)['streams'][0]
assert (source['width'],source['height'])==(1920,1080)
def encode(source,target,frames=None):
    stream=probe(source)['streams'][0]
    matrix='bt709' if stream.get('color_space')=='bt709' else 'bt601'
    color_range='pc' if stream.get('color_range')=='pc' else 'tv'
    command=['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-map','0:v:0']
    if frames: command+=['-frames:v',str(frames)]
    command+=['-vf',f'scale=in_range={color_range}:out_range=tv:in_color_matrix={matrix}:out_color_matrix=bt709,format=yuv420p',
              '-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2',
              '-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
              '-video_track_timescale','90000','-movflags','+faststart',str(target)]
    subprocess.run(command,check=True)
prefix=args.work/'prefix-528.mp4'; normalized=args.work/'tail-rec709.mp4'
encode(args.previous,prefix,528); encode(args.tail,normalized)
validate(prefix,528); validate(normalized,2724)
listing=args.work/'assembly.ffconcat'
listing.write_text('ffconcat version 1.0\n'+''.join("file '"+str(path.resolve()).replace('\\','/').replace("'","'\\''")+"'\n" for path in [prefix,normalized]),encoding='utf-8')
target=args.destination/'nodemere-scenes-1-4-preview.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-map','0:v:0','-c','copy','-an','-movflags','+faststart',str(target)],check=True)
stream=validate(target,3252)
assert abs(float(stream['duration'])-54.2)<.001
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
result={'revision':'03-frost-calendar-hold','file':target.name,'width':1920,'height':1080,'fps':60,'frames':3252,'seconds':54.2,
        'audio_streams':0,'codec':'H.264 High','pixel_format':stream['pix_fmt'],'color_space':stream['color_space'],
        'full_decode':'passed','assembly':'Original first 528 frames normalized to matching Rec.709 encode, followed by new frames 528–3251.',
        'scenes':{'opening':0,'audition':16.7,'calendar':32.9},
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
(args.destination/'nodemere-scenes-1-4-metadata.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
