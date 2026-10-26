from pathlib import Path
import re
r=Path.cwd()
def edit(name,old,new):
 p=r/name;s=p.read_text(encoding='utf-8');assert old in s,name;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
# Shared hero supports native word treatment without changing other heroes.
edit('src/PhaseTwoShared.tsx','  eyebrow,\n}: {','  eyebrow,\n  content,\n}: {')
edit('src/PhaseTwoShared.tsx','  eyebrow?: string;','  eyebrow?: string;\n  content?: React.ReactNode;')
edit('src/PhaseTwoShared.tsx','overflow: "hidden", paddingBottom: 12','overflow: content ? "visible" : "hidden", paddingBottom: 12')
edit('src/PhaseTwoShared.tsx','          {title}\n','          {content ?? title}\n')
source=(r.parent/'src/components/CalendarShowcase.jsx').read_text(encoding='utf-8')
css=re.search(r'const CRM_STUNNING_STYLES = `(.*?)`;',source,re.S).group(1)
(r/'src/HomepageHeadlines.tsx').write_text('''import type { CSSProperties } from "react";
import { Hero } from "./PhaseTwoShared";
// Exact homepage CrmStunningWord keyframes; only its clock is replaced.
const CRM_STUNNING_STYLES = `'''+css+'''`;
export function StunningWord({time}: {time:number}) {
  const base: CSSProperties = {padding: '.22em .16em .42em', margin:'-.22em -.16em -.42em', lineHeight:'inherit', animationDuration:'1.2s', animationTimingFunction:'cubic-bezier(.16,1,.3,1)', animationIterationCount:1, animationFillMode:'forwards', animationPlayState:'paused', animationDelay:`${-Math.max(0,time)}s`};
  return <><style>{CRM_STUNNING_STYLES}</style><span aria-label="Stunning." style={{position:'relative',margin:'0 .08em',display:'inline-block',overflow:'visible',verticalAlign:'baseline'}}>
    <span aria-hidden style={{visibility:'hidden',display:'inline-block'}}>Stunning.</span>
    <span aria-hidden style={{position:'absolute',left:0,top:0,display:'block',overflow:'visible',lineHeight:'inherit',pointerEvents:'none'}}>
      <span style={{...base,position:'absolute',left:0,top:0,color:'#ff0055',mixBlendMode:'screen',animationName:'crm-prism-red-move'}}>Stunning.</span>
      <span style={{...base,position:'absolute',left:0,top:0,color:'#00ffcc',mixBlendMode:'screen',animationName:'crm-prism-blue-move'}}>Stunning.</span>
      <span style={{...base,position:'relative',display:'inline-block',backgroundImage:'linear-gradient(to bottom,#fff,#f4f4f5,#71717a)',backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',filter:'drop-shadow(0 2px 12px rgba(255,255,255,.1))',animationName:'crm-prism-green-move, crm-flash-settle',animationDuration:'1.2s,.9s',animationDelay:`${-Math.max(0,time)}s,${.24-Math.max(0,time)}s`,animationTimingFunction:'cubic-bezier(.16,1,.3,1),ease-out',animationIterationCount:'1,1'}}>Stunning.</span>
    </span>
  </span></>;
}
export function FutureHero({time,y=0}:{time:number;y?:number}) {
 return <Hero title={"Welcome to the future\\nof the front desk."} kind="portrait" showMark={false} time={time} y={y} content={<span style={{display:'inline-block',textAlign:'center'}}>Welcome to the <span style={{display:'inline-block',backgroundImage:'linear-gradient(90deg,#ff32ac,#8B5CF6)',backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',paddingRight:'.04em'}}>future</span><br/>of the front desk.</span>}/>;
}
''',encoding='utf-8')
edit('src/PeopleScene.tsx','import { Hero }','import { StunningWord } from "./HomepageHeadlines";\nimport { Hero }')
edit('src/PeopleScene.tsx','title="One. Stunning. CRM."','title="One. Stunning. CRM."\n            content={<>One.<StunningWord time={t - .2} /> CRM.</>}')
edit('src/EncryptionScene.tsx','title="World-Class Encryption."','title="World-Class Encryption."\n              eyebrow="Encryption"')
# Exact native CSS keyframes, deterministic paused phase. Preserve separate border sweep.
csssource=(r.parent/'src/styles/HomePage.css').read_text(encoding='utf-8')
key=re.search(r'@keyframes demoCallStatusGradient \{.*?\n\}',csssource,re.S).group(0)
p=r/'src/phase2.css';p.write_text(p.read_text()+ '\n'+key+'\n.phase2-calendar .demo-call-agenda-item { animation: demoCallStatusGradient 4.8s ease-in-out infinite; animation-play-state: paused; animation-delay: var(--call-gradient-clock, 0s); }\n')
edit('src/CalendarScene.tsx','const age = time - 2.15','const age = time - 2.45')
edit('src/CalendarScene.tsx','height: 52,','height: 52,\n                "--call-gradient-clock": `${-Math.max(0, t - 10.9)}s`,')
# Second pause adds exactly 2.38 seconds; first pause unchanged.
edit('src/RevisionFour.tsx','18 - INTRO_ADVANCE + COLLECTION_EXTENSION;','18 - INTRO_ADVANCE + COLLECTION_EXTENSION + 2.38;')
edit('src/RevisionFour.tsx','export const collectionStoryTime = (t: number) =>','const firstCollectionStoryTime = (t: number) =>')
edit('src/RevisionFour.tsx','export const DirectedOpening: React.FC','export const collectionStoryTime = (t: number) => t < 10.63 ? firstCollectionStoryTime(t) : t > 13.31 ? firstCollectionStoryTime(t - 2.38) : continuousTrack(t,[10.63,10.93,13.01,13.31],[11.93,12.08,12.08,12.23],[1,0,0,1]);\n\nexport const DirectedOpening: React.FC')
edit('src/RevisionFour.tsx','title={"Choose your receptionist\\nfrom our collection."}','title={"Deploy the world’s most advanced\\nAI receptionist."}')
needle='      {storyTime >= 9.1 + COLLECTION_EXTENSION && ('
edit('src/RevisionFour.tsx',needle,'''      {t >= 10.63 && t < 13.31 && <div className="collection-mid-hero" style={{position:'absolute',inset:0,opacity:p(t,10.63,10.93,glide)*(1-p(t,13.01,13.31,glide))}}>
        <style>{`.collection-mid-hero > div > div > div {white-space:pre-line;text-align:center;}`}</style>
        <Hero title={"Choose your receptionist\\nfrom our collection."} eyebrow="Collection" kind="portrait" showMark={false} time={(t-10.63)*1.84}/>
      </div>}
'''+needle)
# Faster Nest notifications, actual supported payment event.
edit('src/product/phase4/NestSurface.tsx','at: 12.3,','at: 9.7,')
edit('src/product/phase4/NestSurface.tsx','at: 19.65,','at: 14.4,')
edit('src/product/phase4/NestSurface.tsx','''at: 26.8,
    category: "milestones",
    event_type: "first_appointment_booked",
    title: "First appointment booked",
    message: "Your calendar is ready for business",
    payload: {},''','''at: 19.1,
    category: "payments",
    event_type: "payment_received",
    title: "Payment received",
    message: "$50 appointment deposit",
    payload: {first_name: "Emma", last_name: "Wilson"},''')
