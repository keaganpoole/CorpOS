from pathlib import Path
p=Path('src/ScenariosScene.tsx');s=p.read_text().replace('<NativeClock time={34.6}><GrowingWorkflow time={34.6}/></NativeClock>','<NativeClock time={sweepTime}><GrowingWorkflow time={sweepTime}/></NativeClock>');p.write_text(s)
