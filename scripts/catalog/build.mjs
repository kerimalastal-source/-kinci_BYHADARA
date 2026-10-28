// Builds the HADARA Real Estate project catalogue as print-ready PDFs (A4 landscape),
// one in Arabic and one in English, from the site's own data:
//
//   node scripts/catalog/build.mjs [ar|en ...]
//
// Every fact comes from src/data/projects.ts and src/i18n/<lang>.json, so the catalogue
// stays in line with the website. Sold-out projects are left out and no prices are
// printed (prices change; the back page says they are on request). Photos are resized to
// JPEG by scripts/catalog/photos.py (Pillow; set PYTHON if python3 has no Pillow).
// Output: scripts/catalog/out/HADARA-Real-Estate-Catalogue-<lang>.pdf (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, "out");
const imgDir = path.join(out, "img");
fs.mkdirSync(imgDir, { recursive: true });

const SITE = "https://www.hadararealestate.com";
const YEAR = "2026";
const PHONE = "+90 531 930 92 14";
const EMAIL = "info@byhadara.com";
const WHATSAPP = "https://wa.me/905319309214";

async function loadProjects() {
  const { code } = transformSync(fs.readFileSync(path.join(root, "src/data/projects.ts"), "utf8"), { loader: "ts", format: "esm" });
  const tmp = path.join(out, "projects.tmp.mjs");
  fs.writeFileSync(tmp, code);
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  fs.rmSync(tmp);
  return mod;
}

