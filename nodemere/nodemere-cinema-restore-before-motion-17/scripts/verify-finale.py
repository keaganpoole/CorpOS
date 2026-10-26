"""Read-only checks of the reviewed frames and source preservation. No video export."""
from pathlib import Path
import hashlib, json, math, re
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parents[1]
delivery = Path(r'C:\Users\Keagan\Documents\Codex\2026-10-14\realtime-voice-chat-2\outputs')
review = root / 'review/finale'
stills = review / 'stills'
results = {}
def image(name): return Image.open(stills / name).convert('RGB')
def same(a,b): return ImageChops.difference(image(a),image(b)).getbbox() is None
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

source = json.loads((delivery/'versions/before-final-scenes/source-hashes.json').read_text())
changed = [name for name,digest in source.items() if sha(root/name) != digest]
assert set(changed) == {r'src\FullFilm.tsx',r'src\Root.tsx'},changed
results['prior_source_files_preserved'] = len(source)-2
results['changed_existing_source_files'] = changed
provenance = json.loads((root/'src/product/finale/provenance.json').read_text())
for entry in provenance:
    assert sha(root.parent/entry['source']) == entry['sha256'],entry['source']
assert (root/'public/finale/nodemere.svg').read_bytes() == (root.parent/'public/logo/nodemere.svg').read_bytes()
assert (root/'src/product/finale/logoPresets.js').read_bytes() == (root.parent/'src/pages/logo/logoPresets.js').read_bytes()
results['native_sources_unchanged'] = len(provenance)
results['authentic_logo_and_preset_exact_copies'] = True

timing = (root/'src/finaleTiming.ts').read_text()
values = {key:int(value) for key,value in re.findall(r'(\w+): (\d+)',timing)}
assert values['holdEnd']-values['fadeEnd'] == 150
assert list(values.values()) == sorted(values.values())
for f in [220,293,468,469]:
    assert same('12-Final-Logo-144.png',f'12-Final-Logo-{f}.png'),f
assert same('Nodemere-Film-16350.png','Nodemere-Film-16499.png')
results['logo_still_hold_frames'] = 150
results['signature_finished_before_fade'] = True
for name in ['11-Encryption-933.png','11-Encryption-959.png','12-Final-Logo-0.png',
             '12-Final-Logo-523.png','12-Final-Logo-558.png','Nodemere-Film-16764.png']:
    assert image(name).getbbox() is None,name
results['pure_black_checks'] = 6
assert same('Nodemere-Film-15245.png','Nodemere-Film-15246.png')
results['nest_to_encryption_first_frame_exact'] = True
assert same('11-Encryption-660.png','11-Encryption-810.png')
assert image('11-Encryption-660.png').crop((0,890,1920,1080)).getbbox() is not None
results['settled_security_and_caption'] = True
for ref,name in [('repeat-security-reference.png','11-Encryption-450.png'),
                 ('repeat-logo-reference.png','12-Final-Logo-360.png')]:
    assert ImageChops.difference(Image.open(review/ref).convert('RGB'),image(name)).getbbox() is None,name
results['independent_repeated_frame_captures_match'] = True
bounds=image('12-Final-Logo-144.png').getbbox()
assert abs((bounds[0]+bounds[2])/2-960) <= 1
assert abs((bounds[1]+bounds[3])/2-540) <= 2
results['logo_centered'] = True

names = [f'11-Encryption-{f}.png' for f in [72,180,240,330,450,570,660,810,933,959]]
names += [f'12-Final-Logo-{f}.png' for f in [0,72,143,144,220,293,322,360,410,468,469,500,523,558]]
sheet = Image.new('RGB',(1440,math.ceil(len(names)/3)*300),(18,18,18))
draw = ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    im=image(name);im.thumbnail((480,270));x=i%3*480;y=i//3*300
    sheet.paste(im,(x,y));draw.text((x+8,y+275),name,fill='white')
sheet.save(review/'contact-sheet.jpg',quality=92)
results['reviewed_contact_sheet_frames'] = len(names)
results['video_exported'] = False
(review/'verification.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
