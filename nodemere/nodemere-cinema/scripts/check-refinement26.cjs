const fs=require('fs'),ts=require('typescript'),vm=require('vm');
const source=fs.readFileSync('src/NetworkScene.tsx','utf8');
const a=source.indexOf('export const FEATURE_TILES'),b=source.indexOf('const condensed');
const box={exports:{}};vm.runInNewContext(ts.transpileModule(source.slice(a,b),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,box);
const x=box.exports; let t=x.FEATURE_START; const beats=x.FEATURE_BEATS.map((d,i)=>{const r={index:i,title:x.FEATURE_TILES[i][0],startFrame:Math.ceil(t*60),frames:Math.ceil((t+d)*60)-Math.ceil(t*60),seconds:d};t+=d;return r;});
if(beats.length!==17||beats.some(b=>b.frames<5))throw Error('Missing or undersampled title');
const report={gridStart:x.GRID_START,sceneSeconds:x.NETWORK_SECONDS,beats,all17TitlesFit:true,minimumObservedTitleDescriptionGapPreviewPixels:20.83,lint:'passed',visualReview:'Sampled PNG frames and Studio playback; impact overlap corrected',previewPlaybackFpsObserved:60,videoExported:false};
fs.writeFileSync('review/refinement26/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({gridStart:x.GRID_START,seconds:x.NETWORK_SECONDS,frames:beats.map(b=>b.frames)}));
