const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),r=require('remotion');
function load(source,extras={}){const box={exports:{},...extras};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const easing=r.Easing.bezier(.22,1,.36,1),slowFastSlow=r.Easing.bezier(.62,0,.18,1);
const p=(t,a,b,e=easing)=>r.interpolate(t,[a,b],[0,1],{easing:e,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),mix=(a,b,v)=>a+(b-a)*v;
const nestSource=fs.readFileSync('src/NestScene.tsx','utf8');
const nestPart=nestSource.slice(nestSource.indexOf('  const enter ='),nestSource.indexOf('  return ('));
const {nestCamera}=load('export function nestCamera(t:number){const n=t-.75;'+nestPart+'return c;}',{p,mix,slowFastSlow});
const fixed=JSON.stringify(nestCamera(6.3));let stable=0;
for(let f=378;f<3720;f++){assert.equal(JSON.stringify(nestCamera(f/60)),fixed);stable++;}
const timing=load(fs.readFileSync('src/finaleTiming.ts','utf8')).LOGO_TIMING;
assert.equal(timing.holdEnd-timing.fadeEnd,150);
assert.equal(timing.end,586);
const src=fs.readFileSync('src/product/phase4/ScenarioRefinement.jsx','utf8');
assert(!src.includes('film-payment-notice'));assert(!src.includes('sb-bottom-toolbar'));
assert(src.includes('"Update Person"'));assert(src.includes('"Flag missing contact details"'));
const scroll=src.match(/const paneScroll = tour \? (.*?) : paneFor\(cue\);/)[1];
const paneTour=new Function('time','p','return '+scroll);
for(let f=0;f<=81;f++) assert.equal(paneTour(f/60,p),0);
assert(paneTour(2.4,p)>200);
const logo=fs.readFileSync('src/FinalLogoScene.tsx','utf8');assert(logo.includes('0.6'));
const team=fs.readFileSync('src/product/phase4/TeamsFilm.tsx','utf8');
for(const text of ['name: "Maggie", id: 3, role: "Inbound"','name: "Kayla", id: 4, role: "Outbound"','name: "Bonnie", id: 5, role: "Off"'])assert(team.includes(text));
const report={nestFixedCameraFrames:stable,variablesInitialHoldSeconds:1.35,logoHoldFrames:150,logoScaleFactor:.6,logoSceneFrames:586,videoExported:false};
fs.writeFileSync('review/refinement20-checks.json',JSON.stringify(report,null,2));console.log(report);
