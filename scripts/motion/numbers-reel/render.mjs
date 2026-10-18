// Renders the numbers reel from reel.html, frame by frame from seek(t).
//   node render.mjs stills <outDir> 0.45 3.2 ...   -> one PNG per time
//   node render.mjs video  <outDir>                -> frames/ + reel.mp4 (60 fps, with UI sounds)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = "stills", outDir = path.join(here, "out"), ...rest] = process.argv.slice(2);
const FPS = 60;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + path.join(here, "reel.html") + (process.env.REEL ? "?v=" + process.env.REEL : ""));
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every((i) => i.complete));

const shot = async (t, file) => {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: file });
};

if (mode === "stills") {
  for (const t of rest.map(Number)) await shot(t, path.join(outDir, `still-${t.toFixed(2)}.png`));
} else {
  const dur = await page.evaluate(() => window.DUR);
  const frames = path.join(outDir, "frames");
  fs.mkdirSync(frames, { recursive: true });
  const total = Math.round(dur * FPS);
  for (let i = 0; i < total; i++) {
    await shot(i / FPS, path.join(frames, `f${String(i).padStart(4, "0")}.png`));
    if (i % 120 === 0) console.log(`frame ${i}/${total}`);
  }
  const events = await page.evaluate(() => {
    const r = window.realOf;
    return {
      landings: window.LANDINGS.map(r),
      keys: window.PRESSES.map((p) => r(p.t)),
      click: r(window.T.click),
      send: r(window.T.ret),
    };
  });
  await browser.close();
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  // One short tone per contact: click, landings (soft), key taps (tick), send (two-note chime).
  const tones = [];
  const tone = (t, f, d, v) => tones.push({ t, f, d, v });
  tone(events.click, 1800, 0.035, 0.5);
  for (const t of events.landings) if (!events.keys.includes(t)) tone(t, 420, 0.07, 0.45);
  for (const t of events.keys) tone(t, 2600, 0.025, 0.25);
  tone(events.send + 0.02, 880, 0.09, 0.35);
  tone(events.send + 0.1, 1320, 0.12, 0.3);
  const args = ["-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png")];
  tones.forEach((s) => args.push("-f", "lavfi", "-i", `sine=frequency=${s.f}:duration=${s.d}`));
  const parts = tones.map((s, i) =>
    `[${i + 1}:a]volume=${s.v},afade=t=out:st=0:d=${s.d},adelay=${Math.round(s.t * 1000)}|${Math.round(s.t * 1000)}[a${i}]`);
  const mix = `${tones.map((_, i) => `[a${i}]`).join("")}amix=inputs=${tones.length}:normalize=0,apad=whole_dur=${dur}[aout]`;
  args.push(
    "-filter_complex", [...parts, mix].join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow",
    "-c:a", "aac", "-b:a", "160k", "-t", String(dur), "-movflags", "+faststart",
    path.join(outDir, "reel.mp4"),
  );
  execFileSync(ffmpeg, args, { stdio: "inherit" });
  console.log("done", path.join(outDir, "reel.mp4"));
  process.exit(0);
}
await browser.close();
