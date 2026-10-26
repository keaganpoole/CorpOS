from pathlib import Path
import subprocess,json,hashlib
from concurrent.futures import ThreadPoolExecutor
old=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs\versions\09-scenarios-nest-refinement\nodemere-scenes-1-10-preview.mp4')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(old),'-frames:v','8768','-an','-c:v','copy','-video_track_timescale','90000','out/refinement10-prefix.mp4'],check=True)
def h(f):return subprocess.check_output(['ffmpeg','-v','error','-i',str(f),'-frames:v','8760','-an','-f','hash','-hash','sha256','-'],text=True).strip().split('=')[-1]
with ThreadPoolExecutor(2) as ex:vals=list(ex.map(h,[old,Path('out/refinement10-prefix.mp4')]))
assert vals[0]==vals[1],vals
Path('review/refinement10/prefix.json').write_text(json.dumps({'frames':8760,'decoded_sha256':vals[0],'previous_encoded_sha256':hashlib.sha256(old.read_bytes()).hexdigest()},indent=2))
print('8760 prefix frames copied pixel-identically',vals[0])
