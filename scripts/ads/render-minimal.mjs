// Photo-first ad images (owner 2026-10-22): the photo carries the ad, so the image holds only
// the logo, one short headline in English and Arabic, and a "tap for details" line.
// Everything else (price, citizenship, sizes) lives in the ad text and on WhatsApp.
//   GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-minimal.mjs [id ...]
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "gulf-2026-10", "minimal");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const img = (p) => `file://${REPO}/public/images/projects/${p}`;

const ADS = [
  {
    id: "villa-terrace",
    photo: img("marmara-haven-villa/terrace.jpg"),
    pos: "center 30%",
    en: "A full sea-view villa<br>in Istanbul",
    ar: "فيلا بإطلالة بحرية كاملة في إسطنبول",
  },
  {
    id: "villa-sunset",
    photo: img("marmara-haven-villa/sunset.jpg"),
    pos: "center 40%",
    en: "A full sea-view villa<br>in Istanbul",
    ar: "فيلا بإطلالة بحرية كاملة في إسطنبول",
  },
  {
    id: "plan",
    photo: img("beylikduzu-living/central-garden.jpg"),
    pos: "38% center",
    en: "Pay 30% now,<br>the rest over 30 months",
    ar: "ادفع 30% الآن والباقي على 30 شهراً",
  },
  {
    id: "citizenship",
    photo: img("sea-pearl-atakoy/from-the-sea.jpg"),
    pos: "30% center",
    en: "Turkish citizenship<br>through real estate",
    ar: "الجنسية التركية عبر الاستثمار العقاري",
  },
];

const css = (w, h, story) => `
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;background:#0f2b21;font-family:Inter,sans-serif;color:#fff;position:relative}
.ph{position:absolute;inset:0;background-size:cover}
.top{position:absolute;inset:0 0 auto;height:${story ? 420 : 240}px;background:linear-gradient(180deg,rgba(6,20,15,.55),transparent)}
.bot{position:absolute;inset:auto 0 0;height:${story ? 900 : 560}px;background:linear-gradient(0deg,rgba(6,20,15,.92) 0%,rgba(6,20,15,.78) 45%,transparent)}
.brand{position:absolute;left:60px;top:${story ? 230 : 56}px;display:flex;align-items:center;gap:16px}
.brand img{height:70px}
.brand b{display:block;font-weight:700;font-size:32px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:13px;letter-spacing:7px;color:#e4c574;margin-top:9px}
.txt{position:absolute;left:60px;right:60px;bottom:${story ? 360 : 70}px;display:grid;gap:${story ? 22 : 18}px}
.en{font-weight:700;font-size:${story ? 80 : 70}px;line-height:1.1;letter-spacing:-.5px;text-shadow:0 3px 16px rgba(0,0,0,.5)}
.ar{font-family:Plex;font-weight:700;font-size:${story ? 66 : 58}px;line-height:1.3;direction:rtl;text-align:right;color:#f6eedb;text-shadow:0 3px 16px rgba(0,0,0,.5)}
.cta{justify-self:start;margin-top:${story ? 18 : 10}px;display:flex;align-items:center;gap:16px;padding:${story ? "18px 34px" : "15px 30px"};border-radius:99px;background:#c9a24b;color:#0f2b21;font-weight:700;font-size:${story ? 36 : 32}px}
.cta .a{font-family:Plex;font-size:${story ? 38 : 34}px}
`;

const html = (a, w, h, story) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head><body>
<div class="ph" style="background-image:url('${a.photo}');background-position:${a.pos}"></div><div class="top"></div><div class="bot"></div>
<div class="brand"><img src="file://${REPO}/public/logo-light.png"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
<div class="txt"><div class="en">${a.en}</div><div class="ar">${a.ar}</div>
<div class="cta"><span>Tap for details</span><span>·</span><span class="a">اضغط للتفاصيل</span></div></div>
</body></html>`;

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const only = process.argv.slice(2);
for (const a of ADS.filter((x) => !only.length || only.includes(x.id))) {
  for (const [w, h, story, suffix] of [[1080, 1350, false, "feed"], [1080, 1920, true, "story"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const f = path.join(OUT, `${a.id}-${suffix}.html`);
    fs.writeFileSync(f, html(a, w, h, story));
    await p.goto("file://" + f);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, `${a.id}-${suffix}.jpg`), type: "jpeg", quality: 90 });
    fs.unlinkSync(f);
    await p.close();
  }
  console.log("done", a.id);
}
await b.close();
