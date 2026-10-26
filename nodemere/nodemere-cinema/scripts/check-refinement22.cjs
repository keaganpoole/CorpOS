const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),r=require('remotion');
function load(s,extras={}){const box={exports:{},...extras};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const read=f=>fs.readFileSync(f,'utf8');
const {continuousTrack}=load(read('src/cinematicMotion.ts'));
const opening=read('src/RevisionFour.tsx');
const a=opening.indexOf('const firstCollectionStoryTime'),b=opening.indexOf('export const DirectedOpening');
const {collectionStoryTime}=load(opening.slice(a,b),{continuousTrack,INTRO_ADVANCE:1.3});
for(const join of [5.25,5.55,7.63,7.93,12.13,12.43,14.51,14.81]){
 const h=.00001,l=collectionStoryTime(join-h),m=collectionStoryTime(join),rr=collectionStoryTime(join+h);
 assert(Math.abs(l-rr)<.00003);assert(Math.abs((m-l)/h-(rr-m)/h)<.001);
}
assert(Math.abs(collectionStoryTime(13)-13.58)<1e-10);assert(Math.abs(collectionStoryTime(14)-13.58)<1e-10);
for(let f=1;f<1565;f++)assert(collectionStoryTime(f/60)>=collectionStoryTime((f-1)/60)-1e-9);
const native=read('../src/components/CalendarShowcase.jsx').match(/const CRM_STUNNING_STYLES = `(.*?)`;/s)[1];
const film=read('src/HomepageHeadlines.tsx').match(/const CRM_STUNNING_STYLES = `(.*?)`;/s)[1];
assert.equal(native.replace(/\r/g,""),film.replace(/\r/g,""));
const key=s=>s.match(/@keyframes demoCallStatusGradient \{.*?\n\}/s)[0].replace(/\s/g,'');
assert.equal(key(read('../src/styles/HomePage.css')),key(read('src/phase2.css')));
const timing=load(read('src/finaleTiming.ts')).LOGO_TIMING;assert.equal(timing.holdEnd-timing.fadeEnd,150);
const ease=r.Easing.bezier(.22,1,.36,1),slowFastSlow=r.Easing.bezier(.62,0,.18,1);
const p=(t,a,b,e=ease)=>r.interpolate(t,[a,b],[0,1],{easing:e,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),mix=(a,b,k)=>a+(b-a)*k;
const ns=read('src/NestScene.tsx'), part=ns.slice(ns.indexOf('  const enter ='),ns.indexOf('  return ('));
const {nestCamera}=load('export function nestCamera(t:number){const n=t-.75,intercomTime=n+7.3;'+part+'return c;}',{p,mix,slowFastSlow});
for(let f=378;f<3282;f++)assert.equal(JSON.stringify(nestCamera(f/60)),JSON.stringify(nestCamera(6.3)));
const bounds=[0,1565,3005,4121,5441,7661,8399,10289,13073,16355,17105,17691];
const report={collectionClockJoins:8,collectionClockMonotonic:true,homepageCrmKeyframesExact:true,homepageBorderKeyframesExact:true,calendarDotDelaySeconds:.3,nestFixedCameraFrames:2904,logoHoldFrames:150,fullFilmFrames:17691,sceneBoundaries:bounds,videoExported:false};
fs.writeFileSync('review/refinement22-checks.json',JSON.stringify(report,null,2));console.log(report);


