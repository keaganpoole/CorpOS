const {bundle}=require('@remotion/bundler');
const {selectComposition,renderMedia,renderStill,openBrowser}=require('@remotion/renderer');
const path=require('path');
async function main(){
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});
 const browser=await openBrowser('chrome');
 const composition=await selectComposition({serveUrl,id:'Nodemere-Film',puppeteerInstance:browser});
 await renderMedia({serveUrl,composition,puppeteerInstance:browser,outputLocation:path.resolve('out/phase4-intercom-final.mp4'),frameRange:[13119,14765],scale:.5,codec:'h264',crf:15,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'png',muted:true,concurrency:3});
 const nest=await selectComposition({serveUrl,id:'10-Nest',puppeteerInstance:browser});
 await renderStill({serveUrl,composition:nest,puppeteerInstance:browser,output:path.resolve('review/phase4/stills/10-Nest-40_5.png'),frame:2430,scale:.5,imageFormat:'png'});
 await browser.close({silent:true});
 console.log('Rendered final Intercom with continuous waveform phase and native attack/release.');
}main().catch(e=>{console.error(e);process.exit(1)});
