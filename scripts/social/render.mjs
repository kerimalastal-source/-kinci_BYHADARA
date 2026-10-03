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
.brand b{display:block;font-weight:700;font-size:30px;letter-spacing:3px;line-height:1}.brand i{display:block;font-style:normal;font-weight:600;font-size:13px;letter-spacing:6px;color:#c9a24b;margin-top:7px}
.badge{background:#c9a24b;color:#0f2b21;border-radius:40px;padding:13px 26px;font-weight:700;font-size:23px;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center}
.badge span[dir=rtl]{font-family:Plex;font-weight:700;font-size:24px}
.cap{position:absolute;z-index:2;left:52px;top:842px;font-size:24px;font-weight:600;text-shadow:0 2px 10px rgba(0,0,0,.65);display:flex;gap:10px;align-items:center}
.cap:before{content:"";width:10px;height:10px;border-radius:50%;background:#c9a24b}
.panel{position:absolute;left:0;right:0;top:888px;bottom:0;padding:0 52px}
.ar{font-family:Plex;font-weight:700;line-height:1.35;text-align:right;direction:rtl;color:#fff}
.sep{height:2px;margin:12px 0 10px;background:linear-gradient(90deg,rgba(201,162,75,0),#c9a24b 18%,#c9a24b 82%,rgba(201,162,75,0))}
.en{font-weight:600;line-height:1.3;color:#eee6d3;letter-spacing:-.2px;direction:ltr;text-align:left;white-space:nowrap}
.rule{height:0;margin:0 0 22px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;direction:rtl}
.st{background:rgba(247,244,236,.08);border:1px solid rgba(201,162,75,.45);border-radius:18px;padding:18px 8px 16px;text-align:center}
.st .v{display:flex;align-items:center;justify-content:center;height:48px;font-weight:700;font-size:40px;color:#c9a24b;line-height:1.1;white-space:nowrap}
.st .v.t{font-family:Plex;font-size:34px}
.st .a{font-family:Plex;font-weight:600;font-size:24px;line-height:1.3;margin-top:8px;color:#fff}
.st .e{font-size:19px;font-weight:500;color:#ddd4bd;margin-top:3px;direction:ltr}
.foot{position:absolute;left:52px;right:52px;bottom:30px;padding-top:18px;border-top:1px solid rgba(201,162,75,.25);display:flex;justify-content:space-between;align-items:center;font-size:23px;font-weight:600;color:#efe8d6}
.foot .wa{display:flex;gap:10px;align-items:center}.foot svg{width:26px;height:26px;fill:#c9a24b}
.note{font-size:20px;color:#e2d9c2;text-align:center;margin-top:14px}.note span{font-family:Plex}
/* Reel (1080x1920, 9:16): the same design, taller photo; the top 120px and the bottom 330px
   stay clear of Instagram's and Facebook's buttons and caption. */
body.reel{height:1920px}
.reel .ph{height:1200px;transform-origin:50% 45%}
.reel .top{top:120px}
.reel .cap{top:1106px}
.reel .panel{top:1148px}
.reel .ar{margin-bottom:4px}
.reel .foot{bottom:330px}
.reel .note{font-size:22px;margin-top:18px}
/* Story (same 9:16 layout, still picture): the top 250px stay clear of the story bar and name. */
.story .top{top:250px}
/* Evening "tweet" (design B1, owner's choice 2026-10-03): a light card like a post on X. */
body.tweet{background:radial-gradient(120% 80% at 50% 0%,#174234 0%,#0f2b21 60%)}
.tw{position:absolute;left:70px;right:70px;top:0;display:flex;flex-direction:column;align-items:center;gap:56px}
.card{width:100%;background:#f7f4ec;color:#0f2b21;border-radius:34px;padding:50px 54px 40px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.who{display:flex;align-items:center;gap:18px;direction:ltr}.av{width:86px;height:86px;border-radius:50%;background:#0f2b21;display:flex;align-items:center;justify-content:center}.av img{height:52px}
.who b{display:block;font-size:30px;font-weight:700}.who span{font-size:23px;color:#6b7a73}
.card .ar{color:#0f2b21;line-height:1.45;margin:40px 0 24px}
.card .en{color:#3d5249;line-height:1.35;white-space:normal}
.opts{display:flex;flex-wrap:wrap;gap:14px 24px;justify-content:space-between;direction:ltr;margin-top:32px;padding-top:26px;border-top:1px solid #e2dccd}
.opts span{display:flex;gap:10px;align-items:center;font-size:24px;color:#4f6159;font-weight:600}.opts span b{font-family:Plex;font-weight:600}
.opts i{font-style:normal;color:#c9a24b;font-size:28px}
.ask{display:inline-flex;gap:12px;align-items:center;border:1.5px solid rgba(201,162,75,.7);border-radius:40px;padding:12px 26px;font-size:22px;font-weight:500;color:#efe8d6;white-space:nowrap}.ask span[dir=rtl]{font-family:Plex;font-weight:600;font-size:24px}
/* Evening "this or that" (design B2): two photos side by side, "أم" in the middle. */
.half{position:absolute;top:0;height:860px;width:540px;background-size:cover;background-position:center}
.half.l{left:0}.half.r{right:0}.half:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,33,.75) 0%,rgba(15,43,33,0) 22%,rgba(15,43,33,0) 65%,rgba(15,43,33,.95) 100%)}
.split{position:absolute;left:537px;top:0;height:860px;width:6px;background:#0f2b21;z-index:2}
.vs{position:absolute;left:470px;top:390px;width:140px;height:140px;border-radius:50%;background:#c9a24b;color:#0f2b21;z-index:3;display:flex;align-items:center;justify-content:center;font-family:Plex;font-weight:700;font-size:44px;box-shadow:0 8px 30px rgba(0,0,0,.4);border:6px solid #0f2b21}
.lab{position:absolute;top:690px;z-index:3;width:540px;text-align:center;padding:0 24px}.lab .la{font-family:Plex;font-weight:700;font-size:44px;line-height:1.2;white-space:nowrap}.lab .le{font-size:24px;color:#eee6d3;font-weight:600;margin-top:4px;white-space:nowrap}
.lab .k{display:inline-block;width:54px;height:54px;line-height:54px;border-radius:50%;background:#c9a24b;color:#0f2b21;font-weight:700;font-size:28px;margin-bottom:10px}
.cq{position:absolute;left:52px;right:52px;top:935px;text-align:center}
.cq .ar,.cq .en{text-align:center;white-space:nowrap}.cq .en{margin-top:8px}.cq .ask{margin-top:40px}`;

const WA_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileUrl = (p) => "file://" + path.resolve(root, p.replace(/^\//, ""));

// The two evening designs (owner's choice 2026-10-03): "tweet" (main) and "choice" (1-2 a week).
const ASK = { ar: "شاركونا رأيكم في التعليقات", en: "Tell us in the comments" };
const topBar = (im) => `<div class="top"><div class="brand" dir="ltr"><img src="${fileUrl("public/logo-light.png")}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
${im.badge ? `<div class="badge"><span dir="rtl">${esc(im.badge.ar)}</span><span>·</span><span>${esc(im.badge.en)}</span></div>` : ""}</div>`;
const footer = () => `<div class="foot" dir="ltr"><span>www.hadararealestate.com</span><span class="wa">${WA_ICON}${PHONE}</span></div>`;
const askPill = (a) => `<div class="ask"><span dir="rtl">${esc((a || ASK).ar)}</span><span>·</span><span>${esc((a || ASK).en)}</span></div>`;

function tweetHtml(im) {
  const opts = (im.options || []).map((o) => `<span>${o.icon ? `<i>${esc(o.icon)}</i>` : ""}${esc(o.en)} · <b dir="rtl">${esc(o.ar)}</b></span>`).join("");
  return `<div class="tw"><div class="card"><div class="who"><div class="av"><img src="${fileUrl("public/logo-light.png")}"></div><div><b>HADARA Real Estate</b><span>@hadararealestate</span></div></div>
<div class="ar" style="font-size:${im.arSize || 58}px">${esc(im.headlineAr)}</div><div class="en" style="font-size:${im.enSize || 34}px">${esc(im.headlineEn)}</div>
${opts ? `<div class="opts">${opts}</div>` : ""}</div>${askPill(im.ask)}</div>`;
}

function choiceHtml(im) {
  const side = (o, cls, key) => `<div class="half ${cls}" style="background-image:url('${fileUrl(publicPath(o.photo))}');background-position:${o.position || "center"}"></div>
<div class="lab" style="${cls === "l" ? "left" : "right"}:0"><div class="k">${key}</div><div class="la" dir="rtl">${esc(o.ar)}</div><div class="le">${esc(o.en)}</div></div>`;
  return `${side(im.a, "l", "A")}${side(im.b, "r", "B")}<div class="split"></div><div class="vs">أم</div>
<div class="cq"><div class="ar" style="font-size:${im.arSize || 50}px">${esc(im.headlineAr)}</div><div class="en" style="font-size:${im.enSize || 30}px">${esc(im.headlineEn)}</div>${askPill(im.ask)}</div>`;
}

const publicPath = (photo) => (photo.startsWith("/images/") || photo.startsWith("/hero") ? "public" + photo : photo);

function imageHtml(p) {
  if (p.image.design === "tweet" || p.image.design === "choice") {
    const im = p.image;
    return `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body class="${im.design}">
${topBar(im)}${im.design === "tweet" ? tweetHtml(im) : choiceHtml(im)}${footer()}</body></html>`;
  }
  const im = p.image;
  const photo = im.photo.startsWith("/images/") || im.photo.startsWith("/hero") ? "public" + im.photo : im.photo;
  const items = (im.stats || []).map((s) => {
    const textual = !/^[\d$€+.,\s–\-m²KkMm·:/]+$/.test(s.value);
    return `<div class="st"><div class="v${textual ? " t" : ""}" dir="${textual ? "rtl" : "ltr"}">${esc(s.value)}</div><div class="a">${esc(s.ar)}</div><div class="e">${esc(s.en)}</div></div>`;
  }).join("");
  return `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body${p.story ? ' class="reel story"' : p.reel ? ' class="reel"' : ""}>
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
  const H = p.reel || p.story ? 1920 : 1350;
  const page = await browser.newPage({ viewport: { width: 1080, height: H } });
  const htmlPath = path.join(outDir, `post-${n}.html`);
  fs.writeFileSync(htmlPath, imageHtml(p));
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const design = p.image.design || "A";
  if (design === "tweet") {
    // Centre the card + pill between the top bar and the footer; a long text shrinks
    // (at most 3 Arabic lines) until everything fits.
    await page.evaluate(() => {
      const tw = document.querySelector(".tw"), ar = document.querySelector(".card .ar"), en = document.querySelector(".card .en");
      const fit = () => {
        const lines = Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * 1.45));
        return lines <= 3 && tw.getBoundingClientRect().height <= 1060;
      };
      for (let n = 0; n < 30 && !fit(); n++) {
        ar.style.fontSize = `${parseFloat(getComputedStyle(ar).fontSize) - 2}px`;
        en.style.fontSize = `${Math.max(26, parseFloat(getComputedStyle(en).fontSize) - 1)}px`;
      }
      tw.style.top = `${Math.round(150 + (1110 - tw.getBoundingClientRect().height) / 2)}px`;
    });
  } else if (design === "choice") {
    // The question and the two labels stay on one line each: shrink them until they fit.
    await page.evaluate(() => {
      for (const e of document.querySelectorAll(".cq .ar,.cq .en,.lab .la,.lab .le")) {
        let size = parseFloat(getComputedStyle(e).fontSize);
        while (e.scrollWidth > e.clientWidth + 1 && size > 22) e.style.fontSize = `${(size -= 1)}px`;
      }
    });
  }
  // A long stat value (e.g. "117–143 m²") shrinks until it fits its tile with room to spare.
  if (design === "A") await page.evaluate(() => {
    const range = document.createRange();
    for (const v of document.querySelectorAll(".st .v")) {
      range.selectNodeContents(v);
      let size = parseFloat(getComputedStyle(v).fontSize);
      while (range.getBoundingClientRect().width > v.clientWidth - 16 && size > 24) v.style.fontSize = `${(size -= 1)}px`;
    }
  });
  const check = design !== "A" ? await page.evaluate((design) => {
    const sel = design === "tweet" ? ".card .en,.opts span,.ask" : ".cq .ar,.cq .en,.lab .la,.lab .le,.ask";
    const over = [...document.querySelectorAll(sel)].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    const box = document.querySelector(design === "tweet" ? ".tw" : ".cq").getBoundingClientRect();
    const top = document.querySelector(".top").getBoundingClientRect().bottom;
    const foot = document.querySelector(".foot").getBoundingClientRect().top;
    const ar = document.querySelector(design === "tweet" ? ".card .ar" : ".cq .ar");
    const arLines = Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * (design === "tweet" ? 1.45 : 1.35)));
    return { over, clash: box.top < top + 8 || box.bottom > foot - 8, arLines, maxLines: design === "tweet" ? 3 : 1, fonts: [...document.fonts].filter((f) => f.status === "loaded").length };
  }, design) : await page.evaluate(() => {
    const over = [...document.querySelectorAll(".st .v,.st .a,.st .e,.ar,.en,.note")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    const panel = document.querySelector(".panel").lastElementChild.getBoundingClientRect().bottom;
    const foot = document.querySelector(".foot").getBoundingClientRect().top;
    const arLines = Math.round(document.querySelector(".ar").getBoundingClientRect().height / (parseFloat(getComputedStyle(document.querySelector(".ar")).fontSize) * 1.3));
    const photoOk = getComputedStyle(document.querySelector(".ph")).backgroundImage !== "none";
    return { over, clash: panel > foot - 8, arLines, fonts: [...document.fonts].filter((f) => f.status === "loaded").length };
  });
  const photos = design === "tweet" ? [] : design === "choice" ? [p.image.a?.photo, p.image.b?.photo] : [p.image.photo];
  const issues = [];
  for (const ph of photos) {
    const photoFile = ph ? path.resolve(root, publicPath(ph)) : "";
    if (!ph || !fs.existsSync(photoFile)) issues.push("photo not found: " + (photoFile || "(missing a/b photo)"));
  }
  if (check.over.length) issues.push("text overflows: " + check.over.join(" | "));
  if (check.clash) issues.push(design === "A" ? "panel overlaps footer (shorten text or lower arSize)" : "text block overlaps the top bar or the footer (shorten the text)");
  if (design === "A" && check.over.some((t) => t === p.image.headlineEn)) issues.push("English headline too long for one line (shorten it or set enSize, e.g. 38-42)");
  if (check.arLines > (check.maxLines || 1)) issues.push(`Arabic text wraps to ${check.arLines} lines (max ${check.maxLines || 1}: shorten it or lower arSize)`);
  if (design !== "A" && (p.story || p.reel)) issues.push(`design "${design}" is for feed posts only (no story/reel)`);
  if (check.fonts < 4) issues.push("fonts did not load");
  await page.screenshot({ path: path.join(outDir, `post-${n}.jpg`), type: "jpeg", quality: 90 });
  let video = null;
  if (p.reel) {
    // The Reel: 8 seconds at 30 fps, the photo slowly zooming in (1.00 -> 1.08) under the
    // fixed text, with a silent audio track (Instagram expects one), H.264 + AAC, 9:16.
    const frames = fs.mkdtempSync(path.join(outDir, ".frames-"));
    const FPS = 30, SECONDS = 8, total = FPS * SECONDS;
    for (let f = 0; f < total; f++) {
      const t = f / (total - 1);
      const scale = 1 + 0.08 * (t * t * (3 - 2 * t));
      await page.evaluate((s) => { document.querySelector(".ph").style.transform = `scale(${s})`; }, scale);
      await page.screenshot({ path: path.join(frames, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    }
    video = `post-${n}.mp4`;
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.env.FFMPEG || "ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"),
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest",
      "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS), "-b:v", "6M",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path.join(outDir, video)
    ]);
    fs.rmSync(frames, { recursive: true, force: true });
  }
  await page.close();
  fs.unlinkSync(htmlPath);
  if (p.at !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.at)) issues.push(`"at" must be Istanbul time "HH:MM", got ${JSON.stringify(p.at)}`);
  const result = { id: p.id, topic: p.topic, image: `post-${n}.jpg`, fb: p.caption ? caption(p, "facebook") : "", ig: p.caption ? caption(p, "instagram") : "", ...(p.at ? { at: p.at } : {}), ...(video ? { video } : {}), ...(p.story ? { story: true } : {}) };
  fs.writeFileSync(path.join(outDir, `post-${n}.json`), JSON.stringify(result, null, 2));
  console.log(`post-${n} (${p.id}): ${issues.length ? "PROBLEMS\n  - " + issues.join("\n  - ") : "ok"}`);
  problems += issues.length;
}
await browser.close();
process.exit(problems ? 2 : 0);
