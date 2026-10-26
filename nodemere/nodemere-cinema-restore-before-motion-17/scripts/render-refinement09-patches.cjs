const {bundle}=require('@remotion/bundler');
const {openBrowser,selectComposition,renderMedia,renderStill}=require('@remotion/renderer');
const path=require('path');
(async()=>{
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});const browser=await openBrowser('chrome');const composition=await selectComposition({serveUrl,id:'Nodemere-Film',puppeteerInstance:browser});
 for(const [name,frameRange] of [['intro',[9009,9506]],['milestone',[13165,13831]]]){
  await renderMedia({serveUrl,composition,puppeteerInstance:browser,outputLocation:path.resolve(`out/refinement09-patch-${name}.mp4`),frameRange,scale:.5,codec:'h264',crf:15,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'png',muted:true,concurrency:3});console.log('Completed patch',name);
 }
 for(const frame of [9161,9348,13416]){await renderStill({serveUrl,composition,puppeteerInstance:browser,output:path.resolve(`review/refinement09/patch-${frame}.png`),frame,scale:.5,imageFormat:'png'});}
 await browser.close({silent:true});
})().catch(e=>{console.error(e);process.exit(1)});
