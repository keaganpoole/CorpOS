"""Replace the reviewed handoff intervals within the new, undelivered tail."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1];out=root/'out'
args=['ffmpeg','-nostdin','-v','error','-y','-i',str(out/'phase4-tail.mp4')]
for name in ['people','scenarios','nest']:args+=['-i',str(out/f'phase4-{name}-handoff.mp4')]
filters='[0:v]split=3[a][b][c];[a]trim=start_frame=210:end_frame=1830,setpts=PTS-STARTPTS[a1];[b]trim=start_frame=2040:end_frame=3930,setpts=PTS-STARTPTS[b1];[c]trim=start_frame=4140,setpts=PTS-STARTPTS[c1];[1:v]setpts=PTS-STARTPTS[p1];[2:v]setpts=PTS-STARTPTS[p2];[3:v]setpts=PTS-STARTPTS[p3];[p1][a1][p2][b1][p3][c1]concat=n=6:v=1:a=0[v]'
args+=['-filter_complex',filters,'-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','15','-profile:v','high','-level:v','4.2','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-video_track_timescale','90000','-movflags','+faststart',str(out/'phase4-tail-reviewed.mp4')]
subprocess.run(args,check=True)
print('Assembled corrected continuation: 7590 frames')
