from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[1];out=root/'out';tail=out/'refinement09-tail.mp4'
original=out/'refinement09-tail-before-qa.mp4'
assert not original.exists();tail.rename(original)
parts=[]
def probe(f):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames','-of','json',str(f)],text=True))['streams'][0]['nb_frames']
for name,start,count in [('middle',8.3,3658),('end',80.383333333333,1414)]:
 file=out/f'refinement09-kept-{name}.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(start),'-i',str(original),'-frames:v',str(count),'-an','-c:v','copy','-video_track_timescale','90000',str(file)],check=True);assert int(probe(file))==count
for name,count in [('patch-intro',498),('kept-middle',3658),('patch-milestone',667),('kept-end',1414)]:
 source=out/f'refinement09-{name}.mp4';assert int(probe(source))==count
 file=out/f'refinement09-normalized-{name}.mp4';subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-an','-c:v','copy','-video_track_timescale','90000',str(file)],check=True);parts.append(file)
listing=out/'refinement09-patch-concat.txt';listing.write_text('\n'.join("file '"+f.as_posix()+"'" for f in parts))
subprocess.run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',str(listing),'-an','-c:v','copy','-video_track_timescale','90000','-movflags','+faststart',str(tail)],check=True);assert int(probe(tail))==6237
release=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs\versions\09-scenarios-nest-refinement');assert not (release/'restore-manifest.json').exists()
(release/'nodemere-scenes-1-10-preview.mp4').rename(out/'refinement09-preview-before-qa.mp4')
print('Patched only the intro and milestone ranges; remaining encoded frames retained.')