// Words the site has no dictionary key for (catalogue-only labels).
const STR = {
  ar: {
    title: "مشاريعنا في إسطنبول",
    subtitle: "كتالوج المشاريع",
    partner: "شريك تطوير وتسويق عقاري في إسطنبول",
    about: "من نحن",
    index: "المشاريع",
    indexSub: "مختارات من أبرز المشاريع السكنية في إسطنبول، على جانبَي المدينة",
    sectionA: "إطلاقات جديدة ومشاريع قيد الإنشاء",
    sectionASub: "خطط دفع مرنة في مشاريع مختارة، ومساكن تُسلَّم خلال السنوات القادمة",
    sectionB: "مشاريع جاهزة للسكن",
    sectionBSub: "مجمّعات مكتملة وفلل جاهزة، بوحدات متاحة للتملّك الآن",
    projectsWord: "مشروعاً",
    signature: "من تطوير حضارة",
    layouts: "أنواع الوحدات",
    scan: "امسح الرمز لتفاصيل المشروع والصور",
    page: "صفحة",
    services: "ما نقدّمه لك",
    citizenship: "الجنسية التركية عبر العقار",
    contact: "تواصل معنا",
    contactSub: "يسعد فريقنا بمساعدتك في اختيار المشروع المناسب، وترتيب جولة في إسطنبول أو جولة خاصة عبر الفيديو.",
    phone: "الهاتف وواتساب",
    email: "البريد الإلكتروني",
    address: "المكتب",
    hours: "ساعات العمل",
    web: "الموقع الإلكتروني",
    scanWa: "واتساب",
    scanWeb: "جميع المشاريع",
    note: "المعلومات والصور مأخوذة من المطوّرين وقد تتغيّر، وبعض الصور تصوّرات تصميمية. الأسعار عند الطلب.",
    citizenshipNote: "الشروط وفق القانون الحالي وقابلة للتغيير.",
    edition: `إصدار ${YEAR}`
  },
  en: {
    title: "Our Projects in Istanbul",
    subtitle: "Project Catalogue",
    partner: "Real Estate Development & Marketing Partner in Istanbul",
    about: "About us",
    index: "The projects",
    indexSub: "A selection of Istanbul's leading residential projects, on both sides of the city",
    sectionA: "New launches & projects under construction",
    sectionASub: "Flexible payment plans on selected projects, with homes delivered over the coming years",
    sectionB: "Ready to move in",
    sectionBSub: "Completed communities and finished villas, with homes available now",
    projectsWord: "projects",
    signature: "Developed by HADARA",
    layouts: "Home types",
    scan: "Scan for the project's details and photos",
    page: "Page",
    services: "What we offer",
    citizenship: "Turkish citizenship through property",
    contact: "Contact us",
    contactSub: "Our team will gladly help you choose the right project and arrange a visit in Istanbul or a private video tour.",
    phone: "Phone & WhatsApp",
    email: "Email",
    address: "Office",
    hours: "Office hours",
    web: "Website",
    scanWa: "WhatsApp",
    scanWeb: "All projects",
    note: "Information and images come from the developers and may change; some images are design renderings. Prices on request.",
    citizenshipNote: "Conditions per current law, subject to change.",
    edition: `Edition ${YEAR}`
  }
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ltr = (s) => `<bdi dir="ltr">${esc(s)}</bdi>`;
const placeKey = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").toLowerCase();

const photos = new Map(); // web path -> { file, width }
function photo(webPath, width) {
  const base = webPath.replace(/^\//, "").replace(/\.[a-z]+$/i, "").replace(/[\/]/g, "_");
  const key = `${webPath}@${width}`;
  if (!photos.has(key)) photos.set(key, { src: path.join(root, "public", webPath), out: path.join(imgDir, `${base}-${width}.jpg`), width });
  return pathToFileURL(photos.get(key).out).href;
}

function qrSvg(url, size) {
  const py = process.env.PYTHON || "python3";
  const svg = execFileSync(py, ["-c", "import segno,sys;print(segno.make(sys.argv[1],error='m').svg_inline(scale=1,border=0,dark='#0f2b21',light=None))", url], { encoding: "utf8" });
  return svg.replace(/<svg width="(\d+)" height="(\d+)"/, (_, w, h) => `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges"`);
}

const LOGO_LIGHT = pathToFileURL(path.join(root, "public/logo-light.png")).href;
const LOGO_DARK = pathToFileURL(path.join(root, "public/logo-dark.png")).href;
const brand = (variant) => `
  <div class="brand brand--${variant}" lang="en" dir="ltr" translate="no">
    <img src="${variant === "light" ? LOGO_LIGHT : LOGO_DARK}" alt="">
    <span><b>HADARA</b><i>REAL ESTATE</i></span>
  </div>`;

function build(lang, mod, dict) {
  const s = STR[lang];
  const t = (key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
  const rtl = lang === "ar";
  const place = (d) => t(`places.${placeKey(d)}`) || d;
  const statusLabel = (p) => ({ "new-launch": t("common.statusNewLaunch"), ongoing: t("common.statusOngoing"), delivered: t("common.statusDelivered") })[p.status];
  const stat = (st) => t(`common.statLabels.${st.labelKey}`) || st.labelKey;

  const all = mod.projects.filter((p) => !p.soldOut).sort((a, b) => a.priority - b.priority);
  const villa = all.filter((p) => p.developer === "HADARA Real Estate");
  const groupA = all.filter((p) => p.status !== "delivered");
  const groupB = [...villa, ...all.filter((p) => p.status === "delivered" && !villa.includes(p))];

  // Page numbers: cover 1, about 2, index 3, divider A 4, projects…, divider B, projects…, services, citizenship, back.
  const pageOf = new Map();
  let n = 4;
  for (const p of groupA) pageOf.set(p.slug, ++n);
  n++;
  for (const p of groupB) pageOf.set(p.slug, ++n);
  const total = n + 3;
  const num = (i) => String(i).padStart(2, "0");

  const projectUrl = (slug) => `${SITE}${lang === "en" ? "" : "/" + lang}/projects/${slug}?utm_source=catalog&utm_medium=print&utm_campaign=catalog-${YEAR}`;

  const cover = `
  <section class="page cover">
    <img class="bg" src="${photo("/hero-istanbul.jpg", 2400)}" alt="">
    <div class="shade"></div>
    <div class="cover__top">${brand("light")}<span class="edition">${esc(s.edition)}</span></div>
    <div class="cover__body">
      <p class="eyebrow">${esc(s.subtitle)}</p>
      <h1>${esc(s.title)}</h1>
      <div class="rule"></div>
      <p class="cover__partner">${esc(s.partner)}</p>
    </div>
    <div class="cover__foot"><span>${ltr("www.hadararealestate.com")}</span><span>${ltr(PHONE)}</span></div>
  </section>`;

  const stats = t("home.stats") || [];
  const about = `
  <section class="page about">
    <div class="about__photo"><img src="${photo("/images/projects/marmara-haven-villa/sunset.jpg", 1600)}" alt=""></div>
    <div class="about__text">
      <div class="head">${brand("dark")}<span class="pno">${num(2)}</span></div>
      <p class="eyebrow">${esc(s.about)}</p>
      <h2>${esc(t("about.storyTitle"))}</h2>
      <p class="lead">${esc(t("about.storyText1"))}</p>
      <div class="mv">
        <div><b>${esc(t("about.missionTitle"))}</b><p>${esc(t("about.missionText"))}</p></div>
        <div><b>${esc(t("about.visionTitle"))}</b><p>${esc(t("about.visionText"))}</p></div>
      </div>
      <div class="tiles">${stats
        .map((x) => `<div class="tile"><b>${ltr(x.value)}</b><span>${esc(x.label)}</span></div>`)
        .join("")}</div>
    </div>
  </section>`;

  const card = (p) => {
    const c = t(`projectsData.${p.slug}`);
    return `<div class="icard">
      <img src="${photo(p.coverImage.src, 700)}" alt="">
      <div><b>${esc(c.name)}</b><span>${esc(place(p.district))}</span></div>
      <em>${num(pageOf.get(p.slug))}</em>
    </div>`;
  };
  const index = `
  <section class="page index">
    <div class="head">${brand("dark")}<span class="pno">${num(3)}</span></div>
    <p class="eyebrow">${esc(s.index)}</p>
    <h2>${esc(s.indexSub)}</h2>
    <h3>${esc(s.sectionA)}</h3>
    <div class="igrid">${groupA.map(card).join("")}</div>
    <h3>${esc(s.sectionB)}</h3>
    <div class="igrid">${groupB.map(card).join("")}</div>
  </section>`;

  const divider = (no, title, sub, count, img, page) => `
  <section class="page divider">
    <img class="bg" src="${photo(img, 2400)}" alt="">
    <div class="shade"></div>
    <div class="divider__body">
      <span class="big">${num(no)}</span>
      <h2>${esc(title)}</h2>
      <div class="rule"></div>
      <p>${esc(sub)}</p>
      <p class="count">${ltr(count)} ${esc(s.projectsWord)}</p>
    </div>
    <span class="pno pno--light">${num(page)}</span>
  </section>`;

  const projectPage = (p) => {
    const c = t(`projectsData.${p.slug}`);
    const latin = lang === "en" ? "" : dict.__en.projectsData[p.slug].name;
    const gallery = p.gallery.filter((g) => !/plan|bath|hamam|site-plan/i.test(g.src)).slice(0, 2);
    const stats = p.stats.filter((x) => x.labelKey !== "layout" && x.labelKey !== "villaLayout").slice(0, 4);
    const layoutStat = p.stats.find((x) => x.labelKey === "layout" || x.labelKey === "villaLayout");
    const layouts = [...new Set((p.residences || []).map((r) => r.layout).filter(Boolean))];
    const layoutText = layouts.length ? layouts.slice(0, 7).join(" · ") : layoutStat ? layoutStat.value : "";
    const highlights = (c.highlights || []).slice(0, 4);
    const plan = p.paymentPlan
      ? t("projectDetail.paymentPlanValue")
          .replace("{down}", ltr(`${p.paymentPlan.downPercent}%`))
          .replace("{months}", ltr(mod.planMonths(p.paymentPlan)))
      : "";
    const tags = [statusLabel(p), p.unitsAvailable ? t("common.unitsAvailable") : ""].filter(Boolean);
    // Gross area range per home type (from the site's residences), or the villa's floors.
    const nums = (v) => (String(v || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, "")));
    const byLayout = new Map();
    for (const r of p.residences || []) {
      const label = r.kind === "villa" ? `${t("projectDetail.residenceVilla")} ${r.layout}` : r.layout;
      if (!label) continue;
      const g = byLayout.get(label) || [];
      g.push(...nums(r.gross));
      byLayout.set(label, g);
    }
    const area = (list) => {
      if (!list.length) return "";
      const lo = Math.round(Math.min(...list));
      const hi = Math.round(Math.max(...list));
      return lo === hi ? `${lo} m²` : `${lo} – ${hi} m²`;
    };
    const rows = [...byLayout].slice(0, 8).map(([label, list]) => [label, area(list)]);
    const floors = (p.floorPlan || []).filter((f) => f.gross).map((f, i) => [c.floorPlan?.[i]?.name || "", f.gross]);
    const table = rows.length
      ? `<div class="units"><p class="units__t">${esc(t("projectDetail.residencesTitle"))}</p><div class="units__g">${rows
          .map(([l, a]) => `<div><b>${ltr(l)}</b><span>${a ? ltr(a) : ""}</span></div>`)
          .join("")}</div></div>`
      : floors.length
        ? `<div class="units"><p class="units__t">${esc(t("projectDetail.floorPlanTitle"))}</p><div class="units__g">${floors
            .map(([l, a]) => `<div><b>${esc(l)}</b><span>${ltr(a)}</span></div>`)
            .join("")}</div></div>`
        : "";
    return `
  <section class="page project">
    <div class="pphoto">
      <img class="main" src="${photo(p.coverImage.src, 1800)}" alt="">
      <div class="thumbs">${gallery.map((g) => `<img src="${photo(g.src, 900)}" alt="">`).join("")}</div>
    </div>
    <div class="ptext">
      <div class="head">${brand("dark")}<span class="pno">${num(pageOf.get(p.slug))}</span></div>
      <p class="tags">${villa.includes(p) ? `<span class="sig">${esc(s.signature)}</span>` : ""}${tags.map((x) => `<span>${esc(x)}</span>`).join("")}</p>
      <h2>${esc(c.name)}</h2>
      ${latin ? `<p class="latin" lang="en" dir="ltr">${esc(latin)}</p>` : ""}
      <p class="place"><svg viewBox="0 0 24 24" width="11" height="11"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" fill="currentColor"/></svg>${esc(place(p.district))}${rtl ? "، " : ", "}${esc(place(p.city))}${p.developer ? `<span class="dev">${esc(t("projectDetail.developerLabel"))}: ${ltr(p.developer)}</span>` : ""}</p>
      <p class="tagline">${esc(c.tagline)}</p>
      <div class="pstats">${stats.map((x) => `<div><b>${ltr(x.value)}</b><span>${esc(stat(x))}</span></div>`).join("")}</div>
      <ul class="hl">${highlights.slice(0, table ? 3 : 4).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
      ${table}
      <div class="pfoot">
        <div class="pinfo">
          ${layoutText && !rows.length ? `<p><span>${esc(s.layouts)}</span>${ltr(layoutText)}</p>` : ""}
          ${plan ? `<p class="plan"><span>${esc(t("projectDetail.paymentPlanLabel"))}</span>${plan}</p>` : ""}
        </div>
        <div class="qr">${qrSvg(projectUrl(p.slug), "21mm")}<span>${esc(s.scan)}</span></div>
      </div>
    </div>
  </section>`;
  };

  const services = t("home.services") || [];
  const why = t("home.why") || [];
  const servicesPage = `
  <section class="page services">
    <div class="head">${brand("dark")}<span class="pno">${num(total - 2)}</span></div>
    <p class="eyebrow">${esc(s.services)}</p>
    <h2>${esc(t("home.servicesTitle"))}</h2>
    <div class="sgrid">${services.map((x, i) => `<div><em>${num(i + 1)}</em><b>${esc(x.title)}</b><p>${esc(x.desc)}</p></div>`).join("")}</div>
    <h3>${esc(t("home.whyTitle"))}</h3>
    <div class="wgrid">${why.map((x) => `<div><b>${esc(x.title)}</b><p>${esc(x.desc)}</p></div>`).join("")}</div>
  </section>`;

  const facts = t("citizenship.facts") || [];
  const citizenship = `
  <section class="page citizen">
    <div class="citizen__photo"><img src="${photo("/images/projects/sea-pearl-atakoy/sea-terrace.jpg", 1600)}" alt=""></div>
    <div class="citizen__text">
      <div class="head">${brand("dark")}<span class="pno">${num(total - 1)}</span></div>
      <p class="eyebrow">${esc(s.citizenship)}</p>
      <h2>${esc(t("citizenship.heroTitle"))}</h2>
      <p class="lead">${esc(t("citizenship.heroSubtitle"))}</p>
      <div class="tiles tiles--4">${facts.map((x) => `<div class="tile"><b>${ltr(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>
      <p class="steps__t">${esc(t("citizenship.stepsTitle"))}</p>
      <ol class="steps">${(t("citizenship.steps") || []).map((x, i) => `<li><em>${num(i + 1)}</em>${esc(x.title)}</li>`).join("")}</ol>
      <p class="small">${esc(s.citizenshipNote)}</p>
    </div>
  </section>`;

  const back = `
  <section class="page back">
    <img class="bg" src="${photo("/images/projects/marmara-haven-villa/dusk-pool.jpg", 2400)}" alt="">
    <div class="shade shade--full"></div>
    <div class="back__body">
      ${brand("light")}
      <h2>${esc(s.contact)}</h2>
      <p class="sub">${esc(s.contactSub)}</p>
      <dl>
        <div><dt>${esc(s.phone)}</dt><dd>${ltr(PHONE)}</dd></div>
        <div><dt>${esc(s.email)}</dt><dd>${ltr(EMAIL)}</dd></div>
        <div><dt>${esc(s.address)}</dt><dd>${esc(t("contact.address"))}</dd></div>
        <div><dt>${esc(s.hours)}</dt><dd>${esc(t("contact.hoursText"))}</dd></div>
        <div><dt>${esc(s.web)}</dt><dd>${ltr("www.hadararealestate.com")} · ${ltr("@hadararealestate")}</dd></div>
      </dl>
      <div class="qrs">
        <div class="qr qr--light">${qrSvg(WHATSAPP, "24mm")}<span>${esc(s.scanWa)}</span></div>
        <div class="qr qr--light">${qrSvg(`${SITE}${lang === "en" ? "" : "/" + lang}/projects?utm_source=catalog&utm_medium=print&utm_campaign=catalog-${YEAR}`, "24mm")}<span>${esc(s.scanWeb)}</span></div>
      </div>
      <p class="note">${esc(s.note)}</p>
    </div>
  </section>`;

  const body = [
    cover,
    about,
    index,
    divider(1, s.sectionA, s.sectionASub, groupA.length, "/images/projects/beylikduzu-living/aerial-main.jpg", 4),
    ...groupA.map(projectPage),
    divider(2, s.sectionB, s.sectionBSub, groupB.length, "/images/projects/marmara-haven-villa/drone.jpg", 5 + groupA.length),
    ...groupB.map(projectPage),
    servicesPage,
    citizenship,
    back
  ].join("\n");

  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<title>HADARA Real Estate — ${esc(s.subtitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap">
<style>${fs.readFileSync(path.join(here, "catalog.css"), "utf8")}</style>
</head><body>${body}</body></html>`;
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["ar", "en"];
const mod = await loadProjects();
const en = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/en.json"), "utf8"));
const htmlFiles = [];
for (const lang of langs) {
  const dict = JSON.parse(fs.readFileSync(path.join(root, `src/i18n/${lang}.json`), "utf8"));
  dict.__en = en;
  const file = path.join(out, `catalogue-${lang}.html`);
  fs.writeFileSync(file, build(lang, mod, dict));
  htmlFiles.push([lang, file]);
}

// Resize every photo once (JPEG keeps the PDF small; WebP would be stored losslessly).
const jobs = [...photos.values()].filter((p) => !fs.existsSync(p.out));
if (jobs.length) {
  fs.writeFileSync(path.join(out, "photos.json"), JSON.stringify(jobs));
  execFileSync(process.env.PYTHON || "python3", [path.join(here, "photos.py"), path.join(out, "photos.json")], { stdio: "inherit" });
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").catch(() => import("playwright"));
const browser = await chromium.launch();
for (const [lang, file] of htmlFiles) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const pdf = path.join(out, `HADARA-Real-Estate-Catalogue-${lang}.pdf`);
  await page.pdf({ path: pdf, width: "297mm", height: "210mm", printBackground: true, preferCSSPageSize: true });
  console.log(`${lang}: ${pdf} (${(fs.statSync(pdf).size / 1e6).toFixed(1)} MB)`);
  await page.close();
}
await browser.close();
