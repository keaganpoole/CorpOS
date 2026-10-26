const {bundle} = require('@remotion/bundler');
const {getCompositions, renderStill, openBrowser} = require('@remotion/renderer');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.resolve('review/refinement25');
  fs.mkdirSync(dir, {recursive: true});
  const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
  const browser = await openBrowser('chrome');
  try {
    const compositions = await getCompositions(serveUrl, {puppeteerInstance: browser});
    fs.writeFileSync(path.join(dir, 'compositions.json'), JSON.stringify(compositions, null, 2));
    const shots = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {
      '05-Drop-ins': [492, 576, 1080, 1134, 1272],
      '07-Handoff': [228, 396, 630],
      '09-Scenarios': [420, 1812, 1967, 2160, 2592],
      '10-Nest': [96, 150, 189, 228, 270, 360, 414, 456, 504, 546, 612, 780, 2094, 2124, 2622, 2646, 3120, 3180],
      'Nodemere-Film': [16744, 16745, 18080],
    };
    for (const [id, frames] of Object.entries(shots)) {
      const composition = compositions.find(c => c.id === id);
      for (const frame of frames) {
        await renderStill({serveUrl, composition, puppeteerInstance: browser,
          output: path.join(dir, `${id}-${frame}.png`), frame, scale: .5, imageFormat: 'png'});
        console.log(`${id} frame ${frame}`);
      }
    }
  } finally {
    await browser.close({silent: true});
  }
})().catch(e => {console.error(e); process.exit(1);});
