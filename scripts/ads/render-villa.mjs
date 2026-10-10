// Renders the Marmara Haven Villa ad images: a single-image ad (4:5 feed + 9:16 story)
// and a 1:1 carousel. Photos are the owner's own (Drive folder "Marmara Haven", 2026-10-10).
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(process.env.GLOBAL_NM + "/");
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "villa-2026-10");
const font = (f) => `file://${REPO}/scripts/social/fonts/${f}`;
const photo = (n) => `file://${OUT}/photos/${n}.jpg`;
const LOGO = `file://${REPO}/public/logo-light.png`;

const FONTS = `
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:600;src:url(${font("plex-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font("plex-700.ttf")})}
*{margin:0;box-sizing:border-box}
body{overflow:hidden;background:#0f2b21;font-family:Inter,sans-serif;color:#fff;position:relative}
.brand{display:flex;align-items:center;gap:16px}.brand img{height:74px}
.brand b{display:block;font-weight:700;font-size:34px;letter-spacing:5px;line-height:1}
.brand i{display:block;font-style:normal;font-weight:600;font-size:14px;letter-spacing:7px;color:#e4c574;margin-top:9px}
.badge{border:2px solid #c9a24b;background:rgba(15,43,33,.72);border-radius:50px;padding:12px 26px;display:flex;gap:14px;align-items:center;color:#e4c574;font-weight:700;font-size:23px}
.badge .a{font-family:Plex;font-size:27px}
`;

const brand = `<div class="brand"><img src="${LOGO}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>`;

// ---------- Single-image ad ----------
const hero = (story) => {
  const w = 1080, h = story ? 1920 : 1350;
  // Enlarge the dusk photo so the villa sits in the upper half, above the text.
  const box = story ? { top: -260, height: 2040 } : { top: -300, height: 1720 };
  return { w, h, html: `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
body{width:${w}px;height:${h}px}
.ph{position:absolute;left:50%;transform:translateX(-50%);top:${box.top}px;height:${box.height}px;width:${Math.round(box.height * 3 / 4)}px;background:url('${photo("dusk-pool")}') center/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.6) 0%,rgba(8,26,20,.05) ${story ? 20 : 18}%,rgba(8,26,20,.1) ${story ? 42 : 36}%,rgba(8,26,20,.88) ${story ? 60 : 56}%,rgba(8,26,20,.97) 100%)}
.top{position:absolute;left:60px;right:60px;top:${story ? 230 : 56}px;display:flex;justify-content:space-between;align-items:center}
.body{position:absolute;left:60px;right:60px;bottom:${story ? 300 : 64}px}
.ar{font-family:Plex;font-weight:700;font-size:${story ? 74 : 66}px;line-height:1.25;text-align:right;direction:rtl;text-shadow:0 3px 14px rgba(0,0,0,.55)}
.en{font-weight:700;font-size:${story ? 34 : 31}px;line-height:1.25;margin-top:12px;color:#efe6cf;direction:ltr}
.price{margin-top:26px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 28px;border-radius:22px;background:rgba(201,162,75,.16);border:2px solid #c9a24b}
.price .p-ar{font-family:Plex;font-weight:700;font-size:${story ? 46 : 42}px;color:#f3d98e;direction:rtl}
.price .p-en{font-weight:700;font-size:${story ? 30 : 27}px;color:#efe6cf;direction:ltr}
.pts{margin-top:26px;display:grid;gap:20px}
.pt{display:grid;grid-template-columns:1fr 50px;gap:16px;align-items:start;direction:ltr}
.pt .c{width:50px;height:50px;border-radius:50%;background:#c9a24b;color:#0f2b21;display:grid;place-items:center;font-size:28px;font-weight:700}
.pt .t{text-align:right}
.pt .t b{display:block;font-family:Plex;font-weight:700;font-size:${story ? 42 : 38}px;line-height:1.3;direction:rtl}
.pt .t span{display:block;font-weight:600;font-size:${story ? 27 : 25}px;color:#d9cfb6;direction:ltr;margin-top:2px}
.foot{margin-top:26px;padding-top:20px;border-top:2px solid rgba(201,162,75,.6);display:flex;justify-content:space-between;align-items:center;gap:20px}
.foot .w{font-weight:700;font-size:26px;color:#e4c574;direction:ltr}
.foot .p{font-family:Plex;font-weight:700;font-size:28px;direction:rtl}
.note{margin-top:12px;font-family:Plex;font-weight:600;font-size:21px;color:#cfc6ae;text-align:center;direction:rtl}
</style></head><body>
<div class="ph"></div><div class="sh"></div>
<div class="top">${brand}<div class="badge"><span class="a">فيلا للبيع</span><span>·</span><span>Villa for Sale</span></div></div>
<div class="body">
<div class="ar">فيلا بإطلالة بحرية<br>جاهزة للسكن في إسطنبول</div>
<div class="en">A sea-view villa, ready to move in, Istanbul</div>
<div class="price"><span class="p-en">From US$1.55M</span><span class="p-ar">السعر من 1.55 مليون دولار</span></div>
<div class="pts">
<div class="pt"><div class="t"><b>5 غرف نوم و7 حمّامات ومسبح خاص</b><span>5 bedrooms, 7 bathrooms and a private pool</span></div><div class="c">✓</div></div>
<div class="pt"><div class="t"><b>مؤهّلة للحصول على الجنسية التركية</b><span>Eligible for Turkish citizenship</span></div><div class="c">✓</div></div>
</div>
<div class="foot"><div class="w">hadararealestate.com</div><div class="p">حضارة · شريكك العقاري في إسطنبول</div></div>
<div class="note">فيلا مرمرة هيفن · بيوكجكمجة، إسطنبول · السعر حسب طريقة الدفع</div>
</div></body></html>` };
};

