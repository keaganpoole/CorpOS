from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import json,zipfile
r=Path.cwd();p=r/'review/finale/stills'
c=json.loads((r/'review/refinement21-checks.json').read_text())
c['logoHoldPixelIdentical']=Image.open(p/'12-Final-Logo-144.png').tobytes()==Image.open(p/'12-Final-Logo-293.png').tobytes()
c['finalFrameBlack']=Image.open(p/'Nodemere-Film-17630.png').convert('RGB').getbbox() is None
assert c['logoHoldPixelIdentical'] and c['finalFrameBlack']
prev=Path(r'C:/Users/Keagan/Documents/Codex/2026-10-14/realtime-voice-chat-2/outputs/versions/20-builder-teams-indicators/nodemere-scenes-1-12-source.zip')
with zipfile.ZipFile(prev) as z:
 changed=[str(f.relative_to(r)) for f in (r/'src').rglob('*') if f.is_file() and (f.relative_to(r).as_posix() not in z.namelist() or f.read_bytes()!=z.read(f.relative_to(r).as_posix()))]
c['changedSourceFiles']=changed
(r/'review/refinement21-checks.json').write_text(json.dumps(c,indent=2))
print(json.dumps(c,indent=2))
