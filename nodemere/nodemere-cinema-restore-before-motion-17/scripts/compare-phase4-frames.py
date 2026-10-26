"""Compare exact encoded frames with the reviewed 1080p PNG references."""
from pathlib import Path
from PIL import Image
import argparse, json, subprocess
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('video', type=Path)
p.add_argument('--tail', action='store_true')
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
review = root / 'review/phase4'
results = []
for scene, start, times in [
    ('08-People', 119.6, [12.4, 19.7, 24.6]),
    ('09-Scenarios', 150.1, [6.8, 17, 30]),
    ('10-Nest', 185.1, [8.9, 21, 40.5]),
]:
    for time in times:
        frame = round((start + time - (119.6 if a.tail else 0)) * 60)
        raw = subprocess.check_output([
            'ffmpeg', '-nostdin', '-v', 'error', '-i', str(a.video),
            '-vf', f'select=eq(n\\,{frame})', '-frames:v', '1',
            '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'
        ])
        actual = np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3)
        name = f'{scene}-{str(time).replace(".", "_")}'
        reference = np.asarray(Image.open(review / f'stills/{name}.png').convert('RGB'))
        error = float(np.abs(actual.astype(float) - reference.astype(float)).mean())
        Image.fromarray(actual).save(review / f'{name}-delivery.png')
        results.append({'scene': scene, 'local_seconds': time, 'frame': frame,
                        'mean_rgb_absolute_error_out_of_255': error})
        print(name, round(error, 4), flush=True)
record = {'method': 'Exact decoded frame index, RGB comparison with native PNG reference',
          'video': str(a.video.resolve()), 'samples': results}
(review / 'native-encoded-comparison.json').write_text(json.dumps(record, indent=2))
assert max(r['mean_rgb_absolute_error_out_of_255'] for r in results) < 2.0
