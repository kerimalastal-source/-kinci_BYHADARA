// "Split" ad layout (owner 2026-10-22, from a reference he sent): ivory page, HADARA logo, a big Arabic
// headline with the English line under it, a small gold project label, two photos side by side, and a
// one-line footer (website | call to action). Little text, photos do the work.
//   GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-split.mjs [id ...]
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "gulf-2026-10", "split");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const img = (p) => `file://${REPO}/public/images/projects/${p}`;

const ADS = [
  {
    id: "villa",
    ar: "فيلا بإطلالة بحرية كاملة<br>في إسطنبول",
    en: "Full Sea View Villa in Istanbul",
    label: "MARMARA HAVEN VILLA",
    // Owner 2026-10-22: the price on the image filters out people who cannot afford it.
    price: { ar: "بسعر يبدأ من 1.55 مليون دولار", en: "FROM US$1.55M" },
    // Owner 2026-10-22: the total area beside the headline, eye-catching but without a circle.
    badge: { num: "576", unit: "m²", ar: "المساحة الإجمالية", en: "TOTAL AREA" },
    photos: [
      { src: img("marmara-haven-villa/dusk-pool.jpg"), pos: "34% 66%", size: "auto 128%" },
      { src: img("marmara-haven-villa/terrace.jpg"), pos: "45% 64%", size: "auto 160%" },
    ],
    cta: ["Book a Private Viewing", "احجز معاينة خاصة"],
  },
  {
    id: "plan",
    // Owner 2026-10-22: a 30/30 plan exists nowhere else, so the ad must say where (Istanbul + the flag).
    ar: "شقتك في إسطنبول<br>ادفع 30% والباقي على 30 شهراً",
    en: "Istanbul homes: 30% now, the rest over 30 months",
    label: "ISTANBUL, TÜRKİYE · NEW LAUNCHES",
    flag: true,
    price: { ar: "مساكن من 200 ألف دولار", en: "HOMES FROM US$200,000" },
    photos: [
      // Owner 2026-10-22: one wide photo of the project with its garden, so it shows properly.
      { src: img("beylikduzu-living/central-garden.jpg"), pos: "42% center" },
    ],
    cta: ["Message us on WhatsApp", "راسلنا عبر واتساب"],
  },
  {
    id: "citizenship",
    ar: "الجنسية التركية<br>عبر الاستثمار العقاري",
    en: "Turkish Citizenship through Real Estate",
    label: "ONE OR MORE PROPERTIES · ISTANBUL",
    price: { ar: "بقيمة إجمالية 400 ألف دولار فأكثر", en: "US$400,000+ IN TOTAL" },
    photos: [
      { src: img("sea-pearl-atakoy/from-the-sea.jpg"), pos: "22% center" },
      { src: img("sea-pearl-atakoy/sea-terrace.jpg"), pos: "center center" },
    ],
    cta: ["Message us on WhatsApp", "راسلنا عبر واتساب"],
  },
];

