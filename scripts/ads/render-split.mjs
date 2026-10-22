// "Split" ad layout (owner 2026-10-22, from a reference he sent): ivory page, HADARA logo, a big Arabic
// headline with the English line under it, a small gold project label, two photos side by side, and a
// one-line footer (website | call to action). Little text, photos do the work.
//   GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-split.mjs [id ...]
import { createRequire } from "module";
import path from "path";
import fs from "fs";
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
    photos: [
      { src: img("marmara-haven-villa/dusk-pool.jpg"), pos: "34% 66%", size: "auto 128%" },
      { src: img("marmara-haven-villa/terrace.jpg"), pos: "45% 64%", size: "auto 160%" },
    ],
    cta: ["Book a Private Viewing", "احجز معاينة خاصة"],
  },
  {
    id: "plan",
    ar: "ادفع 30% الآن<br>والباقي على 30 شهراً",
    en: "Pay 30% now, the rest over 30 months",
    label: "NEW LAUNCHES · UNDER CONSTRUCTION",
    photos: [
      { src: img("beylikduzu-living/central-garden.jpg"), pos: "30% center" },
      { src: img("beylikduzu-living/street-entrance.jpg"), pos: "center center" },
    ],
    cta: ["Message us on WhatsApp", "راسلنا عبر واتساب"],
  },
  {
    id: "citizenship",
    ar: "الجنسية التركية<br>عبر الاستثمار العقاري",
    en: "Turkish Citizenship through Real Estate",
    label: "ONE OR MORE PROPERTIES · US$400K+ IN TOTAL",
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
.en{margin-top:${story ? 18 : 12}px;padding:0 50px;font-weight:600;font-size:${story ? 46 : 40}px;letter-spacing:-.3px;text-align:center}
.label{margin:${story ? "30px 56px 34px" : "20px 56px 24px"};display:flex;align-items:center;gap:22px;color:#a8853a;font-weight:600;font-size:${story ? 23 : 21}px;letter-spacing:5px;white-space:nowrap}
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

const html = (a, w, h, story) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head><body>
<div class="head"><div class="brand"><img src="file://${REPO}/public/logo-dark.png"><div><b>HADARA</b><i>REAL ESTATE</i></div></div><div class="rule"></div></div>
<div class="ar">${a.ar}</div><div class="en">${a.en}</div>
<div class="label">${a.label}</div>
<div class="photos">${a.photos.map((p) => `<div style="background-image:url('${p.src}');background-position:${p.pos}${p.size ? `;background-size:${p.size}` : ""}"></div>`).join("")}</div>
<div class="foot"><span class="w">hadararealestate.com</span><span class="sep"></span><span class="c"><span class="a">${a.cta[1]}</span><span class="bar">|</span><span>${a.cta[0]}</span></span></div>
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
    // Fail loudly if a line wraps or overflows (the label and footer must stay on one line).
    const bad = await p.evaluate(() => [...document.querySelectorAll(".label,.foot")].filter((e) => e.scrollWidth > e.clientWidth + 1 || [...e.children].some((c) => c.getClientRects().length > 1 || c.offsetHeight > 60)).map((e) => e.className));
    if (bad.length) console.log("OVERFLOW", a.id, suffix, bad);
    await p.screenshot({ path: path.join(OUT, `${a.id}-${suffix}.jpg`), type: "jpeg", quality: 90 });
    fs.unlinkSync(f);
    await p.close();
  }
  console.log("done", a.id);
}
await b.close();
