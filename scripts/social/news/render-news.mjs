// News / question post design (owner's approval 2026-11-23, "اعتمدها هيك"): the competitor's
// style in HADARA colours. A 3D hero illustration (AI, one per topic), translucent green/gold
// blocks, dot grids, the logo with the HADARA REAL ESTATE wordmark, a two-line Arabic headline
// in Thmanyah Sans (line 1 on a green band, line 2 in green with one gold word), and the site
// address at the bottom with no band behind it. Arabic only. Rendered at 2x (2160x2700) and
// saved as a 1440x1800 JPG for Instagram (it shows up to 1440 wide).
//
// usage: node scripts/social/news/render-news.mjs <spec.json> [outDir]
// spec: { "id": "citizenship-more-than-one", "hero": "heroes/<id>.jpg" (relative to this
//         folder, 4:5, about 2160x2700), "line1": "الجنسية التركية",
//         "line2": "بأكثر من {عقار}؟" }   ({…} = the gold word)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright/index.js")); }

const specPath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(specPath)) {
  console.error("usage: node scripts/social/news/render-news.mjs <spec.json> [outDir]");
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const outDir = path.resolve(process.argv[3] || path.join(here, "out"));
fs.mkdirSync(outDir, { recursive: true });
for (const k of ["id", "hero", "line1", "line2"]) if (!spec[k]) { console.error(`spec needs "${k}"`); process.exit(1); }
if (/[A-Za-z]/.test(spec.line1 + spec.line2)) { console.error("headline must be Arabic only"); process.exit(1); }

const url = (p) => "file://" + p;
const hero = path.resolve(here, spec.hero);
if (!fs.existsSync(hero)) { console.error(`hero not found: ${hero}`); process.exit(1); }
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const line2 = esc(spec.line2).replace(/\{([^}]+)\}/, "<em>$1</em>");
const th = (w, n) => `@font-face{font-family:Th;src:url(${url(path.join(root, `public/fonts/thmanyah/thmanyahsans-${n}.woff2`))});font-weight:${w}}`;
const BG = "#e2e4e8";
const css = `${th(700, "Bold")}${th(900, "Black")}
@font-face{font-family:Inter;src:url(${url(path.join(root, "scripts/social/fonts/inter-700.ttf"))});font-weight:700}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;overflow:hidden;position:relative;background:${BG};font-family:Th,sans-serif}
.hero{position:absolute;left:0;top:215px;width:1080px;height:1350px;background:url(${url(hero)}) center top/cover}
.fadeT{position:absolute;left:0;right:0;top:215px;height:220px;background:linear-gradient(${BG},rgba(226,228,232,0))}
.fadeB{position:absolute;left:0;right:0;bottom:0;height:230px;background:linear-gradient(rgba(226,228,232,0),${BG} 70%)}
.blk{position:absolute}.g{background:rgba(15,43,33,.32)}.y{background:rgba(201,162,75,.42)}
.b1{right:0;top:0;width:190px;height:58px}.b2{left:0;top:330px;width:120px;height:300px}.b3{left:120px;top:600px;width:70px;height:150px}
.b4{right:0;top:760px;width:150px;height:220px}.b5{right:150px;bottom:110px;width:120px;height:110px}.b6{left:60px;bottom:0;width:150px;height:70px}
.dots{position:absolute;background-image:radial-gradient(rgba(15,43,33,.55) 2.6px,transparent 3px);background-size:22px 22px}
.d1{right:70px;top:170px;width:132px;height:110px}.d2{left:60px;top:960px;width:110px;height:132px}
.vl{position:absolute;width:3px;background:#0f2b21;opacity:.55}.v1{right:52px;top:170px;height:190px}.v2{left:34px;top:930px;height:200px}
.logo{position:absolute;top:34px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:20px;direction:ltr}
.logo img{height:118px;filter:drop-shadow(0 2px 6px rgba(255,255,255,.8))}
.logo div{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.logo b{font-family:Inter;font-weight:700;font-size:50px;letter-spacing:.14em;color:#0f2b21;line-height:1}
.logo span{font-family:Inter;font-weight:700;font-size:20px;letter-spacing:.42em;color:#a27c26;line-height:1}
.head{position:absolute;top:206px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;direction:rtl}
.t1{background:rgba(15,43,33,.9);color:#f7f5f0;font-weight:900;font-size:98px;line-height:1.15;padding:4px 48px 20px;box-shadow:0 14px 34px rgba(15,43,33,.25);white-space:nowrap}
.t2{color:#0f2b21;font-weight:900;font-size:104px;line-height:1.15;text-shadow:0 2px 10px rgba(255,255,255,.7);white-space:nowrap}
.t2 em{font-style:normal;color:#a27c26}
.url{position:absolute;bottom:40px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:14px;direction:ltr}
.url b{font-family:Inter;font-weight:700;font-size:38px;color:#0f2b21;letter-spacing:.02em}.url svg{width:38px;height:38px}`;
const globe = '<svg viewBox="0 0 24 24" fill="none" stroke="#a27c26" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3.2 3 16.8 0 20M12 2c-3 3.2-3 16.8 0 20"/></svg>';
const html = `<html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="hero"></div><div class="fadeT"></div><div class="fadeB"></div>
<div class="blk g b1"></div><div class="blk y b2"></div><div class="blk g b3"></div><div class="blk g b4"></div><div class="blk y b5"></div><div class="blk g b6"></div>
<div class="dots d1"></div><div class="dots d2"></div><div class="vl v1"></div><div class="vl v2"></div>
<div class="logo"><img src="${url(path.join(root, "public/logo-dark.png"))}"><div><b>HADARA</b><span>REAL ESTATE</span></div></div>
<div class="head"><div class="t1">${esc(spec.line1)}</div><div class="t2">${line2}</div></div>
<div class="url">${globe}<b>hadararealestate.com</b></div></body></html>`;

const htmlPath = path.join(outDir, `${spec.id}.html`);
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
await page.goto(url(htmlPath));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const check = await page.evaluate(() => {
  const w = (s) => document.querySelector(s).getBoundingClientRect();
  const fonts = [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "Th" && f.status === "loaded").length;
  return { t1: w(".t1").width, t2: w(".t2").width, fonts };
});
const issues = [];
if (check.t1 > 1000 || check.t2 > 1000) issues.push("headline line too wide (shorten it, ~16 letters a line)");
if (!check.fonts) issues.push("Thmanyah Sans did not load");
const png = path.join(outDir, `${spec.id}-2160.png`);
await page.screenshot({ path: png });
// The Instagram copy: the same page drawn at 1440x1800, straight to JPG.
const jpg = path.join(outDir, `${spec.id}.jpg`);
const page2 = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 4 / 3 });
await page2.goto(url(htmlPath));
await page2.evaluate(() => document.fonts.ready);
await page2.waitForTimeout(300);
await page2.screenshot({ path: jpg, type: "jpeg", quality: 95 });
await browser.close();
fs.unlinkSync(htmlPath);
console.log(JSON.stringify({ png, jpg, issues }));
if (issues.length) process.exit(2);
