import fs from "node:fs/promises";
const read = (p) => fs.readFile(`../src/${p}`, "utf8");
// Source-derived presentation snapshots. No production imports with service effects.
const line = await read("sonar/nest/IntercomVoiceLine.jsx");
const waveFunctions = line.slice(
  line.indexOf("const LAYERS"),
  line.indexOf("export default"),
);
let waveMarkup = line.slice(line.lastIndexOf("  return ("));
waveMarkup = waveMarkup
  .replace(
    /ref=\{\(element\) => \{ (?:glowsRef|pathsRef)\.current\[LAYERS.length - 1 - index\] = element; \}\}/g,
    "",
  )
  .replaceAll(
    "d={FLAT_PATH}",
    "d={wavePath(amplitude, phase, LAYERS.length - 1 - index)}",
  );
await fs.writeFile(
  "src/product/VoiceLine.jsx",
  `// Derived from IntercomVoiceLine.jsx; geometry and SVG preserved.\nimport React, {useId} from 'react';\nimport {useCurrentFrame,useVideoConfig} from 'remotion';\n${waveFunctions}\nexport default function VoiceLine({level=0.16,elapsed}) {\nconst frame=useCurrentFrame();const {fps}=useVideoConfig();const time=elapsed??frame/fps;\nconst gradientId=useId();const stroke=color=>color.replace('url(#',\`url(#\${gradientId}-\`);\nlet amplitude=0,velocity=0,phase=0;\n// Replay the original spring at 120Hz so seeks and parallel renders agree.\nfor(let i=0;i<Math.floor(time*120);i++){const t=i/120;const volume=level*(.55+.45*Math.sin(t*8.7)**2);const target=level?0.45+(MAX_AMPLITUDE-.45)*Math.pow(Math.min(1,Math.max(0,(volume-ACTIVE_RMS_THRESHOLD)/(FULL_AMPLITUDE_RMS-ACTIVE_RMS_THRESHOLD))),.58):0;const attack=target>amplitude;velocity+=((target-amplitude)*(attack?500:520)-velocity*(attack?32:40))/120;amplitude+=velocity/120;phase+=1.8*Math.PI*2/120;}\n${waveMarkup}`,
);
const modal = await read("sonar/pages/HireReceptionistModal.jsx");
let card = modal.slice(
  modal.indexOf("<section className={`ns-receptionist-preview-card"),
  modal.indexOf(
    "</section>",
    modal.indexOf("<section className={`ns-receptionist-preview-card"),
  ) + 10,
);
card = card
  .replace(
    /<video src=\{avatarVideoUrl\(person.avatar_video\)\} poster=\{person.avatar \|\| undefined\} autoPlay muted loop playsInline preload="metadata"/,
    "<Video src={staticFile(person.avatar_video)} muted loop premountFor={fps}",
  )
  .replace("<img src={person.avatar}", "<Img src={staticFile(person.avatar)}")
  .replace(
    "muted loop premountFor={fps}",
    'muted loop premountFor={fps} objectFit="contain" style={{display:"block",width:"100%",height:"100%",background:"#09090a"}}',
  );
await fs.writeFile(
  "src/product/ReceptionistDetail.jsx",
  `// Embedded detail card extracted verbatim from HireReceptionistModal.jsx.\n// Only media playback and application handlers are adapted for the silent film.\nimport React from 'react';\nimport {Img,staticFile,useVideoConfig} from 'remotion';\nimport {Video} from '@remotion/media';\nimport {User,Pause,Play,Volume2,Loader2} from 'lucide-react';\nimport IntercomVoiceLine from './VoiceLine';\nconst isCreatedReceptionist=()=>false;\nconst catalogAccentTraits=()=>[];\nconst catalogCoreTraits=person=>person.traits||[];\nconst catalogMbti=person=>person.personality?.mbti||person.personality_type||'';\nexport function ReceptionistDetail({person}) {\nconst {fps}=useVideoConfig();\nconst description=person.description;const expandableDescription=false;const descriptionExpanded=true;const hideVoiceButton=true;const compactVoicePreview=false;const playingVoice=null;const voiceLevel=0;const hiringId=null;const archiving=false;\nconst playVoice=()=>{};const setDescriptionExpanded=()=>{};const setPersonalityPerson=()=>{};const handleSelect=()=>{};const setHireError=()=>{};const setArchiveTarget=()=>{};\nreturn (${card});\n}\n`,
);
// Obtain the same Inter family used by the product, and bundle it for offline rendering.
await fs.mkdir("public/fonts", { recursive: true });
const css = await (
  await fetch(
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900",
    { headers: { "User-Agent": "Mozilla/5.0" } },
  )
).text();
for (const block of css.matchAll(
  /font-weight: (\d+);\s*src: url\((https:[^)]+)\)/g,
)) {
  await fs.writeFile(
    `public/fonts/Inter-${block[1]}.ttf`,
    Buffer.from(await (await fetch(block[2])).arrayBuffer()),
  );
}
console.log("Source-derived waveform, detail card, and local Inter ready.");
