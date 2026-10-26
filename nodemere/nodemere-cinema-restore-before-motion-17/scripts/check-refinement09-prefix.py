from pathlib import Path
import subprocess,json,hashlib
from concurrent.futures import ThreadPoolExecutor
old=Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs\versions\08-people-scenarios-nest\nodemere-scenes-1-10-preview.mp4')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(old),'-frames:v','9009','-an','-c:v','copy','-video_track_timescale','90000','out/refinement09-prefix.mp4'],check=True)
def h(f):return subprocess.check_output(['ffmpeg','-v','error','-i',str(f),'-frames:v','9006','-an','-f','hash','-hash','sha256','-'],text=True).strip().split('=')[-1]
with ThreadPoolExecutor(2) as ex:vals=list(ex.map(h,[old,Path('out/refinement09-prefix.mp4')]))
assert vals[0]==vals[1],vals
Path('review/refinement09/prefix.json').write_text(json.dumps({'frames':9006,'decoded_sha256':vals[0],'previous_encoded_sha256':hashlib.sha256(old.read_bytes()).hexdigest()},indent=2))
print('9006 prefix frames copied pixel-identically',vals[0])
