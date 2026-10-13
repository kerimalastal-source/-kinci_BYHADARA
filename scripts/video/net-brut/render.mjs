// Renders scene.html frame by frame and encodes a vertical MP4 (1080x1920, 30 fps).
//   node scripts/video/net-brut/render.mjs <out-dir>                 # full video
//   node scripts/video/net-brut/render.mjs <out-dir> --at 3,15,22    # still frames only
// Needs Playwright's Chromium and ffmpeg (FFMPEG env or `pip install imageio-ffmpeg`).
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || "out");
const atArg = process.argv.indexOf("--at");
const FPS = 30;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + path.join(here, "scene.html"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

if (atArg > 0) {
  for (const s of process.argv[atArg + 1].split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), s);
    await page.screenshot({ path: path.join(outDir, `still-${String(s).replace(".", "_")}.jpg`), type: "jpeg", quality: 85 });
  }
  await browser.close();
  process.exit(0);
}

const total = await page.evaluate(() => window.TOTAL);
const frames = path.join(outDir, "frames");
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames);
const n = Math.round(total * FPS);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (i % 150 === 0) console.log(`frame ${i}/${n}`);
}
await browser.close();

const ffmpeg = process.env.FFMPEG || execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
const mp4 = path.join(outDir, "net-vs-brut.mp4");
execFileSync(ffmpeg, [
  "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%05d.jpg"),
  "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", mp4,
], { stdio: "inherit" });
console.log("wrote", mp4);