const css = (w, h, story) => `
@font-face{font-family:Inter;font-weight:500;src:url(${font("inter-500.ttf")})}
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;background:#f7f5f0;color:#0f2b21;font-family:Inter,sans-serif;display:flex;flex-direction:column;padding:${story ? "200px 0 290px" : "46px 0 0"}}
.head{padding:0 56px;display:flex;align-items:center;gap:28px}
.brand{display:flex;align-items:center;gap:14px;flex:none}
.brand img{height:${story ? 76 : 64}px}
.brand b{display:block;font-weight:700;font-size:${story ? 34 : 30}px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:${story ? 14 : 12}px;letter-spacing:6px;color:#a8853a;margin-top:8px}
.rule{flex:1;height:2px;background:linear-gradient(90deg,#c9a24b,rgba(201,162,75,.35))}
.ar{margin-top:${story ? 40 : 26}px;padding:0 50px;font-family:Plex;font-weight:700;font-size:${story ? 88 : 76}px;line-height:1.22;text-align:center;direction:rtl}
.en{margin-top:${story ? 18 : 12}px;padding:0 50px;font-weight:600;line-height:1.25;font-size:${story ? 46 : 40}px;letter-spacing:-.3px;text-align:center}
.label{margin:${story ? "30px 56px 34px" : "20px 56px 24px"};display:flex;align-items:center;gap:22px;color:#a8853a;font-weight:600;font-size:${story ? 23 : 21}px;letter-spacing:5px;white-space:nowrap}
.lab{display:flex;align-items:center;gap:14px}.lab svg{height:${story ? 26 : 24}px;width:auto;border-radius:3px;box-shadow:0 0 0 1px rgba(15,43,33,.12)}
.hero{display:flex;align-items:center;gap:${story ? 22 : 18}px;padding:0 0 0 56px;margin-top:${story ? 34 : 22}px}
.hero .ht{flex:1;min-width:0}.hero .ar{margin-top:0;padding:0 44px 0 0}.hero .en{padding:0 44px 0 0}
.seal{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${story ? "6px 34px 6px 0" : "4px 30px 4px 0"};border-right:3px solid #c9a24b;color:#0f2b21}
.seal .sa{font-family:Plex;font-weight:700;font-size:${story ? 26 : 23}px;color:#a8853a;line-height:1.2}
.seal b{font-weight:700;font-size:${story ? 96 : 84}px;line-height:1;letter-spacing:-2px;margin:${story ? 8 : 6}px 0}
.seal b i{font-style:normal;font-weight:600;font-size:.4em;margin-left:5px;vertical-align:1.05em;letter-spacing:0}
.seal .se{font-weight:600;font-size:${story ? 16 : 14}px;letter-spacing:4px;color:#a8853a}
.price{align-self:center;margin-top:${story ? 30 : 20}px;display:flex;align-items:center;gap:${story ? 20 : 18}px;padding:${story ? "12px 34px" : "10px 30px"};border:2px solid #c9a24b;border-radius:99px;background:#fbf3df;white-space:nowrap}
.price .pa{font-family:Plex;font-weight:700;font-size:${story ? 34 : 30}px;line-height:1.3;direction:rtl}
.price .pe{font-weight:700;font-size:${story ? 27 : 24}px;letter-spacing:1px}
.price .pb{width:2px;height:${story ? 34 : 30}px;background:#c9a24b}
.label::before,.label::after{content:"";flex:1;height:2px;background:#c9a24b;opacity:.75}
.photos{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:0}
.photos div{background-size:cover}
.foot{display:flex;align-items:center;gap:26px;white-space:nowrap;padding:0 56px;height:${story ? 110 : 96}px;flex:none}
.foot .w{font-weight:500;font-size:27px;letter-spacing:1.5px}
.foot .sep{width:2px;height:46px;background:#c9a24b}
.foot .c{margin-left:auto;display:flex;align-items:center;gap:14px;font-weight:600;font-size:27px}
.foot .c .a{font-family:Plex;font-weight:700;font-size:29px;color:#0f2b21}
.foot .c .bar{color:#c9a24b}
`;

