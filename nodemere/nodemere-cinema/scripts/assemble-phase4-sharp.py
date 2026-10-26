"""Assemble the PNG-frame continuation and refined Intercom segment."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1];out=root/'out'
subprocess.run(['ffmpeg','-nostdin','-v','error','-y',
 '-i',str(out/'phase4-tail-final.mp4'),'-i',str(out/'phase4-intercom-final.mp4'),
 '-filter_complex','[0:v]trim=end_frame=5943,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]',
 '-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2','-pix_fmt','yuv420p',
 '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
 '-video_track_timescale','90000','-movflags','+faststart',str(out/'phase4-tail-delivery.mp4')],check=True)
print('Final sharp continuation assembled: 7590 frames.')
