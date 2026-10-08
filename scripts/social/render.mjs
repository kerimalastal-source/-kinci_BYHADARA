// Renders the daily social posts (1080x1350 images + Facebook/Instagram captions)
// from a posts.json written by the daily routine. See scripts/social/README.md.
//
//   node scripts/social/render.mjs scripts/social/out/2026-09-30/posts.json
//
// Writes post-<n>.jpg and post-<n>.json ({ id, topic, image, fb, ig }) next to posts.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);

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
.ph{position:absolute;left:0;right:0;top:0;height:780px;background-size:cover;background-position:center}
.ph:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,33,.75) 0%,rgba(15,43,33,0) 22%,rgba(15,43,33,0) 55%,#0f2b21 100%)}
.frame{position:absolute;inset:22px;border:1.5px solid rgba(201,162,75,.55);border-radius:6px;z-index:5;pointer-events:none}
.top{position:absolute;top:52px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;z-index:6}
.brand{display:flex;align-items:center;gap:14px}.brand img{height:58px}
.brand b{display:block;font-weight:700;font-size:28px;letter-spacing:4px;line-height:1}.brand i{display:block;font-style:normal;font-weight:600;font-size:12px;letter-spacing:6px;color:#c9a24b;margin-top:6px}
.badge{border:1.5px solid #c9a24b;color:#c9a24b;background:rgba(15,43,33,.6);border-radius:40px;padding:11px 24px;font-weight:700;font-size:21px;display:flex;gap:12px;align-items:center}
.badge span[dir=rtl]{font-family:Plex;font-weight:700;font-size:23px}
.panel{position:absolute;left:60px;right:60px;bottom:116px;z-index:6}
.eyebrow{text-shadow:0 2px 10px rgba(0,0,0,.6);display:flex;justify-content:space-between;align-items:center;color:#c9a24b;font-weight:700;font-size:24px;margin-bottom:14px;direction:ltr}.eyebrow .a{font-family:Plex;font-weight:700;font-size:26px}
.ar{font-family:Plex;font-weight:700;line-height:1.28;text-align:right;direction:rtl;color:#fff}
.en{font-weight:700;line-height:1.2;color:#fff;letter-spacing:-.2px;direction:ltr;text-align:left;white-space:nowrap;margin-top:10px}
.rule{height:3px;width:140px;background:#c9a24b;margin:22px 0 22px auto}
.facts{display:grid;gap:16px;direction:rtl}
.fa{border-top:3px solid #c9a24b;background:rgba(255,255,255,.05);padding:20px 10px 18px;text-align:center}
.fa .v{direction:ltr;font-size:58px;font-weight:700;color:#c9a24b;line-height:1;white-space:nowrap}.fa .v.t{font-family:Plex;font-size:46px;direction:rtl}
.fa .a{font-family:Plex;font-weight:700;font-size:29px;margin-top:12px;color:#fff}.fa .e{font-size:22px;color:#efe6cf;margin-top:4px;font-weight:600;direction:ltr}
.tip{margin-top:22px;display:flex;gap:18px;align-items:flex-start;background:rgba(201,162,75,.12);border-right:6px solid #c9a24b;padding:16px 22px;direction:rtl}
.tip .k{font-family:Plex;font-weight:700;color:#c9a24b;font-size:26px;white-space:nowrap}
.tip .t{font-family:Plex;font-weight:700;font-size:27px;line-height:1.4;color:#fff}.tip .te{font-size:21px;font-weight:600;color:#efe6cf;direction:ltr;text-align:left;margin-top:4px}
.list{direction:rtl}.it{display:flex;gap:24px;align-items:flex-start;padding:24px 0;border-bottom:1px solid rgba(201,162,75,.22)}.it:last-child{border-bottom:0}
.it .n{font-size:64px;font-weight:700;color:#c9a24b;line-height:.95;min-width:64px;text-align:center}
.it .a{font-family:Plex;font-weight:700;font-size:40px;line-height:1.3;color:#fff}.it .e{font-size:24px;color:#efe6cf;direction:ltr;text-align:left;margin-top:6px;font-weight:600}
.foot{position:absolute;left:60px;right:60px;bottom:48px;padding-top:18px;border-top:1px solid rgba(201,162,75,.3);display:flex;justify-content:space-between;align-items:center;font-size:24px;font-weight:600;color:#efe8d6;z-index:6}
.foot .wa{display:flex;gap:10px;align-items:center}.foot svg{width:26px;height:26px;fill:#c9a24b}
.note{font-size:22px;font-weight:600;color:#efe6cf;text-align:center;margin-top:14px}.note span{font-family:Plex;font-weight:600}
body.lst .ph{height:560px}
/* Reel / Story (1080x1920, 9:16): the same design, taller photo; the top 120px (250px for a
   story) and the bottom 330px stay clear of Instagram's and Facebook's buttons and caption. */
body.reel{height:1920px}
.reel .ph{height:1240px;transform-origin:50% 45%}
.reel .ph:after{background:linear-gradient(180deg,rgba(15,43,33,.75) 0%,rgba(15,43,33,0) 18%,rgba(15,43,33,0) 40%,rgba(15,43,33,.85) 72%,#0f2b21 100%)}
.reel .top{top:120px}
.reel .panel{bottom:410px}
.reel .foot{bottom:330px}
.story .top{top:250px}
/* Evening "tweet" (design B1 v2, owner's choice 2026-10-07): a light card with the question,
   then an optional "did you know" fact with 3 tiles, and the invitation to comment. */
body.tweet{background:radial-gradient(120% 80% at 50% 0%,#174234 0%,#0f2b21 60%)}
.tw{position:absolute;left:60px;right:60px;top:0;display:flex;flex-direction:column;gap:0}
.card{width:100%;background:#f7f4ec;color:#0f2b21;border-radius:26px;padding:56px 56px 48px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.card .ar{color:#0f2b21;line-height:1.35}
.card .en{color:#1f2d26;line-height:1.3;white-space:normal;margin-top:16px}
.opts{display:flex;flex-wrap:wrap;gap:14px 24px;justify-content:space-between;direction:ltr;margin-top:30px;padding-top:24px;border-top:1px solid #e2dccd}
.opts.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 28px}
.opts span{display:flex;gap:10px;align-items:center;font-size:27px;color:#1f2d26;font-weight:700}.opts span b{font-family:Plex;font-weight:700}
.opts i{font-style:normal;color:#c9a24b;font-size:28px}
.dyk{margin-top:48px}.dyk .ar{color:#c9a24b;font-size:40px;line-height:1.35}.dyk .en{font-size:28px;font-weight:700;color:#fff;white-space:normal;margin-top:8px}
.tw .facts{margin-top:30px}
.ask{margin-top:44px;text-align:center;color:#c9a24b;font-size:28px;font-weight:700;white-space:nowrap}.ask span[dir=rtl]{font-family:Plex;font-weight:700;font-size:29px}
.choice .ask{display:inline-flex;gap:12px;align-items:center;border:1.5px solid rgba(201,162,75,.7);border-radius:40px;padding:12px 26px;font-size:24px;font-weight:700;color:#fff}
/* Evening "this or that" (design B2): two photos side by side, "أم" in the middle. */
.half{position:absolute;top:0;height:860px;width:540px;background-size:cover;background-position:center}
.half.l{left:0}.half.r{right:0}.half:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,33,.75) 0%,rgba(15,43,33,0) 22%,rgba(15,43,33,0) 65%,rgba(15,43,33,.95) 100%)}
.split{position:absolute;left:537px;top:0;height:860px;width:6px;background:#0f2b21;z-index:2}
.vs{position:absolute;left:470px;top:390px;width:140px;height:140px;border-radius:50%;background:#c9a24b;color:#0f2b21;z-index:3;display:flex;align-items:center;justify-content:center;font-family:Plex;font-weight:700;font-size:44px;box-shadow:0 8px 30px rgba(0,0,0,.4);border:6px solid #0f2b21}
.lab{position:absolute;top:690px;z-index:3;width:540px;text-align:center;padding:0 24px}.lab .la{font-family:Plex;font-weight:700;font-size:44px;line-height:1.2;white-space:nowrap}.lab .le{font-size:26px;color:#fff;font-weight:700;margin-top:4px;white-space:nowrap}
.lab .k{display:inline-block;width:54px;height:54px;line-height:54px;border-radius:50%;background:#c9a24b;color:#0f2b21;font-weight:700;font-size:28px;margin-bottom:10px}
.cq{position:absolute;left:52px;right:52px;top:935px;text-align:center}
.cq .ar,.cq .en{text-align:center;white-space:nowrap}.cq .en{margin-top:8px}.cq .ask{margin-top:40px}
/* Evening carousel (owner's approval 2026-10-08): a cover with a photo, 2-step content slides
   with big gold numbers, and an end slide (facts, call to action, the evening question). */
.c-cnt{border:1.5px solid rgba(201,162,75,.6);border-radius:40px;padding:10px 22px;font-weight:700;font-size:22px;color:#c9a24b}
.c-cover .ph{height:820px}.c-cover .ph:after{background:linear-gradient(180deg,rgba(15,43,33,.75) 0%,rgba(15,43,33,0) 22%,rgba(15,43,33,0) 50%,#0f2b21 100%)}
.c-panel{position:absolute;left:60px;right:60px;bottom:120px;z-index:6}
.c-ar{font-family:Plex;font-weight:700;color:#fff;direction:rtl;text-align:right;line-height:1.25}
.c-en{font-weight:700;color:#efe6cf;line-height:1.2;margin-top:10px;white-space:nowrap;direction:ltr;text-align:left}
.c-sub{font-family:Plex;font-weight:700;font-size:36px;color:#c9a24b;direction:rtl;text-align:right}.c-sube{font-size:24px;font-weight:700;color:#efe6cf;margin-top:6px;direction:ltr;text-align:left}
.c-swipe{margin-top:34px;display:flex;justify-content:space-between;align-items:center;background:#c9a24b;color:#0f2b21;border-radius:14px;padding:18px 28px;font-weight:700;font-size:24px;direction:ltr}.c-swipe span[dir=rtl]{font-family:Plex;font-size:28px}
.c-body{position:absolute;left:60px;right:60px;top:150px;bottom:165px;display:flex;flex-direction:column;justify-content:center;gap:30px;z-index:6}
.c-ttl{direction:rtl;display:flex;justify-content:space-between;align-items:baseline;gap:20px;border-bottom:1px solid rgba(201,162,75,.35);padding-bottom:18px}.c-ttl .a{font-family:Plex;font-weight:700;font-size:44px;color:#c9a24b;white-space:nowrap}.c-ttl .e{font-size:26px;color:#efe6cf;font-weight:700;white-space:nowrap;direction:ltr}
.c-photo{height:420px;border-radius:10px;background-size:cover;background-position:center;flex:none}
.c-st{display:flex;gap:28px;direction:rtl;background:rgba(255,255,255,.045);border-right:6px solid #c9a24b;padding:28px 30px;border-radius:4px}
.c-st .n{font-size:104px;font-weight:700;color:#c9a24b;line-height:.9;min-width:120px;text-align:center;direction:ltr}
.c-st .t{font-family:Plex;font-weight:700;font-size:58px;color:#fff;line-height:1.25}.c-st .d{font-family:Plex;font-weight:600;font-size:31px;line-height:1.5;color:#fff;margin-top:10px}
.c-st .e{direction:ltr;text-align:left;margin-top:16px;padding-top:14px;border-top:1px solid rgba(201,162,75,.2)}.c-st .e b{display:block;font-weight:700;font-size:28px;color:#efe6cf}.c-st .e span{display:block;font-size:22px;font-weight:600;color:#efe6cf;line-height:1.45;margin-top:4px}
.c-dots{position:absolute;bottom:128px;left:0;right:0;display:flex;gap:10px;justify-content:center;z-index:6}.c-dots i{width:12px;height:12px;border-radius:50%;background:rgba(201,162,75,.3)}.c-dots i.on{background:#c9a24b;width:36px;border-radius:8px}
.c-next{position:absolute;bottom:150px;right:60px;z-index:6;font-family:Plex;font-weight:700;color:#c9a24b;font-size:22px}
.c-body .facts{margin-top:6px}
.c-cta{background:#c9a24b;color:#0f2b21;border-radius:16px;padding:26px 30px;direction:rtl}.c-cta .a{font-family:Plex;font-weight:700;font-size:44px}.c-cta .e{direction:ltr;text-align:left;font-weight:700;font-size:24px;margin-top:6px}
.c-ask{border:1.5px solid rgba(201,162,75,.7);border-radius:16px;padding:22px 28px;direction:rtl}.c-ask .a{font-family:Plex;font-weight:700;font-size:36px;color:#fff;line-height:1.35}.c-ask .e{direction:ltr;text-align:left;font-weight:700;font-size:24px;color:#efe6cf;margin-top:6px}.c-ask .k{font-family:Plex;font-weight:700;color:#c9a24b;font-size:24px;margin-bottom:6px}
.c-note{font-family:Plex;font-weight:600;font-size:23px;color:#efe6cf;direction:rtl;text-align:right}.c-note+.c-note{font-family:Inter;direction:ltr;text-align:left;font-size:20px;margin-top:-22px}`;

const WA_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileUrl = (p) => "file://" + path.resolve(root, p.replace(/^\//, ""));

// The two evening designs (owner's choice 2026-10-03): "tweet" (main) and "choice" (1-2 a week).
const ASK = { ar: "شاركونا رأيكم في التعليقات", en: "Tell us in the comments" };
const topBar = (im) => `<div class="top"><div class="brand" dir="ltr"><img src="${fileUrl("public/logo-light.png")}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div>
${im.badge ? `<div class="badge"><span dir="rtl">${esc(im.badge.ar)}</span><span>·</span><span>${esc(im.badge.en)}</span></div>` : ""}</div>`;
const footer = () => `<div class="foot" dir="ltr"><span>www.hadararealestate.com</span><span class="wa">${WA_ICON}${PHONE}</span></div>`;
const askPill = (a) => `<div class="ask"><span dir="rtl">${esc((a || ASK).ar)}</span> <span>·</span> <span>${esc((a || ASK).en)}</span></div>`;
const FRAME = `<div class="frame"></div>`;
const textual = (v) => !/^[\d$€+.,\s–\-m²KkMm·:/×%\u2066\u2069]+$/.test(v);
const factTiles = (stats) => stats?.length ? `<div class="facts" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.map((s) =>
  `<div class="fa"><div class="v${textual(s.value) ? " t" : ""}">${esc(s.value)}</div><div class="a">${esc(s.ar)}</div><div class="e">${esc(s.en)}</div></div>`).join("")}</div>` : "";
const tipBox = (tip) => tip ? `<div class="tip"><div class="k">${esc(tip.labelAr || "معلومة")}</div><div><div class="t">${esc(tip.ar)}</div><div class="te">${esc(tip.en)}</div></div></div>` : "";

function tweetHtml(im) {
  const opts = (im.options || []).map((o) => `<span>${o.icon ? `<i>${esc(o.icon)}</i>` : ""}${esc(o.en)} · <b dir="rtl">${esc(o.ar)}</b></span>`).join("");
  const dyk = im.fact ? `<div class="dyk"><div class="ar">${esc(im.fact.ar)}</div><div class="en">${esc(im.fact.en)}</div></div>` : "";
  return `<div class="tw"><div class="card"><div class="ar" style="font-size:${im.arSize || 76}px">${esc(im.headlineAr)}</div><div class="en" style="font-size:${im.enSize || 40}px">${esc(im.headlineEn)}</div>
${opts ? `<div class="opts${(im.options || []).length === 4 ? " grid" : ""}">${opts}</div>` : ""}</div>${dyk}${factTiles(im.facts)}${askPill(im.ask)}</div>`;
}

function choiceHtml(im) {
  const side = (o, cls, key) => `<div class="half ${cls}" style="background-image:url('${fileUrl(publicPath(o.photo))}');background-position:${o.position || "center"}"></div>
<div class="lab" style="${cls === "l" ? "left" : "right"}:0"><div class="k">${key}</div><div class="la" dir="rtl">${esc(o.ar)}</div><div class="le">${esc(o.en)}</div></div>`;
  return `${side(im.a, "l", "A")}${side(im.b, "r", "B")}<div class="split"></div><div class="vs">أم</div>
<div class="cq"><div class="ar" style="font-size:${im.arSize || 50}px">${esc(im.headlineAr)}</div><div class="en" style="font-size:${im.enSize || 30}px">${esc(im.headlineEn)}</div>${askPill(im.ask)}</div>`;
}

// Evening carousel (owner's approval 2026-10-08): 3-10 slides, Facebook album + Instagram
// carousel. Slide 1 = cover (photo, big headline, "swipe"), then content slides of 1-2
// numbered items (an optional photo band), then the end slide (facts, CTA, the question).
function carouselPages(p) {
  const im = p.image;
  const total = 2 + (im.slides || []).length;
  const counter = (k) => `<div class="top"><div class="brand" dir="ltr"><img src="${fileUrl("public/logo-light.png")}"><div><b>HADARA</b><i>REAL ESTATE</i></div></div><div class="c-cnt" dir="ltr">${k} / ${total}</div></div>`;
  const dots = (k) => `<div class="c-dots">${Array.from({ length: total }, (_, i) => `<i${i + 1 === k ? ' class="on"' : ""}></i>`).join("")}</div>`;
  const wrap = (body, cls = "") => `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body${cls ? ` class="${cls}"` : ""}>${FRAME}${body}${footer()}</body></html>`;
  const title = im.sectionAr ? `<div class="c-ttl"><span class="a">${esc(im.sectionAr)}</span><span class="e">${esc(im.sectionEn || "")}</span></div>` : "";
  const pages = [wrap(`<div class="ph" style="background-image:url('${fileUrl(publicPath(im.photo))}');background-position:${im.position || "center"}"></div>${topBar(im)}
<div class="c-panel"><div class="c-ar" style="font-size:${im.arSize || 88}px">${esc(im.headlineAr)}</div><div class="c-en" style="font-size:${im.enSize || 40}px">${esc(im.headlineEn)}</div><div class="rule"></div>
${im.subAr ? `<div class="c-sub">${esc(im.subAr)}</div><div class="c-sube">${esc(im.subEn || "")}</div>` : ""}
<div class="c-swipe"><span>Swipe →</span><span dir="rtl">← ${esc(im.swipeAr || "اسحب للمزيد")}</span></div></div>${dots(1)}`, "c-cover")];
  let n = 0;
  for (const [k, sl] of (im.slides || []).entries()) {
    const items = (sl.items || []).map((it) => {
      n += 1;
      return `<div class="c-st">${im.numbered === false ? "" : `<div class="n">${String(n).padStart(2, "0")}</div>`}<div><div class="t">${esc(it.titleAr)}</div>${it.textAr ? `<div class="d">${esc(it.textAr)}</div>` : ""}
<div class="e"><b>${esc(it.titleEn)}</b>${it.textEn ? `<span>${esc(it.textEn)}</span>` : ""}</div></div></div>`;
    }).join("");
    const photo = sl.photo ? `<div class="c-photo" style="background-image:url('${fileUrl(publicPath(sl.photo))}');background-position:${sl.position || "center"}"></div>` : "";
    pages.push(wrap(`${counter(k + 2)}<div class="c-body">${title}${photo}${items}</div><div class="c-next">التالي ←</div>${dots(k + 2)}`));
  }
  const end = im.end || {};
  pages.push(wrap(`${counter(total)}<div class="c-body"><div><div class="c-ar" style="font-size:${end.arSize || 76}px">${esc(end.headlineAr)}</div><div class="c-en" style="font-size:${end.enSize || 40}px">${esc(end.headlineEn)}</div></div>
${factTiles(end.stats)}
${end.ask ? `<div class="c-ask"><div class="k">${esc(end.ask.labelAr || "سؤال الليلة")}</div><div class="a">${esc(end.ask.ar)}</div><div class="e">${esc(end.ask.en)}</div></div>` : ""}
${end.cta ? `<div class="c-cta"><div class="a">${esc(end.cta.ar)}</div><div class="e">${esc(end.cta.en)}</div></div>` : ""}
${end.note ? `<div class="c-note">${esc(end.note.ar)}</div><div class="c-note">${esc(end.note.en)}</div>` : ""}</div>${dots(total)}`));
  return pages;
}

const publicPath = (photo) => (photo.startsWith("/images/") || photo.startsWith("/hero") ? "public" + photo : photo);

function imageHtml(p) {
  if (p.image.design === "tweet" || p.image.design === "choice") {
    const im = p.image;
    return `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body class="${im.design}">
${FRAME}${topBar(im)}${im.design === "tweet" ? tweetHtml(im) : choiceHtml(im)}${footer()}</body></html>`;
  }
  // Design A v2 (owner's approval 2026-10-07): big headline, 3 large fact tiles (or a numbered
  // list for guides, design "list"), a gold "info" strip, thin gold frame.
  const im = p.image;
  const photo = publicPath(im.photo);
  const cls = [p.story || p.reel ? "reel" : "", p.story ? "story" : "", im.design === "list" ? "lst" : ""].filter(Boolean).join(" ");
  const body = im.design === "list"
    ? `<div class="list">${(im.items || []).map((it, k) => `<div class="it"><div class="n">${k + 1}</div><div><div class="a">${esc(it.ar)}</div><div class="e">${esc(it.en)}</div></div></div>`).join("")}</div>`
    : factTiles(im.stats);
  return `<html><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body${cls ? ` class="${cls}"` : ""}>${FRAME}
<div class="ph" style="background-image:url('${fileUrl(photo)}');background-position:${im.position || "center"};background-size:${im.size || "cover"}"></div>
${topBar(im)}
<div class="panel">${im.place || im.placeAr ? `<div class="eyebrow"><span>${esc(im.place || "")}</span><span class="a" dir="rtl">${esc(im.placeAr || "")}</span></div>` : ""}
<div class="ar" style="font-size:${im.arSize || 74}px">${esc(im.headlineAr)}</div><div class="en" style="font-size:${im.enSize || Math.round((im.arSize || 74) * 0.6)}px">${esc(im.headlineEn)}</div><div class="rule"></div>
${body}${tipBox(im.tip)}
${im.note ? `<div class="note"><span dir="rtl">${esc(im.note.ar)}</span> · ${esc(im.note.en)}</div>` : ""}</div>
${footer()}</body></html>`;
}

// ---------- never repeat (owner's rule 2026-10-03: "the content must never repeat") ----------
// Compares today's posts with social/log.json on the social-posts branch (everything already
// published) and with each other: a reused id or headline stops the run; a photo used today
// by another post or in the last 2 days stops it too; an older photo reuse is only reported.
const day = path.basename(outDir);
function publishedLog() {
  try {
    const { execFileSync } = require_("node:child_process");
    execFileSync("git", ["fetch", "-q", "origin", "social-posts"], { cwd: root, stdio: "ignore" });
    return JSON.parse(execFileSync("git", ["show", "origin/social-posts:social/log.json"], { cwd: root, encoding: "utf8" }));
  } catch {
    try { return JSON.parse(fs.readFileSync(path.join(here, "log-seed.json"), "utf8")); } catch { return []; }
  }
}
const norm = (t) => String(t || "").normalize("NFKC").replace(/[\u064B-\u0652\u0640\u2066-\u2069\u200E\u200F]/g, "")
  .replace(/[\s\p{P}\p{S}]+/gu, " ").trim().toLowerCase();
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const repeatProblems = new Map();
{
  const earlier = publishedLog().filter((e) => e.date !== day);
  const addProblem = (id, msg) => repeatProblems.set(id, [...(repeatProblems.get(id) || []), msg]);
  const todayHeads = new Map(), todayPhotos = new Map();
  for (const p of posts) {
    const im = p.image || {};
    const prev = earlier.find((e) => e.id === p.id);
    if (prev) addProblem(p.id, `id "${p.id}" was already published on ${prev.date} — use a new id and a new angle`);
    for (const h of [im.headlineAr, im.headlineEn].filter(Boolean)) {
      const n = norm(h);
      const old = earlier.find((e) => norm(e.headlineAr) === n || norm(e.headlineEn) === n);
      if (old) addProblem(p.id, `headline "${h}" was already published on ${old.date} (${old.id}) — write a new one`);
      if (todayHeads.has(n)) addProblem(p.id, `headline "${h}" is also used by ${todayHeads.get(n)} today`);
      todayHeads.set(n, p.id);
    }
    const photos = im.design === "choice" ? [im.a?.photo, im.b?.photo] : im.design === "tweet" ? [] : im.design === "carousel" ? [im.photo, ...(im.slides || []).map((sl) => sl.photo)] : [im.photo];
    for (const ph of photos.filter(Boolean)) {
      if (todayPhotos.has(ph)) addProblem(p.id, `photo ${ph} is also used by ${todayPhotos.get(ph)} today — pick another`);
      todayPhotos.set(ph, p.id);
      const last = earlier.filter((e) => e.photo === ph).map((e) => e.date).sort().pop();
      if (last && daysBetween(day, last) <= 2) addProblem(p.id, `photo ${ph} was published on ${last} — pick another`);
      else if (last) console.log(`note: ${p.id} reuses photo ${ph} (last published ${last}); prefer an unused one if the project has it`);
    }
  }
}

const pw = await import(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").catch(() => import("playwright"));
const browser = await pw.chromium.launch();
let problems = 0;
for (const [i, p] of posts.entries()) {
  const n = i + 1;
  if (p.image?.design === "carousel") {
    // One JPEG per slide (post-<n>-<k>.jpg) plus the cover as post-<n>.jpg (page, log, Telegram).
    const issues = [];
    const pages = carouselPages(p);
    if (pages.length < 3 || pages.length > 10) issues.push(`a carousel has 3-10 slides, got ${pages.length}`);
    if (p.story || p.reel) issues.push("a carousel is a feed post only (no story/reel)");
    for (const ph of [p.image.photo, ...(p.image.slides || []).map((sl) => sl.photo)].filter((x) => x !== undefined)) {
      if (!ph || !fs.existsSync(path.resolve(root, publicPath(ph)))) issues.push("photo not found: " + ph);
    }
    const slides = [];
    for (const [k, html] of pages.entries()) {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
      const htmlPath = path.join(outDir, `post-${n}-${k + 1}.html`);
      fs.writeFileSync(htmlPath, html);
      await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const check = await page.evaluate(() => {
        // Long lines shrink to fit: fact values, the English headline, the section title.
        const range = document.createRange();
        for (const v of document.querySelectorAll(".fa .v")) {
          range.selectNodeContents(v);
          let size = parseFloat(getComputedStyle(v).fontSize);
          while (range.getBoundingClientRect().width > v.clientWidth - 16 && size > 24) v.style.fontSize = `${(size -= 1)}px`;
        }
        for (const e of document.querySelectorAll(".c-en,.c-ttl .a,.c-ttl .e")) {
          let size = parseFloat(getComputedStyle(e).fontSize);
          while (e.scrollWidth > e.clientWidth + 1 && size > 22) e.style.fontSize = `${(size -= 1)}px`;
        }
        const cover = document.querySelector(".c-panel .c-ar");
        if (cover) {
          const lines = () => Math.round(cover.getBoundingClientRect().height / (parseFloat(getComputedStyle(cover).fontSize) * 1.25));
          while (lines() > 2 && parseFloat(getComputedStyle(cover).fontSize) > 60) cover.style.fontSize = `${parseFloat(getComputedStyle(cover).fontSize) - 2}px`;
        }
        const over = [...document.querySelectorAll(".fa .v,.fa .a,.fa .e,.c-en,.c-ttl .a,.c-ttl .e")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
        const top = document.querySelector(".top").getBoundingClientRect().bottom;
        const box = (document.querySelector(".c-body") || document.querySelector(".c-panel")).getBoundingClientRect();
        const body = document.querySelector(".c-body");
        const kids = body ? [...body.children].map((c) => c.getBoundingClientRect()) : [];
        const contentTop = kids.length ? Math.min(...kids.map((r) => r.top)) : box.top;
        const contentBottom = kids.length ? Math.max(...kids.map((r) => r.bottom)) : box.bottom;
        return { over, clash: contentTop < top + 20 || (body && contentBottom > 1350 - 170), coverLines: cover ? Math.round(cover.getBoundingClientRect().height / (parseFloat(getComputedStyle(cover).fontSize) * 1.25)) : 0, fonts: ["Inter", "Plex"].every((fam) => [...document.fonts].some((f) => f.family.replace(/"/g, "") === fam && f.status === "loaded")) ? 4 : 0 };
      });
      if (check.over.length) issues.push(`slide ${k + 1}: text overflows: ${check.over.join(" | ")}`);
      if (check.clash) issues.push(`slide ${k + 1}: content does not fit between the top bar and the dots (shorten the text, or 1 item on this slide)`);
      if (check.coverLines > 2) issues.push(`slide 1: the headline wraps to ${check.coverLines} lines (max 2: shorten it)`);
      if (check.fonts < 4) issues.push(`slide ${k + 1}: fonts did not load`);
      const file = `post-${n}-${k + 1}.jpg`;
      await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 90 });
      slides.push(file);
      await page.close();
      fs.unlinkSync(htmlPath);
    }
    fs.copyFileSync(path.join(outDir, slides[0]), path.join(outDir, `post-${n}.jpg`));
    if (!p.caption) issues.push("a carousel needs a caption");
    if (p.at !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.at)) issues.push(`"at" must be Istanbul time "HH:MM", got ${JSON.stringify(p.at)}`);
    issues.push(...(repeatProblems.get(p.id) || []));
    const result = { id: p.id, topic: p.topic, image: `post-${n}.jpg`, slides, fb: p.caption ? caption(p, "facebook") : "", ig: p.caption ? caption(p, "instagram") : "", ...(p.at ? { at: p.at } : {}) };
    fs.writeFileSync(path.join(outDir, `post-${n}.json`), JSON.stringify(result, null, 2));
    console.log(`post-${n} (${p.id}, carousel of ${slides.length}): ${issues.length ? "PROBLEMS\n  - " + issues.join("\n  - ") : "ok"}`);
    problems += issues.length;
    continue;
  }
  const H = p.reel || p.story ? 1920 : 1350;
  const page = await browser.newPage({ viewport: { width: 1080, height: H } });
  const htmlPath = path.join(outDir, `post-${n}.html`);
  fs.writeFileSync(htmlPath, imageHtml(p));
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // "A" = the photo design (also its numbered-list variant "list"); "tweet"/"choice" = evening.
  const design = p.image.design === "tweet" || p.image.design === "choice" ? p.image.design : "A";
  // Fact values shrink until they fit their tile with room to spare.
  await page.evaluate(() => {
    const range = document.createRange();
    for (const v of document.querySelectorAll(".fa .v")) {
      range.selectNodeContents(v);
      let size = parseFloat(getComputedStyle(v).fontSize);
      while (range.getBoundingClientRect().width > v.clientWidth - 16 && size > 24) v.style.fontSize = `${(size -= 1)}px`;
    }
  });
  if (design === "tweet") {
    // Centre the block between the top bar and the footer; a long question shrinks
    // (at most 3 Arabic lines) until everything fits.
    await page.evaluate(() => {
      const tw = document.querySelector(".tw"), ar = document.querySelector(".card .ar"), en = document.querySelector(".card .en");
      const fit = () => {
        const lines = Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * 1.35));
        return lines <= 3 && tw.getBoundingClientRect().height <= 1040;
      };
      for (let n = 0; n < 30 && !fit(); n++) {
        ar.style.fontSize = `${parseFloat(getComputedStyle(ar).fontSize) - 2}px`;
        en.style.fontSize = `${Math.max(26, parseFloat(getComputedStyle(en).fontSize) - 1)}px`;
      }
      tw.style.top = `${Math.round(150 + (1100 - tw.getBoundingClientRect().height) / 2)}px`;
    });
  } else if (design === "choice") {
    // The question and the two labels stay on one line each: shrink them until they fit.
    await page.evaluate(() => {
      for (const e of document.querySelectorAll(".cq .ar,.cq .en,.lab .la,.lab .le")) {
        let size = parseFloat(getComputedStyle(e).fontSize);
        while (e.scrollWidth > e.clientWidth + 1 && size > 22) e.style.fontSize = `${(size -= 1)}px`;
      }
    });
  } else {
    // The headline: at most 2 Arabic lines (shrinks down to 52px); the English line shrinks
    // to fit on one line (down to 28px).
    await page.evaluate(() => {
      const ar = document.querySelector(".panel .ar"), en = document.querySelector(".panel .en");
      const lines = () => Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * 1.28));
      while (lines() > 2 && parseFloat(getComputedStyle(ar).fontSize) > 52) ar.style.fontSize = `${parseFloat(getComputedStyle(ar).fontSize) - 2}px`;
      let size = parseFloat(getComputedStyle(en).fontSize);
      while (en.scrollWidth > en.clientWidth + 1 && size > 28) en.style.fontSize = `${(size -= 1)}px`;
    });
  }
  const check = design !== "A" ? await page.evaluate((design) => {
    const sel = design === "tweet" ? ".opts span,.ask,.fa .v,.fa .a,.fa .e" : ".cq .ar,.cq .en,.lab .la,.lab .le,.ask";
    const over = [...document.querySelectorAll(sel)].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    const box = document.querySelector(design === "tweet" ? ".tw" : ".cq").getBoundingClientRect();
    const top = document.querySelector(".top").getBoundingClientRect().bottom;
    const foot = document.querySelector(".foot").getBoundingClientRect().top;
    const ar = document.querySelector(design === "tweet" ? ".card .ar" : ".cq .ar");
    const arLines = Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * 1.35));
    return { over, clash: box.top < top + 8 || box.bottom > foot - 8, arLines, maxLines: design === "tweet" ? 3 : 1, fonts: ["Inter", "Plex"].every((fam) => [...document.fonts].some((f) => f.family.replace(/"/g, "") === fam && f.status === "loaded")) ? 4 : 0 };
  }, design) : await page.evaluate(() => {
    const over = [...document.querySelectorAll(".fa .v,.fa .a,.fa .e,.it .a,.it .e,.tip .t,.tip .te,.en,.note")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    const panel = document.querySelector(".panel").getBoundingClientRect();
    const top = document.querySelector(".top").getBoundingClientRect().bottom;
    const ar = document.querySelector(".panel .ar");
    const arLines = Math.round(ar.getBoundingClientRect().height / (parseFloat(getComputedStyle(ar).fontSize) * 1.28));
    return { over, clash: panel.top < top + 30, arLines, maxLines: 2, fonts: ["Inter", "Plex"].every((fam) => [...document.fonts].some((f) => f.family.replace(/"/g, "") === fam && f.status === "loaded")) ? 4 : 0 };
  });
  const photos = design === "tweet" ? [] : design === "choice" ? [p.image.a?.photo, p.image.b?.photo] : [p.image.photo];
  const issues = [];
  for (const ph of photos) {
    const photoFile = ph ? path.resolve(root, publicPath(ph)) : "";
    if (!ph || !fs.existsSync(photoFile)) issues.push("photo not found: " + (photoFile || "(missing a/b photo)"));
  }
  if (check.over.length) issues.push("text overflows: " + check.over.join(" | "));
  if (check.clash) issues.push(design === "A" ? "text panel reaches the top bar (shorten the text, use 3 stats, or a shorter tip)" : "text block overlaps the top bar or the footer (shorten the text)");
  if (design === "A" && check.over.some((t) => t === p.image.headlineEn)) issues.push("English headline too long for one line (shorten it)");
  if (check.arLines > (check.maxLines || 1)) issues.push(`Arabic text wraps to ${check.arLines} lines (max ${check.maxLines || 1}: shorten it or lower arSize)`);
  issues.push(...(repeatProblems.get(p.id) || []));
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
