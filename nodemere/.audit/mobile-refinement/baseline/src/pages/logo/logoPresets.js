// Shared geometry: crown, eyebrows, outer perimeter, lower eye outline.
export const LOGO_PATHS = [
  [[51,30],[65,17],[79,30]],
  [[35,33],[65,63],[95,33]],
  [[40,403/9],[23,58],[65,99],[107,58],[90,403/9]],
  [[40,403/9],[40,61],[90,61],[90,403/9]]
];
const pass=(group,start,travel,reverse=false,easing='linear')=>({group,start,travel,reverse,easing});
export const LOGO_PRESETS = {
  fullperimeter:{label:'Full perimeter',duration:4.2,description:'The original traveling wave around every outer edge.'},
  scan:{label:'Blade scan',duration:2.4,description:'The original narrow downward sweep through the mark.'},
  crescendo:{label:'Crescendo',duration:4.8,description:'The original narrow sweep, gradually gathering speed and strength.'},
  perimeterEyes:{label:'Perimeter → Eyes',duration:4.45,description:'A pointer-like pass around the perimeter, then straight through the lower eyes. No eyebrows.',steps:[pass(2,0,2.8),pass(3,2.95,1.25,true)]},
  eyesPerimeter:{label:'Eyes → Perimeter',duration:4.45,description:'The lower eyes lead, then the wave follows the entire outer frame. No eyebrows.',steps:[pass(3,0,1.25),pass(2,1.4,2.8,true)]},
  eyesGlide:{label:'Eyes · left to right',duration:2.15,description:'A small moving disturbance follows the lower eye outline from left to right.',steps:[pass(3,0,1.9)]},
  eyesReverse:{label:'Eyes · right to left',duration:2.15,description:'The same precise lower-eye pass, running in reverse.',steps:[pass(3,0,1.9,true)]},
  perimeterGlide:{label:'Perimeter · pointer glide',duration:3.45,description:'A virtual pointer follows the outer line at a steady pace.',steps:[pass(2,0,3.2)]},
  perimeterReverse:{label:'Perimeter · reverse',duration:3.45,description:'Start at the right shoulder and trace the outer frame back to the left.',steps:[pass(2,0,3.2,true)]},
  quickHandoff:{label:'Perimeter → quick eyes',duration:3.8,description:'A measured lap of the frame hands off to a fast lower-eye sweep.',steps:[pass(2,0,2.8),pass(3,2.9,.65,true)]},
  deliberate:{label:'Slow frame → eyes',duration:5.95,description:'A slow perimeter pass, a short pause, then a controlled eye sweep.',steps:[pass(2,0,4),pass(3,4.25,1.45,true)]},
  eyesReturn:{label:'Eyes · there and back',duration:3.5,description:'Trace the lower eyes, pause briefly, then retrace them.',steps:[pass(3,0,1.5),pass(3,1.75,1.5,true)]},
  perimeterReturn:{label:'Perimeter · there and back',duration:5.3,description:'Follow the outer line to the far shoulder, then return along it.',steps:[pass(2,0,2.4),pass(2,2.65,2.4,true)]},
  accelerating:{label:'Perimeter · accelerate',duration:3.65,description:'The moving wave starts slowly and gains speed along the frame.',steps:[pass(2,0,3.4,false,'accelerate')]},
  braking:{label:'Perimeter · decelerate',duration:3.65,description:'A swift entry gradually slows as it reaches the opposite shoulder.',steps:[pass(2,0,3.4,false,'decelerate')]},
  brakingReverse:{label:'Perimeter · decelerate R → L',duration:3.65,description:'Start at the right shoulder, sweep around the perimeter, and gradually slow toward the left shoulder.',steps:[pass(2,0,3.4,true,'decelerate')]},
  eyesAccelerate:{label:'Eyes · accelerate',duration:2.55,description:'A slow entrance into the lower eyes becomes a fast, precise exit.',steps:[pass(3,0,2.3,false,'accelerate')]}
};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const metrics=LOGO_PATHS.map(path=>{
  let total=0;
  const segments=path.slice(1).map((b,i)=>{
    const a=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),offset=total;
    total+=length;return {a,b,length,offset};
  });
  return {segments,total};
});
export function pointOnPath(group,progress){
  const {segments,total}=metrics[group],distance=clamp(progress)*total;
  const segment=segments.find(s=>distance<=s.offset+s.length)||segments[segments.length-1];
  const t=clamp((distance-segment.offset)/segment.length);
  return [
    260+(segment.a[0]+(segment.b[0]-segment.a[0])*t-65)*4.1,
    260+(segment.a[1]+(segment.b[1]-segment.a[1])*t-58)*4.1
  ];
}
function pulse(age,duration,speed,phase,wiggleAge){
  if(age<=0||age>=duration)return 0;
  return Math.sin(Math.PI*age/duration)**2*Math.sin(wiggleAge*speed-phase);
}
export function presetDisplacement(mode,age,group,x,y,layer,pathProgress=0,wiggleAge=age){
  const preset=LOGO_PRESETS[mode];
  if(!preset||age<0||age>=preset.duration||layer===3)return 0;
  if(mode==='fullperimeter')return group===2?17*pulse(age-pathProgress*3.4,.55,13,layer*.9,wiggleAge-pathProgress*3.4):0;
  if(mode==='scan')return 20*pulse(age-(y-80)/230,.55,12,layer*.9,wiggleAge-(y-80)/230);
  if(mode==='crescendo'){
    const t=wiggleAge-Math.hypot(x-260,y-260)/250;
    const front=80+355*(age/4.8)**1.7,band=Math.abs(y-front)/45;
    return band<1?(5+12*age/4.8)*Math.cos(band*Math.PI/2)**2*Math.sin(3*t+1.7*t*t-layer*.9):0;
  }
  let displacement=0;
  for(const step of preset.steps||[]){
    const elapsed=age-step.start;
    if(group!==step.group||elapsed<0||elapsed>step.travel)continue;
    let progress=elapsed/step.travel;
    if(step.easing==='accelerate')progress=progress**1.8;
    if(step.easing==='decelerate')progress=1-(1-progress)**1.8;
    if(step.reverse)progress=1-progress;
    const [px,py]=pointOnPath(group,progress);
    const influence=1-smooth(Math.hypot(x-px,y-py)/65);
    const fade=smooth(elapsed/.12)*smooth((step.travel-elapsed)/.12);
    displacement+=16*influence*fade*Math.sin(pathProgress*metrics[group].total*.27-wiggleAge*9.5+layer*1.15);
  }
  return displacement;
}
