from pathlib import Path
p=Path('src/DropInsScene.tsx');p.write_text(p.read_text().replace('import { smooth, mix }','import { smooth }'))
p=Path('src/ScenariosScene.tsx');s=p.read_text().replace('export const SCENARIOS_SECONDS = 42;','export const SCENARIOS_SECONDS = 46.4;')
s=s.replace('const t = useCurrentFrame() / fps;','''const clock = useCurrentFrame() / fps;
  // Reuse the existing close pass as a preview, then resume the original build.
  const t = clock < 5.65 ? clock : clock < 10.05 ? 5.65 : clock - 4.4;
  const teaser = clock >= 5.65 && clock < 11.25;
  const teaserBlend = 1 - p(clock, 10.05, 11.25, slowFastSlow);
  const sweepTime = teaser ? 30.2 + clock - 5.65 : t;''')
s=s.replace('if (t >= 28.4) {','if (t >= 28.4 || teaser) {')
s=s.replace('c[key] = continuousTrack(t, times, values[key], slopes[key]);','const sweepValue = continuousTrack(sweepTime, times, values[key], slopes[key]);\n      c[key] = teaser ? c[key] + (sweepValue - c[key]) * teaserBlend : sweepValue;')
s=s.replace('<GrowingWorkflow time={t} />','''<div style={{opacity:teaser ? p(clock,10.2,10.8) : 1}}><GrowingWorkflow time={t}/></div>
            {teaser && <div style={{position:'absolute',inset:0,opacity:1-p(clock,10.2,10.8)}}><GrowingWorkflow time={34.6}/></div>}''')
s=s.replace('{t < 6.15 && (','{clock < 5.65 && (')
s=s.replace('p(t, 5.42, 5.6) * (1 - p(t, 5.7, 6.05))','p(clock, 5.42, 5.6) * (1 - p(clock, 5.7, 6.05))')
p.write_text(s)
