const {bundle} = require('@remotion/bundler');
const {getCompositions, renderStill, openBrowser} = require('@remotion/renderer');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.resolve('review/refinement26');
  fs.mkdirSync(dir, {recursive: true});
  const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
  const browser = await openBrowser('chrome');
  try {
    const compositions = await getCompositions(serveUrl, {puppeteerInstance: browser});
    fs.writeFileSync(path.join(dir, 'compositions.json'), JSON.stringify(compositions, null, 2));
    const shots = {'Nodemere-Film':[5440,5441,6803,6804,6828,17223]};
    for (const [id, frames] of Object.entries(shots)) {
      const composition = compositions.find(c => c.id === id);
      for (const frame of frames.filter(f=>f<composition.durationInFrames)) {
        await renderStill({serveUrl, composition, puppeteerInstance: browser,
          output: path.join(dir, `${id}-${frame}.png`), frame, scale: .5, imageFormat: 'png'});
        console.log(`${id} frame ${frame}`);
      }
    }
  } finally {
    await browser.close({silent: true});
  }
})().catch(e => {console.error(e); process.exit(1);});
