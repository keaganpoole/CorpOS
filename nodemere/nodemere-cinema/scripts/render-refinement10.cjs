const { bundle } = require("@remotion/bundler");
const {
  selectComposition,
  renderMedia,
  openBrowser,
} = require("@remotion/renderer");
const path = require("path");
(async () => {
  const serveUrl = await bundle({
    entryPoint: path.resolve("src/index.ts"),
    publicDir: path.resolve("public"),
  });
  // Keep normal browser density. The CLI couples it to output scale=0.5,
  // which softens close-up 3D UI layers. Downscale only in renderMedia.
  const browser = await openBrowser("chrome");
  const composition = await selectComposition({
    serveUrl,
    id: "Nodemere-Film",
    puppeteerInstance: browser,
  });
  const check = process.argv.includes("--check");
  const full = process.argv.includes("--full");
  await renderMedia({
    serveUrl,
    composition,
    puppeteerInstance: browser,
    outputLocation: path.resolve(
      check
        ? "out/refinement10-capture-check.mp4"
        : full
          ? "out/nodemere-scenes-1-10-preview.mp4"
          : "out/refinement10-tail.mp4",
    ),
    frameRange: check ? [9300, 9600] : full ? [0, composition.durationInFrames - 1] : [8768, composition.durationInFrames - 1],
    scale: 0.5,
    codec: "h264",
    crf: 15,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    imageFormat: "png",
    muted: true,
    concurrency: 3,
    onProgress: (p) => {
      if (p.renderedFrames % 300 === 0)
        console.log("Rendered", p.renderedFrames);
    },
  });
  await browser.close({ silent: true });
  console.log("Finished");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
