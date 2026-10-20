// Renders the Gulf WhatsApp carousel ad (2026-10-19): the 30% / 30-month payment plan on
// four projects, English first and Arabic under it (owner rule for the Gulf, 2026-10-13).
// 1080x1080 per card. Facts come from src/data/projects.ts + projectsData only.
// Run: GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-gulf-carousel.mjs
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "gulf-2026-10", "carousel");
fs.mkdirSync(OUT, { recursive: true });
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const photo = (p) => `file://${REPO}/public/images/projects/${p}`;
const LOGO = `file://${REPO}/public/logo-light.png`;
const TOTAL = 6;

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
.plan{display:inline-flex;align-items:center;gap:14px;padding:10px 22px;border-radius:40px;background:#c9a24b;color:#0f2b21;font-weight:700;font-size:24px;direction:ltr}
.plan .a{font-family:Plex;font-size:26px;direction:rtl}
`;

const brand = `<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>`;
const count = (n) => `<div class="count">0${n} <span>/ 0${TOTAL}</span></div>`;
const planChip = `<div class="plan"><span>30% down · 30 months</span><span>|</span><span class="a">30% مقدّم · 30 شهراً</span></div>`;

// ---------- Cover ----------
const cover = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;inset:0;background:url('${photo("diamond-marin/aerial-sea-view.jpg")}') center 50%/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.55) 0%,rgba(8,26,20,0) 20%,rgba(8,26,20,.1) 34%,rgba(8,26,20,.85) 58%,rgba(8,26,20,.97) 100%)}
.body{position:absolute;left:64px;right:64px;bottom:58px}
.eyebrow{font-weight:700;font-size:26px;color:#e4c574;letter-spacing:.5px}
.en{font-weight:700;font-size:70px;line-height:1.08;margin-top:10px;text-shadow:0 3px 16px rgba(0,0,0,.5)}
.ar{font-family:Plex;font-weight:700;font-size:50px;line-height:1.3;direction:rtl;text-align:right;margin-top:16px;color:#f3e7c8}
.q{margin-top:22px;padding:14px 22px;border:2px solid #c9a24b;border-radius:18px;background:rgba(201,162,75,.12);display:flex;justify-content:space-between;gap:20px;align-items:center}
.q .qe{font-weight:700;font-size:22px;color:#efe6cf}
.q .qa{font-family:Plex;font-weight:700;font-size:24px;color:#f3d98e;direction:rtl}
.swipe{margin-top:22px;display:flex;justify-content:space-between;align-items:center}
.swipe .s{font-weight:700;font-size:24px;color:#efe6cf}
.swipe .sa{font-family:Plex;font-weight:700;font-size:26px;color:#efe6cf;direction:rtl}
.dots{display:flex;gap:7px}.dots i{width:9px;height:9px;border-radius:50%;background:rgba(239,230,207,.35)}.dots i:first-child{background:#e4c574;width:24px;border-radius:5px}
</style></head><body>
<div class="ph"></div><div class="sh"></div>${brand}${count(1)}
<div class="body">
<div class="eyebrow">4 projects in Istanbul · <span dir="rtl" style="font-family:Plex">4 مشاريع في إسطنبول</span></div>
<div class="en">Pay 30% now,<br>the rest over 30 months</div>
<div class="ar">ادفع 30% الآن والباقي على 30 شهراً</div>
<div class="q"><span class="qe">On new launches &amp; projects under construction</span><span class="qa">في المشاريع الجديدة وقيد الإنشاء</span></div>
<div class="swipe"><span class="s">Swipe to see the projects</span><span class="dots">${"<i></i>".repeat(TOTAL)}</span><span class="sa">اسحب لمشاهدة المشاريع</span></div>
</div></body></html>`;

// ---------- Project slides ----------
// Every line is from the project's own data (highlights, delivery, price).
const PROJECTS = [
  {
    photo: "beylikduzu-living/courtyard-gardens.jpg", pos: "center 55%",
    en: "Lotus Yaşam", ar: "لوتس ياشام", placeEn: "Beylikdüzü, Istanbul", placeAr: "بيليكدوزو، إسطنبول",
    chips: [["Homes from US$200,000", "مساكن من 200 ألف دولار"], ["2+1, 3+1 & 4+1", "شقق 2+1 و3+1 و4+1"], ["Delivery late 2028", "التسليم نهاية 2028"]],
  },
  {
    photo: "diamond-marin/facade.jpg", pos: "center 55%",
    en: "Diamond Marin", ar: "دايموند مارين", placeEn: "Beylikdüzü, Istanbul", placeAr: "بيليكدوزو، إسطنبول",
    chips: [["3+1 for only 58 families", "شقق 3+1 لـ 58 عائلة فقط"], ["5 min to West Istanbul Marina", "5 دقائق إلى مارينا غرب إسطنبول"], ["Delivery late 2027", "التسليم أواخر 2027"]],
  },
  {
    photo: "casablu-vadi/living-sea-sunset.jpg", pos: "center 55%",
    en: "CasaBlu Vadi", ar: "كازا بلو وادي", placeEn: "Beylikdüzü, Istanbul", placeAr: "بيليكدوزو، إسطنبول",
    chips: [["300 m from the sea", "300 متر من البحر"], ["Homes from 2+1 to 6+1", "مساكن من 2+1 إلى 6+1"], ["Delivery November 2027", "التسليم نوفمبر 2027"]],
  },
  {
    photo: "lotus-sisli/twin-towers.jpg", pos: "center 40%",
    en: "Lotus Şişli", ar: "لوتس شيشلي", placeEn: "Şişli, central Istanbul", placeAr: "شيشلي، قلب إسطنبول",
    chips: [["Apartments & penthouses", "شقق وبنتهاوس"], ["Steps from the metro", "على بُعد خطوات من المترو"], ["Indoor pool, spa & concierge", "مسبح داخلي وسبا وكونسيرج"]],
  },
];

const project = (p, i) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;left:0;right:0;top:0;height:600px;background:url('${photo(p.photo)}') ${p.pos}/cover}
.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.5) 0%,rgba(8,26,20,0) 24%,rgba(8,26,20,0) 78%,rgba(15,43,33,.6) 100%)}
.panel{position:absolute;left:0;right:0;bottom:0;height:480px;background:#0f2b21;border-top:3px solid #c9a24b}
.inner{position:absolute;left:60px;right:60px;top:36px;bottom:40px;display:flex;flex-direction:column;justify-content:space-between}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.en{font-weight:700;font-size:58px;line-height:1}
.pe{font-weight:600;font-size:22px;color:#cfc6ae;margin-top:10px}
.ar{font-family:Plex;font-weight:700;font-size:46px;direction:rtl;text-align:right;line-height:1.1}
.pa{font-family:Plex;font-weight:600;font-size:22px;color:#cfc6ae;direction:rtl;text-align:right;margin-top:10px}
.chips{display:grid;gap:10px}
.c{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:10px 18px;border-radius:14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(201,162,75,.4)}
.c .ce{font-weight:700;font-size:24px}
.c .ca{font-family:Plex;font-weight:700;font-size:26px;color:#f3d98e;direction:rtl}
.foot{display:flex;justify-content:space-between;align-items:center}
.site{font-weight:700;font-size:20px;color:#cfc6ae;letter-spacing:.5px}
</style></head><body>
<div class="ph"></div>${brand}${count(i + 2)}
<div class="panel"><div class="inner">
<div class="head"><div><div class="en">${p.en}</div><div class="pe">${p.placeEn}</div></div><div><div class="ar">${p.ar}</div><div class="pa">${p.placeAr}</div></div></div>
<div class="chips">${p.chips.map(([e, a]) => `<div class="c"><span class="ce">${e}</span><span class="ca">${a}</span></div>`).join("")}</div>
<div class="foot">${planChip}<span class="site">hadararealestate.com</span></div>
</div></div></body></html>`;

// ---------- Closing ----------
const CHECK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f2b21" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const POINTS = [
  ["30% down payment, the rest over 30 months", "دفعة أولى 30% والباقي على 30 شهراً"],
  ["Homes in Istanbul from US$200,000", "مساكن في إسطنبول تبدأ من 200 ألف دولار"],
  ["Citizenship: one or more homes totalling US$400k+", "الجنسية بعقار أو أكثر بقيمة إجمالية 400 ألف دولار فأكثر"],
];
const closing = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:radial-gradient(120% 90% at 85% 0%,#1f4b3b 0%,#0f2b21 55%,#0a1f17 100%)}
.ph{position:absolute;inset:0;background:url('${photo("casablu-vadi/aerial-valley-sea.jpg")}') center 40%/cover;opacity:.09}
.body{position:absolute;left:64px;right:64px;top:170px}
.en{font-weight:700;font-size:68px;line-height:1.1}
.ar{font-family:Plex;font-weight:700;font-size:54px;direction:rtl;text-align:right;margin-top:16px;color:#f3e7c8}
.list{margin-top:58px;display:grid;gap:34px}
.p{display:grid;grid-template-columns:52px 1fr;gap:20px;align-items:center}
.p .k{width:52px;height:52px;border-radius:50%;background:#c9a24b;display:grid;place-items:center}
.p b{display:block;font-weight:700;font-size:30px}
.p span{display:block;font-family:Plex;font-weight:700;font-size:30px;color:#f3d98e;direction:rtl;text-align:right;margin-top:4px}
.bottom{position:absolute;left:64px;right:64px;bottom:60px;padding:22px 28px;border-radius:22px;background:rgba(201,162,75,.16);border:2px solid #c9a24b;display:flex;justify-content:space-between;align-items:center;gap:20px}
.bottom .be{font-weight:700;font-size:27px}
.bottom .ba{font-family:Plex;font-weight:700;font-size:30px;color:#f3d98e;direction:rtl}
</style></head><body>
<div class="ph"></div>${brand}${count(TOTAL)}
<div class="body">
<div class="en">Tell us your budget<br>on WhatsApp</div>
<div class="ar">أخبرنا بميزانيتك عبر واتساب</div>
<div class="list">${POINTS.map(([e, a]) => `<div class="p"><div class="k">${CHECK}</div><div><b>${e}</b><span>${a}</span></div></div>`).join("")}</div>
</div>
<div class="bottom"><span class="be">We reply in English &amp; Arabic</span><span class="ba">نردّ بالعربية والإنجليزية</span></div>
</body></html>`;

const b = await chromium.launch();
const slides = [cover(), ...PROJECTS.map(project), closing()];
for (const [i, html] of slides.entries()) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  const f = path.join(OUT, `card-${i + 1}.html`);
  fs.writeFileSync(f, html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  const spill = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > 1080 || r.bottom > 1080); }).map((e) => e.className || e.tagName).slice(0, 5));
  await p.screenshot({ path: path.join(OUT, `card-${i + 1}.jpg`), type: "jpeg", quality: 90 });
  fs.unlinkSync(f);
  console.log(`card-${i + 1}`, spill.length ? `SPILL ${spill.join(",")}` : "ok");
  await p.close();
}
await b.close();
