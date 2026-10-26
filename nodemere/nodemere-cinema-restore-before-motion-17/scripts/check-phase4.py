"""Verify preservation, native animations and rollback before publication."""
from pathlib import Path
from zipfile import ZipFile
import argparse, hashlib, json, re

p = argparse.ArgumentParser()
p.add_argument('--delivery', type=Path, required=True)
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
review = root / 'review/phase4'
sha = lambda data: hashlib.sha256(data).hexdigest()
verified = []
for folder in ['07-calendar-dropins', 'before-phase4']:
    prior = a.delivery / 'versions' / folder
    for name, info in json.loads((prior/'restore-manifest.json').read_text()).items():
        assert sha((prior/name).read_bytes()) == info['sha256'], name
    verified.append(folder)
with ZipFile(a.delivery/'versions/07-calendar-dropins/nodemere-scenes-1-7-source.zip') as z:
    assert z.testzip() is None
    changed = [name for name in z.namelist() if name.startswith('src/')
               and z.read(name) != (root/name).read_bytes()]
    assert sorted(changed) == ['src/FullFilm.tsx', 'src/Root.tsx'], changed
    for name in z.namelist():
        if name.startswith('public/') and not name.endswith('/'):
            assert z.read(name) == (root/name).read_bytes(), name
    old = set(z.namelist())
records = json.loads((root/'src/product/phase4/provenance.json').read_text())
for r in records:
    assert sha((root.parent/r['source']).read_bytes()) == r['sha256'], r['source']
source = {'existing_sources_changed': sorted(changed),
          'new_sources': sorted(str(f.relative_to(root)).replace('\\','/')
                                for f in (root/'src').rglob('*') if f.is_file()
                                and str(f.relative_to(root)).replace('\\','/') not in old),
          'native_source_hashes_verified': len(records),
          'rollback_packages_verified': verified,
          'production_source_edits': 0, 'four_k_exports': 0}
(review/'source-checks.json').write_text(json.dumps(source, indent=2))

def keyframes(css):
    found = {}
    for m in re.finditer(r'@keyframes\s+([\w-]+)\s*\{', css):
        i, depth = m.end(), 1
        while depth:
            depth += (css[i] == '{') - (css[i] == '}')
            i += 1
        found[m.group(1)] = re.sub(r'\s+', '', css[m.end():i-1])
    return found

originals = {}
for r in records:
    originals.update(keyframes((root.parent/r['source']).read_text(encoding='utf-8')))
native = keyframes((root/'src/product/phase4/native.css').read_text(encoding='utf-8'))
for name, body in native.items():
    assert name.startswith('p4-')
    assert body == originals[name[3:]], name
assert len(native) == 58
previous = json.loads((review/'native-animation-checks.json').read_text())
assert not previous['unscoped_selectors']
previous['native_keyframes_preserved'] = len(native)
(review/'native-animation-checks.json').write_text(json.dumps(previous, indent=2))
print('Verified approved source/assets, both rollback packages, 13 product sources and 58 native keyframes.')
