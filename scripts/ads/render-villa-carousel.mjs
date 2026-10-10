// Renders the Marmara Haven Villa carousel ad: a cover, six feature slides and a
// closing slide, 1080x1080 each. Facts come from the villa's confirmed data only
// (src/data/projects.ts + projectsData.marmara-haven-villa).
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "villa-2026-10");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const photo = (n) => `file://${REPO}/public/images/projects/marmara-haven-villa/${n}.jpg`;
const LOGO = `file://${REPO}/public/logo-light.png`;
const TOTAL = 8;

const BASE = `
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:600;src:url(${font("plex-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1080px;overflow:hidden;background:#0f2b21;color:#fff;font-family:Inter,sans-serif;position:relative}
.brand{position:absolute;left:48px;top:44px;display:flex;align-items:center;gap:14px;z-index:2;background:rgba(10,30,23,.62);border-radius:20px;padding:10px 20px 10px 14px}
.brand img{height:52px}
.brand b{display:block;font-weight:700;font-size:28px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:12px;letter-spacing:6px;color:#e4c574;margin-top:8px}
.count{position:absolute;right:56px;top:56px;z-index:2;direction:ltr;font-weight:700;font-size:22px;letter-spacing:2px;color:#f3d98e;background:rgba(10,30,23,.62);border:1.5px solid rgba(201,162,75,.8);border-radius:40px;padding:9px 20px}
.count span{color:#efe6cf;opacity:.75}
`;

const brand = `<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>`;
const count = (n) => `<div class="count">0${n} <span>/ 0${TOTAL}</span></div>`;

