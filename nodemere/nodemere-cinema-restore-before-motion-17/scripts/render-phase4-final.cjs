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
        ? "out/phase4-capture-check.mp4"
        : full
          ? "out/nodemere-scenes-1-10-preview.mp4"
          : "out/phase4-tail-captured.mp4",
    ),
    frameRange: check ? [7776, 7924] : full ? [0, composition.durationInFrames - 1] : [7176, 14765],
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
