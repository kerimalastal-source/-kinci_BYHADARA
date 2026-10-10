// Renders the Gulf campaign ad images (4:5 feed + 9:16 story) from project photos.
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "gulf-2026-10");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const img = (p) => `file://${REPO}/public/images/projects/${p}`;

const ADS = [
  {
    id: "citizenship",
    photo: img("beylikduzu-living/courtyard-gardens.jpg"),
    badgeAr: "الجنسية التركية",
    badgeEn: "Turkish Citizenship",
    ar: "الجنسية التركية<br>عبر الاستثمار العقاري",
    en: "Turkish citizenship through real estate",
    points: [
      ["عقار بقيمة 400 ألف دولار فما فوق حسب القانون", "Property of US$400,000+ as required by law"],
      ["لك ولزوجتك وأبنائك دون 18 عاماً", "For you, your spouse and children under 18"],
      ["نرافقك من اختيار العقار حتى استلام مفتاحك", "We guide you from choosing to your keys"],
    ],
    note: "الشروط وفق القانون الحالي وقابلة للتغيير · Conditions per current law",
  },
  {
    id: "residence",
    photo: img("lotus-yali/aerial-sea-view.jpg"),
    badgeAr: "الإقامة العقارية",
    badgeEn: "Residence Permit",
    ar: "بيتك في إسطنبول<br>وإقامتك فيها",
    en: "Your home in Istanbul, your residence too",
    points: [
      ["تملّك منزلاً للسكن وتقدّم بطلب الإقامة العقارية", "Own a home and apply for a residence permit"],
      ["مجمّعات بمسابح ونادٍ رياضي وحراسة <bdi dir=\"ltr\">24/7</bdi>", "Pools, gym and 24/7 security"],
      ["جولة خاصة عبر الفيديو قبل سفرك", "Private video tour before you travel"],
    ],
    note: "وفق شروط رئاسة إدارة الهجرة التركية · Per Turkish migration rules",
  },
  {
    id: "investment",
    photo: img("diamond-marin/aerial-sea-view.jpg"),
    badgeAr: "استثمر في إسطنبول",
    badgeEn: "Invest in Istanbul",
    ar: "استثمر في إسطنبول<br>مع شريك يعرف السوق",
    en: "Invest in Istanbul with a partner who knows the market",
    points: [
      ["مشاريع حديثة الإطلاق وأخرى جاهزة للسكن", "New launches and ready-to-move-in homes"],
      ["بيليكدوزو · بيوكجكمجة · شيشلي", "Beylikdüzü · Büyükçekmece · Şişli"],
      ["فريق يتحدث العربية في كل خطوة", "An Arabic-speaking team at every step"],
    ],
    note: "",
  },
];

const css = (w, h, story) => `
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:600;src:url(${font("plex-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;background:#0f2b21;font-family:Inter,sans-serif;color:#fff;position:relative}
.ph{position:absolute;inset:0;background-size:cover;background-position:center}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.55) 0%,rgba(8,26,20,.05) 22%,rgba(8,26,20,.15) 40%,rgba(8,26,20,.86) 62%,rgba(8,26,20,.97) 100%)}
.top{position:absolute;left:60px;right:60px;top:${story ? 230 : 56}px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:16px}.brand img{height:74px}
.brand b{display:block;font-weight:700;font-size:34px;letter-spacing:5px;line-height:1}.brand i{display:block;font-style:normal;font-weight:600;font-size:14px;letter-spacing:7px;color:#e4c574;margin-top:9px}
.badge{border:2px solid #c9a24b;background:rgba(15,43,33,.72);border-radius:50px;padding:12px 26px;display:flex;gap:14px;align-items:center;color:#e4c574;font-weight:700;font-size:23px}
.badge .a{font-family:Plex;font-size:27px}
.body{position:absolute;left:60px;right:60px;bottom:${story ? 300 : 70}px}
.ar{font-family:Plex;font-weight:700;font-size:${story ? 76 : 70}px;line-height:1.25;text-align:right;direction:rtl;text-shadow:0 3px 14px rgba(0,0,0,.55)}
.en{font-weight:700;font-size:${story ? 36 : 34}px;line-height:1.25;margin-top:14px;color:#efe6cf;direction:ltr}
.pts{margin-top:30px;display:grid;gap:16px}
.pt{display:grid;grid-template-columns:1fr 46px;gap:16px;align-items:start;direction:ltr}
.pt .c{width:46px;height:46px;border-radius:50%;background:#c9a24b;color:#0f2b21;display:grid;place-items:center;font-size:28px;font-weight:700}
.pt .t{text-align:right}
.pt .t b{display:block;font-family:Plex;font-weight:700;font-size:${story ? 36 : 33}px;line-height:1.3;direction:rtl}
.pt .t span{display:block;font-weight:600;font-size:${story ? 24 : 22}px;color:#d9cfb6;direction:ltr;margin-top:2px}
.foot{margin-top:30px;padding-top:22px;border-top:2px solid rgba(201,162,75,.6);display:flex;justify-content:space-between;align-items:center;gap:20px}
.foot .w{font-weight:700;font-size:26px;color:#e4c574;direction:ltr}
.foot .p{font-family:Plex;font-weight:700;font-size:28px;direction:rtl}
.note{margin-top:14px;font-family:Plex;font-weight:600;font-size:20px;color:#cfc6ae;text-align:center}
`;

const html = (a, w, h, story) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head><body>
<div class="ph" style="background-image:url('${a.photo}')"></div><div class="sh"></div>
<div class="top"><div class="brand"><img src="file://${REPO}/public/logo-light.png"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
<div class="badge"><span class="a">${a.badgeAr}</span><span>·</span><span>${a.badgeEn}</span></div></div>
<div class="body">
<div class="ar">${a.ar}</div><div class="en">${a.en}</div>
<div class="pts">${a.points.map(([ar, en]) => `<div class="pt"><div class="t"><b>${ar}</b><span>${en}</span></div><div class="c">✓</div></div>`).join("")}</div>
<div class="foot"><div class="w">hadararealestate.com</div><div class="p">حضارة · شريكك العقاري في إسطنبول</div></div>
${a.note ? `<div class="note">${a.note}</div>` : ""}
</div></body></html>`;

const b = await chromium.launch();
for (const a of ADS) {
  for (const [w, h, story, suffix] of [[1080, 1350, false, "feed"], [1080, 1920, true, "story"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const f = path.join(OUT, `ad-${a.id}-${suffix}.html`);
    fs.writeFileSync(f, html(a, w, h, story));
    await p.goto("file://" + f);
    await p.waitForTimeout(400);
    const over = await p.evaluate(() => {
      const b = document.querySelector(".body").getBoundingClientRect(), t = document.querySelector(".top").getBoundingClientRect();
      return { bodyTop: Math.round(b.top), topBottom: Math.round(t.bottom) };
    });
    await p.screenshot({ path: path.join(OUT, `ad-${a.id}-${suffix}.jpg`), type: "jpeg", quality: 90 });
    console.log(a.id, suffix, JSON.stringify(over));
    fs.unlinkSync(f);
    await p.close();
  }
}
await b.close();