// ---------- Cover ----------
const cover = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;inset:0;background:url('${photo("dusk-pool")}') center 58%/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.55) 0%,rgba(8,26,20,0) 20%,rgba(8,26,20,0) 38%,rgba(8,26,20,.82) 62%,rgba(8,26,20,.97) 100%)}
.badge{position:absolute;right:56px;top:126px;z-index:2;display:flex;gap:12px;align-items:center;border:2px solid #c9a24b;background:rgba(10,30,23,.62);border-radius:50px;padding:10px 24px;color:#e4c574;font-weight:700;font-size:21px}
.badge .a{font-family:Plex;font-size:25px}
.body{position:absolute;left:64px;right:64px;bottom:60px;text-align:right}
.eyebrow{font-family:Plex;font-weight:700;font-size:28px;color:#e4c574;direction:rtl}
.ar{font-family:Plex;font-weight:700;font-size:72px;line-height:1.22;direction:rtl;margin-top:6px;text-shadow:0 3px 16px rgba(0,0,0,.5)}
.en{font-weight:700;font-size:30px;color:#efe6cf;margin-top:12px;direction:ltr;text-align:right}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:30px;direction:rtl}
.price{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px 28px;border-radius:20px;background:rgba(201,162,75,.16);border:2px solid #c9a24b}
.price .p-ar{font-family:Plex;font-weight:700;font-size:40px;color:#f3d98e;direction:rtl}
.price .p-en{font-weight:700;font-size:22px;color:#efe6cf;direction:ltr;align-self:flex-start}
.swipe{display:flex;align-items:center;gap:12px;font-family:Plex;font-weight:700;font-size:26px;color:#efe6cf;direction:rtl}
.dots{display:flex;gap:7px;direction:ltr}.dots i{width:9px;height:9px;border-radius:50%;background:rgba(239,230,207,.35)}.dots i:first-child{background:#e4c574;width:24px;border-radius:5px}
</style></head><body>
<div class="ph"></div><div class="sh"></div>${brand}${count(1)}
<div class="badge"><span class="a">فيلا للبيع</span><span>·</span><span>Villa for Sale</span></div>
<div class="body">
<div class="eyebrow">فيلا مرمرة هيفن · بيوكجكمجة، إسطنبول</div>
<div class="ar">فيلا بإطلالة بحرية<br>جاهزة للسكن في إسطنبول</div>
<div class="en">A sea-view villa, ready to move in, Istanbul</div>
<div class="row">
<div class="price"><span class="p-ar">السعر من 1.55 مليون دولار</span><span class="p-en">From US$1.55M</span></div>
<div class="swipe"><span>اسحب لاكتشاف الفيلا</span><span class="dots">${"<i></i>".repeat(TOTAL)}</span></div>
</div></div></body></html>`;

// ---------- Feature slides ----------
const FEATURES = [
  { photo: "sunset", pos: "center 52%", ar: "إطلالة مفتوحة على بحر مرمرة", en: "Open views over the Sea of Marmara", chip: "وساحل السباحة على بُعد 5 دقائق" },
  { photo: "garden-wide", pos: "center 62%", ar: "مسبح خاص وحديقة", en: "A private pool and garden", chip: "على أرض بمساحة 637 متراً مربعاً" },
  { photo: "bedroom-sea", pos: "center 58%", ar: "خمس غرف نوم وسبعة حمّامات", en: "Five bedrooms and seven bathrooms", chip: "576 متراً مربعاً على أربعة طوابق" },
  { photo: "living-sea", pos: "center 62%", ar: "صالون واسع ومطبخ مجهّز", en: "A spacious living room and fitted kitchen", chip: "يفتحان على تراس الحديقة" },
  { photo: "attic", pos: "center 60%", ar: "طابق السطح بإطلالة بحرية", en: "A roof floor with sea views", chip: "صالون ومطبخ وتراس على السطح" },
  { photo: "entrance", pos: "center 62%", ar: "مصعد ومنزل ذكي وتدفئة أرضية", en: "Lift, smart home and underfloor heating", chip: "تحكّم بالإضاءة والتدفئة والأمان من هاتفك" },
];

const feature = (f, i) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;left:0;right:0;top:0;height:730px;background:url('${photo(f.photo)}') ${f.pos}/cover}
.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.5) 0%,rgba(8,26,20,0) 22%,rgba(8,26,20,0) 80%,rgba(15,43,33,.55) 100%)}
.panel{position:absolute;left:0;right:0;bottom:0;height:350px;background:#0f2b21;border-top:3px solid #c9a24b}
.inner{position:absolute;left:64px;right:64px;top:44px;bottom:44px;display:flex;flex-direction:column;justify-content:space-between}
.head{display:grid;grid-template-columns:1fr 96px;gap:28px;align-items:center;direction:ltr}
.num{width:96px;height:96px;border-radius:50%;border:2.5px solid #c9a24b;display:grid;place-items:center;font-weight:700;font-size:38px;color:#f3d98e;direction:ltr}
.txt{text-align:right}
.ar{font-family:Plex;font-weight:700;font-size:58px;line-height:1.25;direction:rtl}
.en{font-weight:700;font-size:28px;color:#e8dcbc;margin-top:8px;direction:ltr;text-align:right}
.foot{display:flex;justify-content:space-between;align-items:center;direction:rtl;padding-top:26px;border-top:1.5px solid rgba(201,162,75,.38)}
.chip{font-family:Plex;font-weight:700;font-size:30px;color:#f3d98e;direction:rtl}
.site{font-weight:700;font-size:22px;color:#cfc6ae;direction:ltr;letter-spacing:.5px}
</style></head><body>
<div class="ph"></div>${brand}${count(i + 2)}
<div class="panel"><div class="inner">
<div class="head"><div class="txt"><div class="ar">${f.ar}</div><div class="en">${f.en}</div></div><div class="num">0${i + 1}</div></div>
<div class="foot"><span class="chip">${f.chip}</span><span class="site">hadararealestate.com</span></div>
</div></div></body></html>`;

// ---------- Closing slide ----------
const FACTS = [
  ["637 m²", "مساحة الأرض"],
  ["576 m²", "المساحة الإجمالية"],
  ["5", "غرف نوم"],
  ["7", "حمّامات"],
];
const CHECKS = [
  ["طابو مستقل", "Independent title deed"],
  ["مؤهّلة للحصول على الجنسية التركية", "Eligible for Turkish citizenship"],
  ["جاهزة للسكن، اكتمل الإنشاء 2026", "Ready to move in, completed 2026"],
];
const CHECK = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0f2b21" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

const closing = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:radial-gradient(120% 90% at 85% 0%,#1f4b3b 0%,#0f2b21 55%,#0a1f17 100%)}
.ph{position:absolute;inset:0;background:url('${photo("dusk-pool")}') center 40%/cover;opacity:.08}
.body{position:absolute;left:64px;right:64px;top:150px;text-align:right}
.eyebrow{font-family:Plex;font-weight:700;font-size:27px;color:#e4c574;direction:rtl}
.ar{font-family:Plex;font-weight:700;font-size:62px;line-height:1.2;direction:rtl;margin-top:6px}
.en{font-weight:700;font-size:27px;color:#e8dcbc;margin-top:6px;direction:ltr;text-align:right}
.checks{margin-top:30px;display:grid;gap:16px}
.ck{display:grid;grid-template-columns:1fr 46px;gap:18px;align-items:center;direction:ltr}
.ck .c{width:46px;height:46px;border-radius:50%;background:#c9a24b;display:grid;place-items:center}
.ck .t{text-align:right}
.ck b{display:block;font-family:Plex;font-weight:700;font-size:33px;direction:rtl;line-height:1.3}
.ck span{display:block;font-weight:600;font-size:20px;color:#cfc6ae;direction:ltr}
.facts{position:absolute;left:64px;right:64px;top:668px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;direction:rtl}
.f{border:1.5px solid rgba(201,162,75,.55);border-radius:18px;padding:16px 8px;text-align:center;background:rgba(255,255,255,.04)}
.f b{display:block;font-weight:700;font-size:36px;color:#f3d98e;direction:ltr}
.f i{display:block;font-style:normal;font-family:Plex;font-weight:700;font-size:22px;margin-top:2px}
.bottom{position:absolute;left:64px;right:64px;bottom:58px;display:flex;justify-content:space-between;align-items:center;direction:rtl}
.price{display:flex;flex-direction:column;gap:2px;padding:14px 26px;border-radius:20px;background:rgba(201,162,75,.16);border:2px solid #c9a24b}
.price .p-ar{font-family:Plex;font-weight:700;font-size:36px;color:#f3d98e;direction:rtl}
.price .p-en{font-weight:700;font-size:20px;color:#efe6cf;direction:ltr;align-self:flex-start}
.cta{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.cta b{font-family:Plex;font-weight:700;font-size:30px;color:#fff;direction:rtl}
.cta span{font-weight:700;font-size:22px;color:#e4c574;direction:ltr}
</style></head><body>
<div class="ph"></div>${brand}${count(TOTAL)}
<div class="body">
<div class="eyebrow">فيلا مرمرة هيفن · بيوكجكمجة، إسطنبول</div>
<div class="ar">اعرف المزيد عن الفيلا</div>
<div class="en">Discover Marmara Haven Villa</div>
<div class="checks">${CHECKS.map(([ar, en]) => `<div class="ck"><div class="t"><b>${ar}</b><span>${en}</span></div><div class="c">${CHECK}</div></div>`).join("")}</div>
</div>
<div class="facts">${FACTS.map(([v, l]) => `<div class="f"><b>${v}</b><i>${l}</i></div>`).join("")}</div>
<div class="bottom">
<div class="cta"><b>الصور والطوابق والتفاصيل كاملة</b><span>hadararealestate.com</span></div>
<div class="price"><span class="p-ar">السعر من 1.55 مليون دولار</span><span class="p-en">From US$1.55M</span></div>
</div></body></html>`;

const b = await chromium.launch();
const slides = [cover(), ...FEATURES.map(feature), closing()];
for (const [i, html] of slides.entries()) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  const f = path.join(OUT, `slide-${i + 1}.html`);
  fs.writeFileSync(f, html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  // Report anything that spills out of the 1080px frame.
  const spill = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > 1080 || r.bottom > 1080); }).map((e) => e.className || e.tagName).slice(0, 5));
  await p.screenshot({ path: path.join(OUT, `slide-${i + 1}.jpg`), type: "jpeg", quality: 92 });
  fs.unlinkSync(f);
  console.log(`slide-${i + 1}`, spill.length ? `SPILL ${spill.join(",")}` : "ok");
  await p.close();
}
await b.close();
