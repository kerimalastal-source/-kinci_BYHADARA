// Short villa ad video (2026-10-19): ~21 s cut from the site's tour video (tour-720.mp4),
// opening on the sea view because viewers left after 3-7 s. This script renders the two
// overlays (opening headline, transparent; closing card) and then cuts the video with ffmpeg.
// Run: GLOBAL_NM=/opt/node22/lib/node_modules FFMPEG=<ffmpeg> node scripts/ads/render-villa-short.mjs
import { createRequire } from "module";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "villa-2026-10", "short");
fs.mkdirSync(OUT, { recursive: true });
const SRC = path.join(REPO, "public/videos/marmara-haven-villa/tour-720.mp4");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const LOGO = `file://${REPO}/public/logo-light.png`;
const PHOTO = `file://${REPO}/public/images/projects/marmara-haven-villa/dusk-pool.jpg`;

const FONTS = `
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}`;

// Opening headline over the first shot. Reels cover the top ~120 px and the bottom ~35%,
// so the text sits between them.
const hook = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
html,body{width:720px;height:1280px;background:transparent;overflow:hidden}
.box{position:absolute;left:36px;right:36px;top:170px;padding:22px 26px;border-radius:24px;background:rgba(10,30,23,.72);border:2px solid #c9a24b;text-align:center;color:#fff}
.ar{font-family:Plex;font-weight:700;font-size:44px;line-height:1.3;direction:rtl}
.en{font-family:Inter;font-weight:700;font-size:26px;color:#f3d98e;margin-top:6px}
</style></head><body><div class="box"><div class="ar">فيلا بإطلالة بحرية في إسطنبول</div><div class="en">A sea-view villa in Istanbul</div></div></body></html>`;

// Closing card: the villa's confirmed figures (src/data/projects.ts, owner-supplied).
const FACTS = [
  ["637 m²", "مساحة الأرض", "Plot"],
  ["576 m²", "مساحة الفيلا", "Villa area"],
  ["4", "طوابق", "Floors"],
  ["5", "غرف نوم", "Bedrooms"],
  ["7", "حمّامات", "Bathrooms"],
  ["✓", "مسبح خاص", "Private pool"],
];
const end =`<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
html,body{width:720px;height:1280px;overflow:hidden;background:#0f2b21;color:#fff}
.ph{position:absolute;left:0;right:0;top:0;height:470px;background:url('${PHOTO}') center 58%/cover}
.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,33,0) 55%,#0f2b21 100%)}
.brand{position:absolute;left:40px;top:150px;display:flex;align-items:center;gap:12px;background:rgba(10,30,23,.62);border-radius:16px;padding:8px 16px 8px 12px}
.brand img{height:40px}.brand b{display:block;font-family:Inter;font-weight:700;font-size:22px;letter-spacing:4px;line-height:1}.brand i{display:block;font-style:normal;font-family:Inter;font-weight:700;font-size:10px;letter-spacing:5px;color:#e4c574;margin-top:6px}
.body{position:absolute;left:40px;right:40px;top:430px;text-align:center}
.ar{font-family:Plex;font-weight:700;font-size:46px;direction:rtl}
.en{font-family:Inter;font-weight:700;font-size:26px;color:#e8dcbc;margin-top:4px}
.price{display:inline-block;margin-top:22px;padding:12px 26px;border-radius:18px;border:2px solid #c9a24b;background:rgba(201,162,75,.16)}
.price .a{font-family:Plex;font-weight:700;font-size:36px;color:#f3d98e;direction:rtl;display:block}
.price .e{font-family:Inter;font-weight:700;font-size:22px;color:#efe6cf;display:block}
.grid{margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;direction:rtl}
.f{border:1.5px solid rgba(201,162,75,.55);border-radius:16px;padding:12px 6px;background:rgba(255,255,255,.04)}
.f b{display:block;font-family:Inter;font-weight:700;font-size:30px;color:#f3d98e;direction:ltr}
.f i{display:block;font-style:normal;font-family:Plex;font-weight:700;font-size:21px;margin-top:2px}
.f s{display:block;text-decoration:none;font-family:Inter;font-weight:700;font-size:15px;color:#cfc6ae;margin-top:2px}
</style></head><body>
<div class="ph"></div>
<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
<div class="body">
<div class="ar">فيلا مرمرة هيفن</div><div class="en">Marmara Haven Villa · Büyükçekmece</div>
<div class="price"><span class="a">السعر من 1.55 مليون دولار</span><span class="e">From US$1.55M</span></div>
<div class="grid">${FACTS.map(([v, a, e]) => `<div class="f"><b>${v}</b><i>${a}</i><s>${e}</s></div>`).join("")}</div>
</div></body></html>`;

const b = await chromium.launch();
for (const [name, html, transparent] of [["hook", hook, true], ["end", end, false]]) {
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  const f = path.join(OUT, `${name}.html`);
  fs.writeFileSync(f, html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: transparent });
  fs.unlinkSync(f);
  await p.close();
}
await b.close();

// Shots (start, length in seconds) from the 66 s tour video: sea + pool, deck + pool,
// living room, kitchen, attic with the sea window, rooftop terrace.
const SHOTS = [[48, 3], [27, 3], [19.5, 3], [30.5, 3], [56, 2], [60, 4]];
const END = 3;
const total = SHOTS.reduce((s, [, d]) => s + d, 0) + END;
const parts = SHOTS.map(([s, d], i) => `[0:v]trim=start=${s}:duration=${d},setpts=PTS-STARTPTS,scale=720:1280,fps=30[v${i}]`);
const filter = [
  ...parts,
  `[1:v]loop=loop=-1:size=1:start=0,trim=duration=${END},setpts=PTS-STARTPTS,scale=720:1280,fps=30,format=yuv420p[ve]`,
  `${SHOTS.map((_, i) => `[v${i}]`).join("")}[ve]concat=n=${SHOTS.length + 1}:v=1:a=0[cat]`,
  `[cat][2:v]overlay=0:0:enable='lt(t,${SHOTS[0][1]})',format=yuv420p[vout]`,
  // The track's own music, continuous from the start, faded at both ends.
  `[0:a]atrim=start=0:duration=${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.5,afade=t=out:st=${total - 1.5}:d=1.5[aout]`,
].join(";");
const out = path.join(OUT, "villa-short-21s.mp4");
execFileSync(FFMPEG, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", SRC, "-i", path.join(OUT, "end.png"), "-i", path.join(OUT, "hook.png"),
  "-filter_complex", filter, "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", String(total), out,
]);
console.log(out, total, "s");
