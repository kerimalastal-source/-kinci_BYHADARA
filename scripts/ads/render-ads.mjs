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
      ["عقار أو أكثر بقيمة إجمالية 400 ألف دولار فما فوق", "One or more properties worth US$400,000+ in total"],
      ["لك ولزوجتك وأبنائك دون 18 عاماً", "For you, your spouse and children under 18"],
      ["نرافقك من اختيار العقار حتى استلام مفتاحك", "We guide you from choosing to your keys"],
    ],
    note: "حسب القانون التركي الحالي والشروط قابلة للتغيير · As required by current Turkish law",
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
  {
    id: "videotour",
    photo: `file://${REPO}/public/hero-istanbul.jpg`,
    phone: img("diamond-marin/living-room.jpg"),
    // The Bosphorus is a thin band low in this wide photo: enlarge it so the band sits beside the phone.
    photoBox: (story) => (story ? { top: -246, height: 1300 } : { top: -320, height: 1130 }),
    badgeAr: "جولة خاصة عبر الفيديو",
    badgeEn: "Private Video Tour",
    ar: "إسطنبول<br>على بُعد مكالمة فيديو",
    en: "Istanbul is just a video call away",
    points: [
      ["شاهد الشقة النموذجية والمشروع على أرض الواقع", "See the show apartment and the project on site, live"],
      ["بالعربية أو الإنجليزية، عبر واتساب أو زوم", "In Arabic or English, on WhatsApp or Zoom"],
      ["مجانية تماماً ودون أي التزام", "Completely free, no obligation"],
    ],
    note: '<span dir="rtl">يومياً من <bdi dir="ltr">9:00</bdi> حتى <bdi dir="ltr">18:30</bdi> بتوقيت إسطنبول، وهو توقيت الرياض والدوحة نفسه</span><br><span dir="ltr">Daily 9:00–18:30 Istanbul time, the same as Riyadh and Doha</span>',
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
.phone{position:absolute;left:78px;top:${story ? 380 : 168}px;width:${story ? 300 : 262}px;aspect-ratio:9/18.5;padding:11px;border-radius:46px;background:linear-gradient(160deg,#1d2622,#070b09);border:2px solid rgba(255,255,255,.18);box-shadow:0 40px 80px rgba(0,0,0,.55);transform:rotate(-4deg)}
.phone .s{position:relative;height:100%;overflow:hidden;border-radius:36px;background-size:cover;background-position:42% center}
.phone .s::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 26%,transparent 60%,rgba(0,0,0,.6) 100%)}
.phone .live{position:absolute;z-index:1;top:18px;left:16px;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:99px;background:rgba(0,0,0,.55);font-family:Plex;font-weight:700;font-size:19px}
.phone .live i{width:10px;height:10px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 0 5px rgba(255,77,77,.3)}
.phone .pip{position:absolute;z-index:1;top:16px;right:16px;width:74px;height:100px;border-radius:16px;background:linear-gradient(160deg,#1f4a3a,#0b1f17);border:2px solid rgba(228,197,116,.75);display:grid;place-items:center;align-content:center;gap:4px;color:#e4c574;font-family:Plex;font-weight:700;font-size:14px}
.phone .ctl{position:absolute;z-index:1;left:0;right:0;bottom:24px;display:flex;justify-content:center;gap:16px}
.phone .ctl span{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center}
.phone .ctl span.end{background:#e5484d}
.note{margin-top:14px;line-height:1.5;font-family:Plex;font-weight:600;font-size:20px;color:#cfc6ae;text-align:center}
`;

const html = (a, w, h, story) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head><body>
<div class="ph" style="background-image:url('${a.photo}')${a.photoBox ? `;inset:auto;left:50%;transform:translateX(-50%);top:${a.photoBox(story).top}px;height:${a.photoBox(story).height}px;width:${Math.round(a.photoBox(story).height * 2200 / 1300)}px;-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent)` : ""}"></div><div class="sh"></div>
${a.phone ? `<div class="phone"><div class="s" style="background-image:url('${a.phone}')"><span class="live"><i></i>مباشر</span><span class="pip"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="9" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/></svg><span>مستشارك</span></span><span class="ctl"><span><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></span><span><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg></span><span class="end"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14.5c4.8-4.3 12.2-4.3 17 0l-1.9 2.4-3.4-1.3v-2.2a11 11 0 0 0-7 0v2.2l-3.4 1.3z"/></svg></span></span></div></div>` : ""}
<div class="top"><div class="brand"><img src="file://${REPO}/public/logo-light.png"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
<div class="badge"><span class="a">${a.badgeAr}</span><span>·</span><span>${a.badgeEn}</span></div></div>
<div class="body">
<div class="ar">${a.ar}</div><div class="en">${a.en}</div>
<div class="pts">${a.points.map(([ar, en]) => `<div class="pt"><div class="t"><b>${ar}</b><span>${en}</span></div><div class="c">✓</div></div>`).join("")}</div>
<div class="foot"><div class="w">hadararealestate.com</div><div class="p">حضارة · شريكك العقاري في إسطنبول</div></div>
${a.note ? `<div class="note">${a.note}</div>` : ""}
</div></body></html>`;

const b = await chromium.launch();
const only = process.argv.slice(2);
for (const a of ADS.filter((x) => !only.length || only.includes(x.id))) {
  for (const [w, h, story, suffix] of [[1080, 1350, false, "feed"], [1080, 1920, true, "story"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const f = path.join(OUT, `ad-${a.id}-${suffix}.html`);
    fs.writeFileSync(f, html(a, w, h, story));
    await p.goto("file://" + f);
    await p.waitForTimeout(400);
    const over = await p.evaluate(() => {
      const b = document.querySelector(".body").getBoundingClientRect(), t = document.querySelector(".top").getBoundingClientRect();
      const ph = document.querySelector(".phone")?.getBoundingClientRect();
      return { bodyTop: Math.round(b.top), topBottom: Math.round(t.bottom), phoneBottom: ph ? Math.round(ph.bottom) : null };
    });
    await p.screenshot({ path: path.join(OUT, `ad-${a.id}-${suffix}.jpg`), type: "jpeg", quality: 90 });
    console.log(a.id, suffix, JSON.stringify(over));
    fs.unlinkSync(f);
    await p.close();
  }
}
await b.close();
