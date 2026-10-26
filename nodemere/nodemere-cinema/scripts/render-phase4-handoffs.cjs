const {bundle}=require('@remotion/bundler');
const {selectComposition,renderMedia,openBrowser}=require('@remotion/renderer');
const path=require('path');
async function main(){
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});
 const browser=await openBrowser('chrome');
 const composition=await selectComposition({serveUrl,id:'Nodemere-Film',puppeteerInstance:browser});
 for(const [name,start] of [['people',7176],['scenarios',9006],['nest',11106]]){
  await renderMedia({serveUrl,composition,puppeteerInstance:browser,outputLocation:path.resolve(`out/phase4-${name}-handoff.mp4`),frameRange:[start,start+209],scale:.5,codec:'h264',crf:15,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'png',muted:true,concurrency:3});
  console.log('Rendered '+name+' handoff');
 }
 await browser.close({silent:true});
}main().catch(e=>{console.error(e);process.exit(1)});
