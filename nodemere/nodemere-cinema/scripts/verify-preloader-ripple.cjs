const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert');
function load(file,requires){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(code,{exports,require:n=>requires[n]||{}});return exports;}
const presets=load('src/product/finale/logoPresets.js',{});
const film=load('src/FinalLogoScene.tsx',{'./product/finale/logoPresets':presets});
const timing=load('src/finaleTiming.ts',{}).LOGO_TIMING;
let checks=0;
for(let layer=0;layer<4;layer++){
 const rest=film.nativeLogoPath(0,layer), groups=rest.split('M');
 for(let f=-150;f<0;f++){assert.strictEqual(film.nativeLogoPath(f/60,layer),rest);checks++;}
 for(let f=1;f<192;f++){
  const current=film.nativeLogoPath(f/60,layer);
  const parts=current.split('M');
  for(const i of [1,2,4])assert.strictEqual(parts[i],groups[i]);
  assert.strictEqual(current,film.nativeLogoPath(f/60,layer));checks++;
 }
 assert.notStrictEqual(film.nativeLogoPath(1,layer),rest);
 assert.strictEqual(film.nativeLogoPath(201/60,layer),rest);
}
assert.strictEqual(timing.holdEnd-timing.fadeEnd,150);
fs.writeFileSync('review/preloader-ripple/path-checks.json',JSON.stringify({checks,allLayersDeform:true,upperStrokesStable:true,deterministic:true,holdFrames:150,settledBeforeFade:true},null,2));console.log('Passed',checks,'path checks');
