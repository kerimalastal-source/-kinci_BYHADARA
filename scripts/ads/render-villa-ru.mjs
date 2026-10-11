// Russian-only version of the Marmara Haven Villa single-image ad (4:5 feed + 9:16 story),
// same layout as render-villa.mjs. Usage:
// GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-villa-ru.mjs
// Writes scripts/ads/villa-2026-10/ru/villa-feed.jpg and villa-story.jpg.
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "villa-2026-10", "ru");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const photo = (n) => `file://${HERE}/villa-2026-10/photos/${n}.jpg`;
const LOGO = `file://${REPO}/public/logo-light.png`;

const FONTS = `
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{overflow:hidden;background:#0f2b21;font-family:Inter,sans-serif;color:#fff;position:relative}
.brand{display:flex;align-items:center;gap:16px}.brand img{height:74px}
.brand b{display:block;font-weight:700;font-size:34px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:14px;letter-spacing:7px;color:#e4c574;margin-top:9px}
.badge{border:2px solid #c9a24b;background:rgba(15,43,33,.72);border-radius:50px;padding:12px 26px;color:#e4c574;font-weight:700;font-size:25px}
`;
const brand = `<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>`;

const hero = (story) => {
  const w = 1080, h = story ? 1920 : 1350;
  const box = story ? { top: -260, height: 2040 } : { top: -300, height: 1720 };
  return { w, h, html: `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
body{width:${w}px;height:${h}px}
.ph{position:absolute;left:50%;transform:translateX(-50%);top:${box.top}px;height:${box.height}px;width:${Math.round(box.height * 3 / 4)}px;background:url('${photo("dusk-pool")}') center/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.6) 0%,rgba(8,26,20,.05) ${story ? 20 : 18}%,rgba(8,26,20,.1) ${story ? 42 : 36}%,rgba(8,26,20,.88) ${story ? 60 : 56}%,rgba(8,26,20,.97) 100%)}
.top{position:absolute;left:60px;right:60px;top:${story ? 230 : 56}px;display:flex;justify-content:space-between;align-items:center}
.body{position:absolute;left:60px;right:60px;bottom:${story ? 300 : 64}px}
.title{font-weight:700;font-size:${story ? 58 : 58}px;line-height:1.2;text-shadow:0 3px 14px rgba(0,0,0,.55)}
.price{margin-top:28px;display:inline-block;padding:18px 30px;border-radius:22px;background:rgba(201,162,75,.16);border:2px solid #c9a24b;font-weight:700;font-size:${story ? 46 : 42}px;color:#f3d98e;white-space:nowrap}
.pts{margin-top:28px;display:grid;gap:20px}
.pt{display:flex;gap:18px;align-items:center}
.pt .c{flex:0 0 50px;width:50px;height:50px;border-radius:50%;background:#c9a24b;color:#0f2b21;display:grid;place-items:center;font-size:28px;font-weight:700}
.pt b{font-weight:700;font-size:${story ? 38 : 34}px;line-height:1.25}
.foot{margin-top:28px;padding-top:20px;border-top:2px solid rgba(201,162,75,.6);display:flex;justify-content:space-between;align-items:center;gap:20px}
.foot .w{font-weight:700;font-size:26px;color:#e4c574}
.foot .p{font-weight:700;font-size:24px;text-align:right}
.note{margin-top:12px;font-weight:600;font-size:21px;color:#cfc6ae;text-align:center}
</style></head><body>
<div class="ph"></div><div class="sh"></div>
<div class="top">${brand}<div class="badge">Вилла на продажу</div></div>
<div class="body">
<div class="title">Вилла с видом на море<br>в Стамбуле, готова к заселению</div>
<div class="price">Цена от $1,55 млн</div>
<div class="pts">
<div class="pt"><div class="c">✓</div><b>5 спален, 7 ванных и собственный бассейн</b></div>
<div class="pt"><div class="c">✓</div><b>Подходит для получения гражданства Турции</b></div>
</div>
<div class="foot"><div class="w">hadararealestate.com</div><div class="p">HADARA · ваш партнёр<br>по недвижимости в Стамбуле</div></div>
<div class="note">Marmara Haven Villa · Бююкчекмедже, Стамбул · цена зависит от способа оплаты</div>
</div></body></html>` };
};

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const story of [false, true]) {
  const x = hero(story);
  const name = `villa-${story ? "story" : "feed"}`;
  const p = await b.newPage({ viewport: { width: x.w, height: x.h } });
  const f = path.join(OUT, `${name}.html`);
  fs.writeFileSync(f, x.html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  const spill = await p.evaluate((W) => [...document.querySelectorAll(".body *, .top *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > W); }).map((e) => e.className || e.tagName).slice(0, 5), x.w);
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 90 });
  fs.unlinkSync(f);
  await p.close();
  console.log(name, spill.length ? `SPILL ${spill.join(",")}` : "ok");
}
await b.close();
