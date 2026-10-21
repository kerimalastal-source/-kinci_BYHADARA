// Renders reel.html frame by frame (30 fps) and encodes it with the sound from sound.py.
// Run: GLOBAL_NM=/opt/node22/lib/node_modules FFMPEG=<ffmpeg> node scripts/ads/whatsapp-reel/render.mjs [--still t1,t2,...]
// --still writes PNG frames at those seconds (for checking) instead of the video.
import { createRequire } from "module";
import { spawn, execFileSync } from "child_process";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FPS = 30;

const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + path.join(HERE, "reel.html"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

const still = process.argv.indexOf("--still");
if (still > 0) {
  for (const s of process.argv[still + 1].split(",")) {
    await page.evaluate((t) => window.render(t), Number(s));
    await page.screenshot({ path: path.join(OUT, `still-${s}.png`) });
  }
  await b.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.DURATION);
const silent = path.join(OUT, "video.mp4");
const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.round(duration * FPS);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 150 === 0) console.log(`frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await b.close();

const wav = path.join(OUT, "sound.wav");
execFileSync("python3", [path.join(HERE, "sound.py"), wav, String(duration)], { stdio: "inherit" });
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
  "-shortest", "-movflags", "+faststart", path.join(OUT, "hadara-whatsapp-reel.mp4")], { stdio: "inherit" });
console.log("done:", path.join(OUT, "hadara-whatsapp-reel.mp4"));