// ---------- Carousel (1:1) ----------
const CARDS = [
  { id: 1, photo: "dusk-pool", pos: "center 62%", ar: "فيلا مرمرة هيفن", en: "Marmara Haven Villa", cover: true },
  { id: 2, photo: "drone", pos: "center 40%", ar: "576 م² على 4 طوابق، وأرض 637 م²", en: "576 m² on 4 floors, on a 637 m² plot" },
  { id: 3, photo: "sunset", pos: "center 45%", ar: "إطلالة مفتوحة على بحر مرمرة", en: "Open views over the Sea of Marmara" },
  { id: 4, photo: "living-sea", pos: "center 60%", ar: "صالون واسع بواجهات زجاجية على التراس", en: "A bright living room opening onto the terrace" },
  { id: 5, photo: "kitchen", pos: "center 55%", ar: "مطبخ مجهّز بجزيرة وسطية", en: "Fitted kitchen with a central island" },
  { id: 6, photo: "bedroom-sea", pos: "center 55%", ar: "غرف نوم تطلّ على البحر", en: "Bedrooms with sea views" },
  { id: 7, photo: "roof-terrace-2", pos: "center 60%", ar: "تراس واسع على السطح", en: "A large rooftop terrace" },
  { id: 8, photo: "balcony-pool", pos: "center 60%", ar: "مسبح خاص وحديقة", en: "Private pool and garden" },
  { id: 9, photo: "hall", pos: "center 50%", ar: "منزل ذكي ومصعد وتدفئة أرضية", en: "Smart home, lift and underfloor heating" },
];

