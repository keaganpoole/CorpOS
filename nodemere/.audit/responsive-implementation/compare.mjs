import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('C:/Users/Keagan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const folder = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));
const pairs = ['people','team','calendar','appointments','settings','reports','call-logs','scenarios'];
const results = [];
for (const page of pairs) {
  const before = path.join(folder, `before-desktop-${page}.png`);
  const after = path.join(folder, `after-desktop-${page}.png`);
  try {
    const a = await sharp(before).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const b = await sharp(after).removeAlpha().raw().toBuffer({resolveWithObject:true});
    if(a.info.width !== b.info.width || a.info.height !== b.info.height) { results.push({page, mismatch:'dimensions'}); continue; }
    let changed=0, max=0, sum=0;
    for(let i=0;i<a.data.length;i+=3) {
      const delta=Math.max(...[0,1,2].map(n=>Math.abs(a.data[i+n]-b.data[i+n])));
      if(delta>8) changed++;
      max=Math.max(delta,max);sum+=delta;
    }
    results.push({page, width:a.info.width,height:a.info.height,changedPixels:changed,changedPercent:100*changed/(a.info.width*a.info.height),meanDelta:sum/(a.info.width*a.info.height),maxDelta:max});
    await sharp({create:{width:1440,height:500,channels:3,background:'#111'}}).composite([
      {input:await sharp(before).resize(720,500).toBuffer(),left:0,top:0},
      {input:await sharp(after).resize(720,500).toBuffer(),left:720,top:0},
    ]).png().toFile(path.join(folder,`compare-desktop-${page}.png`));
  } catch(error) { if(error.code !== 'ENOENT' && !error.message.includes('missing')) throw error; }
}
await fs.writeFile(path.join(folder,'desktop-comparison.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
const reference='C:/Users/Keagan/.codex/codex-remote-attachments/01a0f079-3e92-70b0-abfe-59339d28d6fd/A3BA393D-3C26-4AAC-8071-7DC73D477DB9/1-Photo-1.jpg';
console.log('Source pixels:',await sharp(reference).metadata());
await sharp({create:{width:740,height:800,channels:3,background:'#020202'}}).composite([
  {input:await sharp(reference).extract({left:31,top:155,width:505,height:950}).resize({width:360}).toBuffer(),left:0,top:0},
  {input:await sharp(path.join(folder,'phone-people-360.png')).resize(360,800).toBuffer(),left:380,top:0},
]).png().toFile(path.join(folder,'compare-approved-people.png'));
await sharp({create:{width:676,height:420,channels:3,background:'#020202'}}).composite([
  {input:await sharp(reference).extract({left:53,top:370,width:463,height:486}).resize({width:328}).toBuffer(),left:0,top:0},
  {input:await sharp(path.join(folder,'phone-people-360.png')).extract({left:16,top:256,width:328,height:365}).toBuffer(),left:348,top:0},
]).png().toFile(path.join(folder,'compare-approved-people-card.png'));
