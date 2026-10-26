const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert');
function load(file,requires){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:n=>requires[n]||{}});return exports;
}
const presets=load('src/product/finale/logoPresets.js',{});
const film=load('src/FinalLogoScene.tsx',{'./product/finale/logoPresets':presets});
const original=fs.readFileSync('src/product/finale/logo-motion-reference.txt','utf8');
const segmentCode=original.slice(original.indexOf('const segments='),original.indexOf('let paused='));
const segments=new Function('paths',segmentCode+'return segments;')(presets.LOGO_PATHS);
const drawCode=original.slice(original.indexOf('function draw(){')+'function draw(){'.length,original.indexOf('function frame(now)')).trim().replace(/}\s*$/,'');
const draw=new Function('time','demoStart','layers','segments','paused','hover','px','py','amount','wiggleTime','demoWiggleStart','smooth','presetDisplacement','mode',drawCode);
function path(){return {attrs:{},hasAttribute(k){return k in this.attrs},setAttribute(k,v){this.attrs[k]=v}}}
const layers=Array.from({length:4},()=>({line:path(),glow:path()}));
let checks=0;
for(let frame=-150;frame<=230;frame++){
 const age=frame/60;
 draw(age*1.25,0,layers,segments,false,false,260,260,0,age,0,x=>x*x*(3-2*x),presets.presetDisplacement,'fullperimeter');
 for(let i=0;i<4;i++){assert.strictEqual(film.nativeLogoPath(age,i),layers[i].line.attrs.d,`frame ${frame}, layer ${i}`);checks++;}
}
assert.match(fs.readFileSync('../src/components/SplashLogo.jsx','utf8'),/strokeWidth: 16/);
assert.match(fs.readFileSync('src/FinalLogoScene.tsx','utf8'),/strokeWidth=\{16\}/);
const report={preset:'fullperimeter',pathComparisons:checks,allExact:true,nativeSplashStrokeWidth:16,signatureFrames:202,stillHoldFrames:150,videoExported:false};
fs.mkdirSync('review/logo-correction',{recursive:true});fs.writeFileSync('review/logo-correction/path-verification.json',JSON.stringify(report,null,2));console.log(report);
