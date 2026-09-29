// Renders the daily social posts (1080x1350 images + Facebook/Instagram captions)
// from a posts.json written by the daily routine. See scripts/social/README.md.
//
//   node scripts/social/render.mjs scripts/social/out/2026-09-30/posts.json
//
// Writes post-<n>.jpg and post-<n>.json ({ id, topic, image, fb, ig }) next to posts.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const SITE = "https://www.hadararealestate.com";
const WHATSAPP = "https://wa.me/905319309214";
const PHONE = "+90 531 930 92 14";
const LRM = "‎";

const specPath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(specPath)) {
  console.error("usage: node scripts/social/render.mjs <posts.json>");
  process.exit(1);
}
const outDir = path.dirname(specPath);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const posts = Array.isArray(spec) ? spec : spec.posts;

// ---------- captions ----------

const url = (lang, p, id, source) =>
  `${SITE}${lang === "ar" ? "/ar" : ""}${p === "/" && lang === "ar" ? "" : p}?utm_source=${source}&utm_campaign=post-${id}`;

function block(c, lang, id, platform) {
  const ltr = lang === "en";
  const mark = (s) => (ltr ? LRM + s : s);
  const paras = [];
  paras.push(mark(c.title));
  if (c.intro) paras.push(mark(c.intro));
  if (c.bullets?.length) paras.push(c.bullets.map(mark).join("\n"));
  for (const line of c.closing || []) paras.push(mark(line));
  if (platform === "facebook") {
    if (c.cta && c.path) paras.push(`${mark(c.cta + " 👇")}\n${url(lang, c.path, id, "facebook")}`);
    paras.push(`${mark(ltr ? "Chat with us on WhatsApp 👇" : "راسلنا على واتساب 👇")}\n${WHATSAPP}`);
  } else {
    if (c.cta && c.path) paras.push(mark(ltr ? `🔗 ${c.cta}: link in bio` : `🔗 ${c.cta}: الرابط في البايو`));
    paras.push(ltr ? `${LRM}WhatsApp: ${PHONE}` : `واتساب: ⁦${PHONE}⁩`);
  }
  return paras.join("\n\n");
}

const BASE_TAGS = ["#HADARA", "#Istanbul", "#IstanbulRealEstate", "#عقارات_اسطنبول", "#عقارات_تركيا"];
function caption(p, platform) {
  const tags = [...new Set([...(p.caption.hashtags || []), ...(platform === "instagram" ? BASE_TAGS : BASE_TAGS.slice(0, 2))])];
  // Arabic first, then a clear divider, then English: two complete, separate parts.
  const divider = `${LRM}━━━━━━━━  English  ━━━━━━━━`;
  return [block(p.caption.ar, "ar", p.id, platform), divider, block(p.caption.en, "en", p.id, platform), tags.join(" ")].join("\n\n") + "\n";
}

// ---------- image ----------

const fontUrl = (f) => "file://" + path.join(here, "fonts", f);
const fonts = `
@font-face{font-family:Inter;font-weight:500;src:url(${fontUrl("inter-500.ttf")})}
@font-face{font-family:Inter;font-weight:600;src:url(${fontUrl("inter-600.ttf")})}
@font-face{font-family:Inter;font-weight:700;src:url(${fontUrl("inter-700.ttf")})}
@font-face{font-family:Plex;font-weight:400;src:url(${fontUrl("plex-400.ttf")})}
@font-face{font-family:Plex;font-weight:500;src:url(${fontUrl("plex-500.ttf")})}
@font-face{font-family:Plex;font-weight:600;src:url(${fontUrl("plex-600.ttf")})}
@font-face{font-family:Plex;font-weight:700;src:url(${fontUrl("plex-700.ttf")})}`;

const css = `*{margin:0;box-sizing:border-box} body{font-family:Inter,sans-serif;width:1080px;height:1350px;overflow:hidden;background:#0f2b21;color:#f7f4ec}
.ph{position:absolute;left:0;right:0;top:0;height:940px;background-size:cover;background-position:center}
.ph:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,33,.7) 0%,rgba(15,43,33,.25) 12%,rgba(15,43,33,0) 24%,rgba(15,43,33,0) 70%,rgba(15,43,33,.95) 100%)}
.top{position:absolute;top:44px;left:52px;right:52px;display:flex;justify-content:space-between;align-items:center;z-index:2}
.brand{display:flex;align-items:center;gap:16px}.brand img{height:62px}
.brand b{display:block;font-weight:700;font-size:30px;letter-spacing:3px;line-height:1}.brand i{display:block;font-style:normal;font-weight:600;font-size:12px;letter-spacing:6px;color:#c9a24b;margin-top:7px}
.badge{background:#c9a24b;color:#0f2b21;border-radius:40px;padding:12px 24px;font-weight:700;font-size:21px;display:flex;gap:10px;align-items:center}
.badge span[dir=rtl]{font-family:Plex;font-weight:700;font-size:22px}
.cap{position:absolute;z-index:2;left:52px;top:846px;font-size:20px;font-weight:500;opacity:.9;display:flex;gap:10px;align-items:center}
.cap:before{content:"";width:10px;height:10px;border-radius:50%;background:#c9a24b}
.panel{position:absolute;left:0;right:0;top:888px;bottom:0;padding:0 52px}
.ar{font-family:Plex;font-weight:700;line-height:1.3;text-align:right;direction:rtl}
.sep{height:2px;margin:12px 0 10px;background:linear-gradient(90deg,rgba(201,162,75,0),#c9a24b 18%,#c9a24b 82%,rgba(201,162,75,0))}
.en{font-weight:700;line-height:1.3;color:#f7f4ec;direction:ltr;text-align:left;white-space:nowrap}
.rule{height:0;margin:0 0 22px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;direction:rtl}
.st{background:rgba(247,244,236,.07);border:1px solid rgba(201,162,75,.35);border-radius:16px;padding:16px 10px 14px;text-align:center}
.st .v{font-weight:700;font-size:34px;color:#c9a24b;line-height:1.1;white-space:nowrap}
.st .v.t{font-family:Plex;font-size:30px}
.st .a{font-family:Plex;font-weight:600;font-size:20px;margin-top:8px}
.st .e{font-size:18px;font-weight:600;color:#f7f4ec;opacity:.9;margin-top:4px;direction:ltr}
.foot{position:absolute;left:52px;right:52px;bottom:30px;padding-top:18px;border-top:1px solid rgba(201,162,75,.25);display:flex;justify-content:space-between;align-items:center;font-size:21px;font-weight:600;color:#e8e1cf}
.foot .wa{display:flex;gap:10px;align-items:center}.foot svg{width:26px;height:26px;fill:#c9a24b}
.note{font-size:16px;color:#cfc6ad;text-align:center;margin-top:12px}.note span{font-family:Plex}`;

