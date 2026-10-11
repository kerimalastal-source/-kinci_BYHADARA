// Single-language versions of the Marmara Haven Villa carousel (Russian, Persian) for the
// language-split ad sets: same layout and photos as render-villa-carousel.mjs, one language per
// slide. Usage: GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/render-villa-carousel-i18n.mjs ru|fa
// Writes scripts/ads/villa-2026-10/<lang>/slide-<n>.jpg. Facts are the villa's confirmed data only.
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const LANG = process.argv[2];
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "villa-2026-10", LANG);
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const photo = (n) => `file://${REPO}/public/images/projects/marmara-haven-villa/${n}.jpg`;
const LOGO = `file://${REPO}/public/logo-light.png`;
const TOTAL = 8;

const TEXT = {
  ru: {
    dir: "ltr",
    font: "Inter",
    badge: "Вилла на продажу",
    eyebrow: "Marmara Haven Villa · Бююкчекмедже, Стамбул",
    title: "Вилла с видом на море<br>в Стамбуле, готова к заселению",
    price: "Цена от $1,55 млн",
    swipe: "Листайте, чтобы узнать больше",
    features: [
      ["Панорамный вид на Мраморное море", "Пляж для купания — в 5 минутах"],
      ["Собственный бассейн и сад", "Участок площадью 637 м²"],
      ["Пять спален и семь ванных комнат", "576 м² на четырёх уровнях"],
      ["Просторная гостиная и оборудованная кухня", "С выходом на террасу у сада"],
      ["Этаж под крышей с видом на море", "Гостиная, кухня и терраса на крыше"],
      ["Лифт, «умный дом» и тёплые полы", "Свет, отопление и охрана — с телефона"],
    ],
    more: "Узнайте больше о вилле",
    checks: ["Отдельное тапу (свидетельство о собственности)", "Подходит для получения гражданства Турции", "Готова к заселению, построена в 2026 году"],
    facts: [["637 м²", "Участок"], ["576 м²", "Общая площадь"], ["5", "Спален"], ["7", "Ванных"]],
    cta: "Все фото, этажи и подробности",
  },
  fa: {
    dir: "rtl",
    font: "Plex",
    badge: "ویلا برای فروش",
    eyebrow: "ویلا مرمرا هیون · بویوک‌چکمجه، استانبول",
    title: "ویلایی با چشم‌انداز دریا،<br>آماده سکونت در استانبول",
    price: "قیمت از 1.55 میلیون دلار",
    swipe: "برای دیدن ویلا ورق بزنید",
    features: [
      ["چشم‌انداز باز به دریای مرمره", "ساحل شنا در فاصله 5 دقیقه"],
      ["استخر اختصاصی و باغ", "روی زمینی به مساحت 637 متر مربع"],
      ["پنج اتاق خواب و هفت حمام", "576 متر مربع در چهار طبقه"],
      ["سالن نشیمن بزرگ و آشپزخانه مجهز", "رو به تراس باغ"],
      ["طبقه بام با چشم‌انداز دریا", "نشیمن، آشپزخانه و تراس بام"],
      ["آسانسور، خانه هوشمند و گرمایش از کف", "کنترل نور، گرمایش و امنیت با تلفن همراه"],
    ],
    more: "ویلا را بیشتر بشناسید",
    checks: ["سند مالکیت مستقل", "واجد شرایط دریافت شهروندی ترکیه", "آماده سکونت، تکمیل‌شده در 2026"],
    facts: [["637 m²", "مساحت زمین"], ["576 m²", "زیربنای کل"], ["5", "اتاق خواب"], ["7", "حمام"]],
    cta: "همه عکس‌ها، طبقات و جزئیات",
  },
}[LANG];
if (!TEXT) throw new Error("usage: render-villa-carousel-i18n.mjs ru|fa");

const RTL = TEXT.dir === "rtl";
const START = RTL ? "right" : "left";
const F = TEXT.font;
// Keep the numbers and the site address left-to-right inside Persian lines.
const iso = (s) => s.replace(/([0-9][0-9.,]*(?:\s?m²)?)/g, '<bdi dir="ltr">$1</bdi>');

