from pathlib import Path
p=Path('src/ScenariosScene.tsx');s=p.read_text();s=s.replace('<GrowingWorkflow time={34.6}/></div>}', '<NativeClock time={34.6}><GrowingWorkflow time={34.6}/></NativeClock></div>}');p.write_text(s)
