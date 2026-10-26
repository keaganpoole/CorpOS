"""Assemble only a 1080p review. Preserve the approved opening's video packets."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--opening', type=Path, required=True)
parser.add_argument('--new-scenes', type=Path, required=True)
parser.add_argument('--destination', type=Path, required=True)
parser.add_argument('--work', type=Path, required=True)
args = parser.parse_args()
args.work.mkdir(parents=True, exist_ok=True)
args.destination.mkdir(parents=True, exist_ok=True)

def run(command):
    return subprocess.check_output(command, text=True)

def probe(path):
    return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))

def validate(path, frames):
    info=probe(path)
    assert len(info['streams'])==1, 'The film must be silent.'
    stream=info['streams'][0]
    assert (stream['width'],stream['height'])==(1920,1080), 'This command is preview-only; 4K is not authorized.'
    assert stream['avg_frame_rate']=='60/1' and int(stream['nb_frames'])==frames
    return stream

opening=validate(args.opening,1002)
tail=validate(args.new_scenes,2550)
assert opening['color_space']=='bt709' and opening['color_range']=='tv'
matrix='bt709' if tail.get('color_space')=='bt709' else 'bt601'
color_range='pc' if tail.get('color_range')=='pc' else 'tv'
normalized=args.work/'new-scenes-rec709.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.new_scenes),'-map','0:v:0',
    '-vf',f'scale=in_range={color_range}:out_range=tv:in_color_matrix={matrix}:out_color_matrix=bt709,format=yuv420p',
    '-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2',
    '-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-video_track_timescale','90000','-movflags','+faststart',str(normalized)],check=True)

file_list=args.work/'assembly.ffconcat'
def concat_path(path):
    return str(path.resolve()).replace('\\','/').replace("'", "'\\''")
file_list.write_text('ffconcat version 1.0\n'+''.join(f"file '{concat_path(path)}'\n" for path in [args.opening,normalized]),encoding='utf-8')
target=args.destination/'nodemere-scenes-1-4-preview.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','0','-i',str(file_list),
    '-map','0:v:0','-c','copy','-an','-movflags','+faststart',str(target)],check=True)
stream=validate(target,3552)
assert stream['pix_fmt']=='yuv420p' and stream['color_space']=='bt709' and stream['color_range']=='tv'
assert abs(float(stream['duration'])-59.2)<.001
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)

def decoded_hashes(path, limit):
    data=run(['ffmpeg','-nostdin','-v','error','-i',str(path),'-map','0:v:0','-frames:v',str(limit),'-f','framemd5','-'])
    return [line.rsplit(',',1)[-1].strip() for line in data.splitlines() if not line.startswith('#')]
assert decoded_hashes(target,1002)==decoded_hashes(args.opening,1002), 'Approved opening changed.'
result={'file':target.name,'width':1920,'height':1080,'fps':60,'frames':3552,'seconds':59.2,
    'audio_streams':0,'codec':'H.264 High','pixel_format':'yuv420p','color_space':'bt709','color_range':'tv',
    'full_decode':'passed','approved_opening_1002_frame_hash_comparison':'identical',
    'opening_sha256':hashlib.sha256(args.opening.read_bytes()).hexdigest(),
    'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
(args.destination/'nodemere-scenes-1-4-metadata.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2),flush=True)
