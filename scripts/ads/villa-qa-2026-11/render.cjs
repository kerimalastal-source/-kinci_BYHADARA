// usage: node render.cjs <html> <outdir> [--preview t1,t2,...] [--fps 30]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const [html, out, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, "")] = rest[i + 1];
const REPO = "file://" + require("path").resolve(__dirname, "../../..");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const src = fs.readFileSync(html, "utf8").replaceAll("REPO/", REPO + "/");
  const tmp = path.resolve(path.dirname(html), ".render.html");
  fs.writeFileSync(tmp, src);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: Number(opt.h || 1920) }, deviceScaleFactor: 1 });
  await page.goto("file://" + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const total = await page.evaluate(() => window.TOTAL);
  let times;
  if (opt.preview) times = opt.preview.split(",").map(Number);
  else {
    const fps = Number(opt.fps || 30);
    const n = Math.round(total * fps);
    times = Array.from({ length: n }, (_, i) => i / fps);
  }
  let k = 0;
  for (const t of times) {
    await page.evaluate((t) => window.render(t), t);
    const name = opt.preview ? `p_${t.toFixed(2)}.jpg` : `f${String(k).padStart(4, "0")}.jpg`;
    await page.screenshot({ path: path.join(out, name), type: "jpeg", quality: 95 });
    k++;
  }
  console.log("total", total.toFixed(2), "frames", k);
  await browser.close();
})();
