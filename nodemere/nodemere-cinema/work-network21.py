from pathlib import Path
r=Path.cwd()
p=r/'src/NetworkScene.tsx';s=p.read_text();s=s.replace('  Repeat2,','  Repeat2,\n  Moon,\n  FileUp,');s=s.replace('import { Stage, p }','import { FutureHero } from "./HomepageHeadlines";\nimport { Stage, p }')
s=s.replace('export const NETWORK_SECONDS = 26;','export const NETWORK_LEAD = 1.2;\nexport const NETWORK_SECONDS = 35.8 + NETWORK_LEAD;')
a=s.index('export const FEATURES = [');b=s.index('// The four branching',a)
s=s[:a]+'''export const FEATURES: {at:number;end:number;text:string;description?:string}[] = [
  {at:0,end:4.6,text:"One Receptionist. Multiple Conversations in Parallel."},
  {at:4.6,end:8.2,text:"Inbound & Outbound Calls."},
  {at:8.2,end:14,text:"24/7 Call Handling",description:"Keep your front desk running 24/7. While the competition wakes up to voicemails, you wake up to appointments already booked."},
  {at:14,end:18,text:"Document Uploads"},
  {at:18,end:21.6,text:"Take Payments Right on the Phone."},
  {at:21.6,end:25.2,text:"Speak your customers’ language."},
  {at:25.2,end:28.8,text:"Turn Calls Into Appointments."},
  {at:28.8,end:33.8,text:"Follow Up Automatically."},
];

'''+s[b:]
s=s.replace('export const NODES = [','const originalNodes = [',1)
pos=s.index('const groupStart')
s=s[:pos]+'''export const NODES = [
  ...originalNodes.map(n => n.beat < 2 ? n : {...n,at:n.at+9.8,beat:n.beat+2}),
  {x:580,y:270,g:0,at:8.55,beat:2,photo:3,path:"M530 408 C500 335 580 345 580 270"},
  {x:1130,y:265,g:2,at:9.5,beat:2,photo:8,path:"M1330 425 C1180 425 1225 265 1130 265"},
  {x:845,y:260,g:0,at:14.35,beat:3,photo:5,path:"M530 408 C710 408 700 260 845 260"},
  {x:1040,y:950,g:3,at:15.15,beat:3,photo:6,path:"M1330 780 C1150 780 1200 950 1040 950"},
].sort((a,b)=>a.at-b.at);
'''+s[pos:]
a=s.index('function Indicator');b=s.index('export function NetworkWorld',a);part=s[a:b]
part=part.replace('beat === 2','beat === 4').replace('beat === 4\n          ? CalendarCheck','beat === 6\n          ? CalendarCheck').replace('beat === 3 ? (','beat === 5 ? (')
part=part.replace('          : Repeat2;','          : beat === 2 ? Moon : beat === 3 ? FileUp : Repeat2;')
part=part.replace('<Icon size={31} strokeWidth={1.7} />','<><Icon size={beat === 2 ? 22 : 31} strokeWidth={1.7} />{beat === 2 && <span style={{fontSize:17,fontWeight:500}}>2 AM</span>}</>')
s=s[:a]+part+s[b:]
s=s.replace('p(t, 23.6, 26, smooth)','p(t, 33.4, 35.8, smooth)').replace('Math.min(t, 23.6)','Math.min(t, 33.4)').replace('[0, 3.7, 8, 15, 21.5, 23.6]','[0, 3.7, 8, 24.8, 31.3, 33.4]').replace('p(t, 1, 21.5, smooth)','p(t, 1, 31.3, smooth)').replace('p(t, 23.6, 24.1)','p(t, 33.4, 33.9)')
s=s.replace('const t = useCurrentFrame() / useVideoConfig().fps;','const clock = useCurrentFrame() / useVideoConfig().fps;\n  const t = clock - NETWORK_LEAD;')
s=s.replace('<NetworkWorld time={t} />','<div style={{position:"absolute",inset:0,opacity:p(clock,.45,1.2),translate:`0 ${100*(1-p(clock,.45,1.2))}px`}}><NetworkWorld time={Math.max(0,t)} /></div>\n        {clock < 1.2 && <FutureHero time={clock+2.9} y={-1080*p(clock,.3,1.2,smooth)}/>}')
s=s.replace('            />\n          </div>\n        ))}', '''            />
            {f.description && <div style={{fontSize:22,lineHeight:1.45,color:'#929298',maxWidth:1080,margin:'18px auto 0',opacity:p(t,f.at+.35,f.at+.8)}}>{f.description}</div>}
          </div>
        ))}''')
p.write_text(s)
# Final Drop-ins slide reveals same future hero; Network inherits that exact frame.
p=r/'src/DropInsScene.tsx';s=p.read_text().replace('  Sequence,\n','').replace('import { PiperPortrait, smooth, mix }','import { smooth, mix }');s=s.replace('import React from "react";','import React from "react";\nimport { FutureHero } from "./HomepageHeadlines";')
a=s.index('        {t >= 19.1 && (');b=s.index('      </Stage>',a)
s=s[:a]+'''        {t >= 19.1 && <div style={{position:'absolute',inset:0,translate:`${1920*(1-network)}px 0`}}><FutureHero time={t-19.1}/></div>}
'''+s[b:];p.write_text(s)
print('Network beats and connected future headline added.')