const card = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
body{width:1080px;height:1080px}
.ph{position:absolute;inset:0;background:url('${photo(c.photo)}') ${c.pos}/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,26,20,.45) 0%,rgba(8,26,20,0) 18%,rgba(8,26,20,0) ${c.cover ? 46 : 58}%,rgba(8,26,20,.92) 100%)}
.top{position:absolute;left:48px;right:48px;top:44px;display:flex;justify-content:space-between;align-items:center}
.top .brand img{height:62px}.top .brand b{font-size:29px}.top .brand i{font-size:12px}
.n{font-weight:700;font-size:24px;color:#e4c574;background:rgba(15,43,33,.72);border:2px solid #c9a24b;border-radius:40px;padding:8px 20px;direction:ltr}
.cap{position:absolute;left:56px;right:56px;bottom:52px;text-align:right}
.cap b{display:block;font-family:Plex;font-weight:700;font-size:${c.cover ? 74 : 54}px;line-height:1.3;direction:rtl;text-shadow:0 3px 14px rgba(0,0,0,.55)}
.cap span{display:block;font-weight:700;font-size:${c.cover ? 34 : 30}px;color:#efe6cf;direction:ltr;margin-top:8px}
.price{display:inline-flex;gap:18px;align-items:center;margin-top:22px;padding:14px 26px;border-radius:20px;background:rgba(201,162,75,.18);border:2px solid #c9a24b}
.price .p-ar{font-family:Plex;font-weight:700;font-size:40px;color:#f3d98e;direction:rtl}
.price .p-en{font-weight:700;font-size:26px;color:#efe6cf;direction:ltr}
</style></head><body>
<div class="ph"></div><div class="sh"></div>
<div class="top">${brand}<span class="n">${c.id} / 10</span></div>
<div class="cap"><b>${c.ar}</b><span>${c.en}</span>
${c.cover ? `<div class="price"><span class="p-en">From US$1.55M</span><span class="p-ar">السعر من 1.55 مليون دولار</span></div>` : ""}
</div></body></html>`;

const FACTS = [
  ["637 m²", "مساحة الأرض", "Plot"],
  ["576 m²", "المساحة الإجمالية", "Built area"],
  ["5", "غرف نوم", "Bedrooms"],
  ["7", "حمّامات", "Bathrooms"],
  ["4", "طوابق ومصعد", "Floors + lift"],
  ["2026", "سنة الانتهاء", "Completed"],
];

const last = () => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
body{width:1080px;height:1080px;background:radial-gradient(circle at 80% 0%,#1d4a3a 0%,#0f2b21 55%,#0a1f17 100%)}
.top{position:absolute;left:56px;right:56px;top:48px;display:flex;justify-content:space-between;align-items:center}
.n{font-weight:700;font-size:24px;color:#e4c574;border:2px solid #c9a24b;border-radius:40px;padding:8px 20px;direction:ltr}
.t{position:absolute;left:56px;right:56px;top:180px;text-align:right}
.t b{display:block;font-family:Plex;font-weight:700;font-size:72px;line-height:1.2;direction:rtl}
.t span{display:block;font-weight:700;font-size:32px;color:#efe6cf;direction:ltr;margin-top:8px}
.g{position:absolute;left:56px;right:56px;top:420px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:rtl}
.f{border:2px solid rgba(201,162,75,.55);border-radius:20px;padding:18px 16px;text-align:center;background:rgba(255,255,255,.04)}
.f b{display:block;font-weight:700;font-size:42px;color:#f3d98e;direction:ltr}
.f i{display:block;font-style:normal;font-family:Plex;font-weight:700;font-size:25px;margin-top:4px}
.f em{display:block;font-style:normal;font-weight:600;font-size:19px;color:#d9cfb6}
.price{position:absolute;left:56px;right:56px;top:790px;display:flex;justify-content:space-between;align-items:center;padding:18px 28px;border-radius:22px;background:rgba(201,162,75,.16);border:2px solid #c9a24b}
.price .p-ar{font-family:Plex;font-weight:700;font-size:40px;color:#f3d98e;direction:rtl}
.price .p-en{font-weight:700;font-size:26px;color:#efe6cf;direction:ltr}
.foot{position:absolute;left:56px;right:56px;bottom:46px;display:flex;justify-content:space-between;align-items:center}
.foot .w{font-weight:700;font-size:26px;color:#e4c574;direction:ltr}
.foot .p{font-family:Plex;font-weight:700;font-size:27px;direction:rtl}
</style></head><body>
<div class="top">${brand}<span class="n">10 / 10</span></div>
<div class="t"><b>احجز زيارتك للفيلا</b><span>Book your visit to the villa</span></div>
<div class="g">${FACTS.map(([v, ar, en]) => `<div class="f"><b>${v}</b><i>${ar}</i><em>${en}</em></div>`).join("")}</div>
<div class="price"><span class="p-en">From US$1.55M</span><span class="p-ar">السعر من 1.55 مليون دولار</span></div>
<div class="foot"><div class="w">hadararealestate.com</div><div class="p">بيوكجكمجة، إسطنبول</div></div>
</body></html>`;

const b = await chromium.launch();
const shot = async (name, w, h, html) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const f = path.join(OUT, `${name}.html`);
  fs.writeFileSync(f, html);
  await p.goto("file://" + f);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 90 });
  fs.unlinkSync(f);
  await p.close();
  console.log(name);
};
for (const story of [false, true]) { const x = hero(story); await shot(`villa-${story ? "story" : "feed"}`, x.w, x.h, x.html); }
for (const c of CARDS) await shot(`card-${c.id}`, 1080, 1080, card(c));
await shot("card-10", 1080, 1080, last());
await b.close();