const WA_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileUrl = (p) => "file://" + path.resolve(root, p.replace(/^\//, ""));

function imageHtml(p) {
  const im = p.image;
  const photo = im.photo.startsWith("/images/") || im.photo.startsWith("/hero") ? "public" + im.photo : im.photo;
  const items = (im.stats || []).map((s) => {
    const textual = !/^[\d$€+.,\s–\-m²KkMm]+$/.test(s.value);
    return `<div class="st"><div class="v${textual ? " t" : ""}" dir="${textual ? "rtl" : "ltr"}">${esc(s.value)}</div><div class="a">${esc(s.ar)}</div><div class="e">${esc(s.en)}</div></div>`;
  }).join("");
  return `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body>
<div class="ph" style="background-image:url('${fileUrl(photo)}');background-position:${im.position || "center"};background-size:${im.size || "cover"}"></div>
<div class="top"><div class="brand" dir="ltr"><img src="${fileUrl("public/logo-light.png")}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
${im.badge ? `<div class="badge"><span dir="rtl">${esc(im.badge.ar)}</span><span>·</span><span>${esc(im.badge.en)}</span></div>` : ""}</div>
${im.place ? `<div class="cap">${esc(im.place)}</div>` : ""}
<div class="panel"><div class="ar" style="font-size:${im.arSize || 52}px">${esc(im.headlineAr)}</div><div class="sep"></div><div class="en" style="font-size:${im.enSize || Math.round((im.arSize || 52) * 0.8)}px">${esc(im.headlineEn)}</div><div class="rule"></div>
<div class="stats" style="grid-template-columns:repeat(${(im.stats || []).length || 4},1fr)">${items}</div>
${im.note ? `<div class="note"><span dir="rtl">${esc(im.note.ar)}</span> · ${esc(im.note.en)}</div>` : ""}</div>
<div class="foot" dir="ltr"><span>www.hadararealestate.com</span><span class="wa">${WA_ICON}${PHONE}</span></div></body></html>`;
}

const pw = await import(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").catch(() => import("playwright"));
const browser = await pw.chromium.launch();
let problems = 0;
for (const [i, p] of posts.entries()) {
  const n = i + 1;
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const htmlPath = path.join(outDir, `post-${n}.html`);
  fs.writeFileSync(htmlPath, imageHtml(p));
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const check = await page.evaluate(() => {
    const over = [...document.querySelectorAll(".st .v,.st .a,.st .e,.ar,.en,.note")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    const panel = document.querySelector(".panel").lastElementChild.getBoundingClientRect().bottom;
    const foot = document.querySelector(".foot").getBoundingClientRect().top;
    const arLines = Math.round(document.querySelector(".ar").getBoundingClientRect().height / (parseFloat(getComputedStyle(document.querySelector(".ar")).fontSize) * 1.3));
    const photoOk = getComputedStyle(document.querySelector(".ph")).backgroundImage !== "none";
    return { over, clash: panel > foot - 8, arLines, fonts: [...document.fonts].filter((f) => f.status === "loaded").length };
  });
  const photoFile = path.resolve(root, (p.image.photo.startsWith("/") ? "public" + p.image.photo : p.image.photo));
  const issues = [];
  if (!fs.existsSync(photoFile)) issues.push("photo not found: " + photoFile);
  if (check.over.length) issues.push("text overflows: " + check.over.join(" | "));
  if (check.clash) issues.push("panel overlaps footer (shorten text or lower arSize)");
  if (check.over.some((t) => t === p.image.headlineEn)) issues.push("English headline too long for one line (shorten it or set enSize, e.g. 38-42)");
  if (check.arLines > 1) issues.push(`Arabic headline wraps to ${check.arLines} lines (lower arSize, e.g. 44-48, or shorten it)`);
  if (check.fonts < 4) issues.push("fonts did not load");
  await page.screenshot({ path: path.join(outDir, `post-${n}.jpg`), type: "jpeg", quality: 90 });
  await page.close();
  fs.unlinkSync(htmlPath);
  if (p.at !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.at)) issues.push(`"at" must be Istanbul time "HH:MM", got ${JSON.stringify(p.at)}`);
  const result = { id: p.id, topic: p.topic, image: `post-${n}.jpg`, fb: caption(p, "facebook"), ig: caption(p, "instagram"), ...(p.at ? { at: p.at } : {}) };
  fs.writeFileSync(path.join(outDir, `post-${n}.json`), JSON.stringify(result, null, 2));
  console.log(`post-${n} (${p.id}): ${issues.length ? "PROBLEMS\n  - " + issues.join("\n  - ") : "ok"}`);
  problems += issues.length;
}
await browser.close();
process.exit(problems ? 2 : 0);
