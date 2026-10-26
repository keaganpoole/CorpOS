from pathlib import Path
p=Path('src/NestScene.tsx');s=p.read_text().replace('time={Math.max(0, n)}\n              style','time={Math.max(0, n >= 26.25 ? intercomTime : n)}\n              style');p.write_text(s)