edit('src/product/phase4/NestSurface.tsx','p(t, 3.1, 3.82, reelEase)','p(t, 2, 2.5, reelEase)')
edit('src/product/phase4/NestSurface.tsx','p(t, 6.38, 7)','p(t, 4.2, 4.7)')
edit('src/product/phase4/NestSurface.tsx','0.25 *\n              (i === index','0.20 *\n              (i === index')
# Keep original Intercom clock and camera; insert title in shortened notification section.
edit('src/NestScene.tsx','NEST_SECONDS = 62','NEST_SECONDS = 54.7')
edit('src/NestScene.tsx','n = t - 0.75;','n = t - 0.75;\n  const intercomTime = n + 7.3;\n  const titleOpacity = p(n,23.65,24.05) * (1-p(n,26.25,26.75));')
edit('src/NestScene.tsx','p(n, 33.55, 34.4, slowFastSlow)','p(intercomTime, 33.55, 34.4, slowFastSlow)')
edit('src/NestScene.tsx','{n < 34.4 && (','{intercomTime < 34.4 && (')
edit('src/NestScene.tsx','{n >= 33.55 && <FilmIntercom time={n} />}','{intercomTime >= 33.55 && <FilmIntercom time={intercomTime} />}')
p=r/'src/NestScene.tsx';s=p.read_text();a=s.index('            <Cursor');b=s.index('          </div>',a);s=s[:a]+re.sub(r'\bn\b','intercomTime',s[a:b])+s[b:];s=s.replace('      </Stage>','''        {n >= 23.65 && n < 26.75 && <div style={{position:'absolute',inset:0,opacity:titleOpacity}}><Hero title="Talk with your receptionist" eyebrow="Intercom" kind="portrait" showMark={false} time={(n-23.65)*1.4}/></div>}
      </Stage>''');p.write_text(s)
print('Shared headlines, collection, calendar and Nest changes applied.')