// Turkish flag (official proportions).
const FLAG = '<svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="800" fill="#e30a17"/><circle cx="425" cy="400" r="200" fill="#fff"/><circle cx="475" cy="400" r="160" fill="#e30a17"/><path fill="#fff" d="M583.334 400l180.901 58.779-111.804-153.885v190.212l111.804-153.885z"/></svg>';
const html = (a, w, h, story, prepped) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head><body>
<div class="head"><div class="brand"><img src="file://${REPO}/public/logo-dark.png"><div><b>HADARA</b><i>REAL ESTATE</i></div></div><div class="rule"></div></div>
${a.badge ? `<div class="hero"><div class="seal"><span class="sa">${a.badge.ar}</span><b dir="ltr">${a.badge.num}<i>${a.badge.unit}</i></b><span class="se">${a.badge.en}</span></div><div class="ht"><div class="ar">${a.ar}</div><div class="en">${a.en}</div></div></div>` : `<div class="ar">${a.ar}</div><div class="en">${a.en}</div>`}
${a.price ? `<div class="price"><span class="pa">${a.price.ar}</span><span class="pb"></span><span class="pe">${a.price.en}</span></div>` : ""}
<div class="label">${a.flag ? `<span class="lab">${FLAG}<span>${a.label}</span></span>` : a.label}</div>
<div class="photos"${a.photos.length === 1 ? ' style="grid-template-columns:1fr"' : ""}>${a.photos.map((p, i) => (prepped ? `<div style="background-image:url('file://${prepped[i]}');background-size:100% 100%"></div>` : `<div data-src="${p.src.replace("file://", "")}" data-pos="${p.pos}" data-size="${p.size || ""}"></div>`)).join("")}</div>
<div class="foot"><span class="w">hadararealestate.com</span><span class="sep"></span><span class="c"><span class="a">${a.cta[1]}</span><span class="bar">|</span><span>${a.cta[0]}</span></span></div>
</body></html>`;

// High resolution (owner 2026-10-22: "highest quality"): render at 2x (2160 wide) and feed each photo
// pre-cropped to its exact pixel size, so the browser never stretches a photo.
const SCALE = 2;
const PREP = path.join(OUT, "_prep");
fs.mkdirSync(PREP, { recursive: true });
const imgSize = (f) => execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;print(*Image.open(sys.argv[1]).size)", f]).toString().trim().split(" ").map(Number);
// CSS background math: where the photo sits in its box, turned into a crop of the source image.
function crop(src, pos, size, box) {
  const [iw, ih] = imgSize(src);
  const pct = (v) => (v === "center" ? 50 : parseFloat(v));
  const [px, py] = pos.split(" ").map(pct);
  let rw, rh;
  if (size) { rh = (box.h * parseFloat(size.split(" ")[1])) / 100; rw = (iw * rh) / ih; }
  else { const k = Math.max(box.w / iw, box.h / ih); rw = iw * k; rh = ih * k; }
  const k = rw / iw;
  const ox = ((box.w - rw) * px) / 100, oy = ((box.h - rh) * py) / 100;
  return [-ox / k, -oy / k, box.w / k, box.h / k];
}

const b = await chromium.launch();
const only = process.argv.slice(2);
for (const a of ADS.filter((x) => !only.length || only.includes(x.id))) {
  for (const [w, h, story, suffix] of [[1080, 1350, false, "feed"], [1080, 1920, true, "story"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SCALE });
    const f = path.join(OUT, `${a.id}-${suffix}.html`);
    fs.writeFileSync(f, html(a, w, h, story));
    await p.goto("file://" + f);
    await p.waitForTimeout(400);
    // Shrink a headline that wraps: the Arabic keeps its own line breaks, the English stays on one line.
    await p.evaluate(() => {
      const fit = (el, lines) => {
        const lh = () => parseFloat(getComputedStyle(el).lineHeight);
        let size = parseFloat(getComputedStyle(el).fontSize);
        while (el.getBoundingClientRect().height > lh() * lines + 2 && size > 24) el.style.fontSize = `${--size}px`;
      };
      const ar = document.querySelector(".ar");
      fit(ar, ar.querySelectorAll("br").length + 1);
      fit(document.querySelector(".en"), 1);
    });
    // Fail loudly if a line wraps or overflows (the label and footer must stay on one line).
    const bad = await p.evaluate(() => [...document.querySelectorAll(".label,.foot,.price")].filter((e) => e.scrollWidth > e.clientWidth + 1 || [...e.children].some((c) => c.getClientRects().length > 1 || c.offsetHeight > 60)).map((e) => e.className));
    if (bad.length) console.log("OVERFLOW", a.id, suffix, bad);
    const boxes = await p.evaluate(() => [...document.querySelectorAll(".photos > div")].map((d) => { const r = d.getBoundingClientRect(); return { w: r.width, h: r.height, src: d.dataset.src, pos: d.dataset.pos, size: d.dataset.size }; }));
    const jobs = boxes.map((x, i) => ({ src: x.src, out: path.join(PREP, `${a.id}-${suffix}-${i}.jpg`), box: crop(x.src, x.pos, x.size, x), size: [Math.round(x.w * SCALE), Math.round(x.h * SCALE)] }));
    const jf = path.join(PREP, "jobs.json");
    fs.writeFileSync(jf, JSON.stringify(jobs));
    console.log(execFileSync("python3", ["-I", path.join(HERE, "prep-photos.py"), jf]).toString().trim());
    fs.writeFileSync(f, html(a, w, h, story, jobs.map((j) => j.out)));
    const sizes = await p.evaluate(() => [".ar", ".en"].map((q) => document.querySelector(q).style.fontSize));
    await p.goto("file://" + f);
    await p.waitForTimeout(500);
    await p.evaluate((z) => [".ar", ".en"].forEach((q, i) => { if (z[i]) document.querySelector(q).style.fontSize = z[i]; }), sizes);
    await p.screenshot({ path: path.join(OUT, `${a.id}-${suffix}.jpg`), type: "jpeg", quality: 95 });
    fs.unlinkSync(f);
    await p.close();
  }
  console.log("done", a.id);
}
await b.close();
fs.rmSync(PREP, { recursive: true, force: true });
