// Local browser review. Run only after the browser fallback is authorized.
import { chromium } from 'C:/Users/Keagan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const directory = new URL('./', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:5174/concepts', { waitUntil: 'networkidle' });
await page.locator('.cl-study').first().waitFor();
const phase = process.argv[2] || 'initial';
const shot = async (name) => { await page.waitForTimeout(850); await page.screenshot({path: `${directory}/${phase}-${name}.png`, fullPage: true}); };
for (let i = 0; i < 6; i++) {
  await page.locator('.cl-study').nth(i).click();
  await shot(`${i + 1}-rest`);
  const area = page.locator('.cl-experiment').nth(i);
  if (i === 0) {
    await area.getByRole('button', { name: 'Open Gamma fold' }).click();
    await area.getByRole('button', { name: /Element 06/ }).click();
  }
  if (i === 1) await area.getByRole('button', {name: 'Enter Alpha', exact: true}).click();
  if (i === 2) {
    await area.getByRole('button', { name: 'Select Gamma span' }).click();
    const seam = await area.getByRole('button', {name: 'Resize Beta span'}).boundingBox();
    await page.mouse.move(seam.x + seam.width / 2, seam.y + seam.height / 2);
    await page.mouse.down(); await page.mouse.move(seam.x + 55, seam.y + seam.height / 2, {steps: 20}); await page.mouse.up();
  }
  if (i === 3) { await area.getByRole('button', {name: 'Focus Gamma'}).hover(); await page.waitForTimeout(500); await area.getByRole('button', {name: 'Enter Gamma', exact: true}).click(); }
  if (i === 4) await area.getByRole('button', {name: 'Face-on view'}).click();
  if (i === 5) { await area.getByRole('button', {name: 'Element 01', exact:true}).click(); await area.getByRole('button', {name: 'Element 02', exact:true}).click(); await area.getByRole('button', {name:'Move selected to Beta'}).click(); }
  await shot(`${i + 1}-interaction`);
}
await fs.writeFile(`${directory}/${phase}-errors.json`, JSON.stringify(errors, null, 2));
await page.setViewportSize({width:390,height:844});
for (let i=0;i<6;i++) {await page.locator('.cl-study').nth(i).click();await shot(`${i+1}-mobile`);}
await browser.close();
console.log(JSON.stringify({phase, screenshots:18, errors}));