const BASE = `
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:600;src:url(${font("plex-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1080px;overflow:hidden;background:#0f2b21;color:#fff;font-family:${F},sans-serif;position:relative}
.t{direction:${TEXT.dir};text-align:${START}}
.brand{position:absolute;left:48px;top:44px;display:flex;align-items:center;gap:14px;z-index:2;background:rgba(10,30,23,.62);border-radius:20px;padding:10px 20px 10px 14px;font-family:Inter}
.brand img{height:52px}
.brand b{display:block;font-weight:700;font-size:28px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:12px;letter-spacing:6px;color:#e4c574;margin-top:8px}
.count{position:absolute;right:56px;top:56px;z-index:2;direction:ltr;font-family:Inter;font-weight:700;font-size:22px;letter-spacing:2px;color:#f3d98e;background:rgba(10,30,23,.62);border:1.5px solid rgba(201,162,75,.8);border-radius:40px;padding:9px 20px}
.count span{color:#efe6cf;opacity:.75}
.site{font-family:Inter;font-weight:700;font-size:22px;color:#cfc6ae;direction:ltr;letter-spacing:.5px}
`;

const brand = `<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>`;
const count = (n) => `<div class="count">0${n} <span>/ 0${TOTAL}</span></div>`;

const cover = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;inset:0;background:url('${photo("dusk-pool")}') center 58%/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.55) 0%,rgba(8,26,20,0) 20%,rgba(8,26,20,0) 38%,rgba(8,26,20,.82) 62%,rgba(8,26,20,.97) 100%)}
.badge{position:absolute;right:56px;top:126px;z-index:2;border:2px solid #c9a24b;background:rgba(10,30,23,.62);border-radius:50px;padding:10px 26px;color:#e4c574;font-weight:700;font-size:25px}
.body{position:absolute;left:64px;right:64px;bottom:60px}
.eyebrow{font-weight:700;font-size:28px;color:#e4c574}
.title{font-weight:700;font-size:${RTL ? 70 : 56}px;line-height:1.2;margin-top:10px;text-shadow:0 3px 16px rgba(0,0,0,.5)}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:34px;direction:${TEXT.dir}}
.price{padding:16px 30px;border-radius:20px;background:rgba(201,162,75,.16);border:2px solid #c9a24b;font-weight:700;font-size:38px;color:#f3d98e;white-space:nowrap}
.swipe{display:flex;align-items:center;gap:12px;font-weight:700;font-size:24px;color:#efe6cf;white-space:nowrap}
.dots{display:flex;gap:7px;direction:ltr}.dots i{width:9px;height:9px;border-radius:50%;background:rgba(239,230,207,.35)}.dots i:first-child{background:#e4c574;width:24px;border-radius:5px}
</style></head><body>
<div class="ph"></div><div class="sh"></div>${brand}${count(1)}
<div class="badge t">${TEXT.badge}</div>
<div class="body t">
<div class="eyebrow">${TEXT.eyebrow}</div>
<div class="title">${TEXT.title}</div>
<div class="row"><div class="price t">${iso(TEXT.price)}</div><div class="swipe t"><span>${TEXT.swipe}</span><span class="dots">${"<i></i>".repeat(TOTAL)}</span></div></div>
</div></body></html>`;

const PHOTOS = [
  ["terrace", "center 47%"], ["garden-wide", "center 62%"], ["bedroom-sea", "center 58%"],
  ["living-sea", "center 62%"], ["attic", "center 60%"], ["entrance", "center 62%"],
];

const feature = ([title, chip], i) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
.ph{position:absolute;left:0;right:0;top:0;height:730px;background:url('${photo(PHOTOS[i][0])}') ${PHOTOS[i][1]}/cover}
.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.5) 0%,rgba(8,26,20,0) 22%,rgba(8,26,20,0) 80%,rgba(15,43,33,.55) 100%)}
.panel{position:absolute;left:0;right:0;bottom:0;height:350px;background:#0f2b21;border-top:3px solid #c9a24b}
.inner{position:absolute;left:64px;right:64px;top:44px;bottom:44px;display:flex;flex-direction:column;justify-content:space-between}
.head{display:flex;gap:28px;align-items:center;direction:${TEXT.dir}}
.num{flex:0 0 96px;width:96px;height:96px;border-radius:50%;border:2.5px solid #c9a24b;display:grid;place-items:center;font-family:Inter;font-weight:700;font-size:38px;color:#f3d98e;direction:ltr}
.title{font-weight:700;font-size:${title.length > 30 ? (RTL ? 48 : 46) : (RTL ? 56 : 50)}px;line-height:1.22}
.foot{display:flex;justify-content:space-between;align-items:center;direction:${TEXT.dir};padding-top:26px;border-top:1.5px solid rgba(201,162,75,.38)}
.chip{font-weight:700;font-size:30px;color:#f3d98e}
</style></head><body>
<div class="ph"></div>${brand}${count(i + 2)}
<div class="panel"><div class="inner">
<div class="head"><div class="num">0${i + 1}</div><div class="title t">${title}</div></div>
<div class="foot"><span class="chip t">${iso(chip)}</span><span class="site">hadararealestate.com</span></div>
</div></div></body></html>`;

const CHECK = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0f2b21" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

const closing = () => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:radial-gradient(120% 90% at 85% 0%,#1f4b3b 0%,#0f2b21 55%,#0a1f17 100%)}
.ph{position:absolute;inset:0;background:url('${photo("dusk-pool")}') center 40%/cover;opacity:.08}
.body{position:absolute;left:64px;right:64px;top:150px}
.eyebrow{font-weight:700;font-size:27px;color:#e4c574}
.title{font-weight:700;font-size:${RTL ? 62 : 56}px;line-height:1.2;margin-top:8px}
.checks{margin-top:36px;display:grid;gap:20px}
.ck{display:flex;gap:18px;align-items:center;direction:${TEXT.dir}}
.ck .c{flex:0 0 46px;width:46px;height:46px;border-radius:50%;background:#c9a24b;display:grid;place-items:center}
.ck b{font-weight:700;font-size:${RTL ? 33 : 30}px;line-height:1.3}
.facts{position:absolute;left:64px;right:64px;top:668px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;direction:${TEXT.dir}}
.f{border:1.5px solid rgba(201,162,75,.55);border-radius:18px;padding:16px 8px;text-align:center;background:rgba(255,255,255,.04)}
.f b{display:block;font-family:Inter;font-weight:700;font-size:36px;color:#f3d98e;direction:ltr}
.f i{display:block;font-style:normal;font-weight:700;font-size:22px;margin-top:2px;direction:${TEXT.dir}}
.bottom{position:absolute;left:64px;right:64px;bottom:58px;display:flex;justify-content:space-between;align-items:center;direction:${TEXT.dir}}
.price{padding:16px 28px;border-radius:20px;background:rgba(201,162,75,.16);border:2px solid #c9a24b;font-weight:700;font-size:34px;color:#f3d98e;white-space:nowrap}
.cta{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.cta b{font-weight:700;font-size:28px;color:#fff}
</style></head><body>
<div class="ph"></div>${brand}${count(TOTAL)}
<div class="body t">
<div class="eyebrow">${TEXT.eyebrow}</div>
<div class="title">${TEXT.more}</div>
<div class="checks">${TEXT.checks.map((c) => `<div class="ck"><div class="c">${CHECK}</div><b class="t">${iso(c)}</b></div>`).join("")}</div>
</div>
<div class="facts">${TEXT.facts.map(([v, l]) => `<div class="f"><b>${v}</b><i>${l}</i></div>`).join("")}</div>
<div class="bottom">
<div class="cta"><b class="t">${TEXT.cta}</b><span class="site">hadararealestate.com</span></div>
<div class="price t">${iso(TEXT.price)}</div>
</div></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const slides = [cover(), ...TEXT.features.map(feature), closing()];
for (const [i, html] of slides.entries()) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  const f = path.join(OUT, `slide-${i + 1}.html`);
  fs.writeFileSync(f, html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  const spill = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > 1080 || r.bottom > 1080); }).map((e) => e.className || e.tagName).slice(0, 5));
  await p.screenshot({ path: path.join(OUT, `slide-${i + 1}.jpg`), type: "jpeg", quality: 92 });
  fs.unlinkSync(f);
  console.log(`${LANG} slide-${i + 1}`, spill.length ? `SPILL ${spill.join(",")}` : "ok");
  await p.close();
}
await b.close();
