const { bundle } = require("@remotion/bundler");
const {
  selectComposition,
  renderStill,
  openBrowser,
} = require("@remotion/renderer");
const path = require("path"),
  fs = require("fs");
async function main() {
  const dir = path.resolve("review/phase4/stills");
  fs.mkdirSync(dir, { recursive: true });
  const url = await bundle({
    entryPoint: path.resolve("src/index.ts"),
    publicDir: path.resolve("public"),
  });
  const browser = await openBrowser("chrome");
  const shots = process.argv[2]
    ? JSON.parse(process.argv[2])
    : {
        "08-People": [1.4, 4.8, 6.8, 10.7, 12.1, 15.8, 19.7, 24.6, 28.6],
        "09-Scenarios": [
          3.6, 6.8, 10.8, 12.5, 17, 20.8, 24.5, 26.7, 28.3, 30, 33,
        ],
        "10-Nest": [
          3.3, 5.7, 8.9, 13.8, 16.7, 21, 24, 28, 31.5, 35.5, 40.5, 48.5, 56.6,
          60.5,
        ],
      };
  for (const [id, times] of Object.entries(shots)) {
    const composition = await selectComposition({
      serveUrl: url,
      id,
      puppeteerInstance: browser,
    });
    for (const t of times) {
      const file = path.join(dir, `${id}-${String(t).replace(".", "_")}.png`);
      await renderStill({
        serveUrl: url,
        composition,
        puppeteerInstance: browser,
        output: file,
        frame: Math.round(t * 60),
        scale: 0.5,
        imageFormat: "png",
        onBrowserLog: (l) => console.log(l.text),
      });
      console.log(file);
    }
  }
  await browser.close({ silent: true });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
