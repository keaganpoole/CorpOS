from pathlib import Path
import subprocess,json,hashlib,shutil
root=Path(__file__).resolve().parents[1];out=root/'out'
release=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs\versions\10-scenarios-logic-nest-hover')
assert not (release/'restore-manifest.json').exists(),'Do not modify a published release'
target=release/'nodemere-scenes-1-10-preview.mp4';original=out/'refinement10-before-framing.mp4'
assert not original.exists();shutil.copy2(target,original)
def count(f):return int(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames','-of','json',str(f)],text=True))['streams'][0]['nb_frames'])
parts=[]
for name,start,n in [('kept-start',0,10431),('kept-end',186.35,4065)]:
 f=out/f'refinement10-{name}.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(start),'-i',str(original),'-frames:v',str(n),'-an','-c:v','copy','-video_track_timescale','90000',str(f)],check=True);assert count(f)==n
for name,n in [('kept-start',10431),('patch-framing',750),('kept-end',4065)]:
 source=out/f'refinement10-{name}.mp4';assert count(source)==n
 f=out/f'refinement10-normalized-{name}.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-an','-c:v','copy','-video_track_timescale','90000',str(f)],check=True);parts.append(f)
listing=out/'refinement10-patch-concat.txt';listing.write_text('\n'.join("file '"+f.as_posix()+"'" for f in parts))
fixed=out/'refinement10-checked-assembly.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-an','-c:v','copy','-video_track_timescale','90000','-movflags','+faststart',str(fixed)],check=True)
assert count(fixed)==15246
shutil.copy2(fixed,target)
p=release/'nodemere-scenes-1-10-metadata.json';meta=json.loads(p.read_text());meta.update(full_decode='pending',sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size);meta['assembly']+=' Frames 10431–11180 re-rendered for earlier branch framing; other encoded frames retained.';p.write_text(json.dumps(meta,indent=2))
shutil.copy2(root/'review/refinement10/patch-10728.png',root/'review/refinement10/stills/09-Scenarios-28_7.png')
print('Framing correction assembled; 15246 frames.',flush=True)
