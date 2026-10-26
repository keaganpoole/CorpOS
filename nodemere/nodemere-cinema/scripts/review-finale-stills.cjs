const {bundle}=require('@remotion/bundler');
const {selectComposition,renderStill,openBrowser}=require('@remotion/renderer');
const path=require('path'),fs=require('fs');
(async()=>{
 const dir=path.resolve('review/finale/stills');fs.mkdirSync(dir,{recursive:true});
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});
 const browser=await openBrowser('chrome');
 const shots=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):{'11-Encryption':[72,180,240,330,450,570,660,810,933,959],'12-Final-Logo':[0,72,143,144,220,293,322,360,410,468,469,500,523,558],'Nodemere-Film':[15245,15255,15270,15295]};
 for(const [id,frames] of Object.entries(shots)){
  const composition=await selectComposition({serveUrl,id,puppeteerInstance:browser});
  for(const frame of frames){const file=path.join(dir,`${id}-${frame}.png`);await renderStill({serveUrl,composition,puppeteerInstance:browser,output:file,frame,scale:.5,imageFormat:'png'});console.log(id,frame);}
 }
 await browser.close({silent:true});
})().catch(e=>{console.error(e);process.exit(1)});
