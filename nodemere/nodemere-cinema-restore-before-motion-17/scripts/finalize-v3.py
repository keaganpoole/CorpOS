from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[1]
master=root/'out/nodemere-scenes-1-2-v3-4k.mp4'
preview=root/'out/nodemere-scenes-1-2-v3-preview.mp4'
def probe(file):
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(file)],text=True))
    streams=data['streams']; assert len(streams)==1 and streams[0]['codec_type']=='video'
    s=streams[0]; assert s['r_frame_rate']=='60/1' and int(s['nb_frames'])==2100
    assert abs(float(data['format']['duration'])-35)<.02
    return dict(file=file.name,width=s['width'],height=s['height'],fps=s['r_frame_rate'],frames=int(s['nb_frames']),duration=float(data['format']['duration']),codec=s['codec_name'],audio_streams=0,bytes=file.stat().st_size,sha256=hashlib.sha256(file.read_bytes()).hexdigest())
master_data=probe(master); assert(master_data['width'],master_data['height'])==(3840,2160)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-xerror','-i',str(master),'-map','0:v:0','-f','null','NUL'],check=True)
print('4K master: complete decode passed, 2100 frames, no audio.',flush=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(master),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(preview)],check=True)
preview_data=probe(preview);assert(preview_data['width'],preview_data['height'])==(1920,1080)
metadata=dict(master=master_data,preview=preview_data,decode_check='FFmpeg -xerror full-master decode passed',scope='Scenes 1 and 2 only')
(root/'out/export-metadata-v3.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
print('Matching 1080p60 preview verified.',flush=True)
subprocess.run(['python',str(root/'scripts/review-v3.py'),'out/nodemere-scenes-1-2-v3-preview.mp4'],cwd=root,check=True)
