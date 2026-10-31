// Builds the Marmara Haven Villa brochure (HADARA's own development) as print-ready PDFs,
// A4 landscape, in Arabic and English:
//
//   node scripts/catalog/villa.mjs [ar|en ...]
//
// Every fact comes from the site: src/data/projects.ts (stats, floors, amenities, verified
// card, price) and projectsData.marmara-haven-villa in src/i18n/<lang>.json. The price is the
// one the villa page shows, with its note (VAT included, 4% title deed fee not included).
// Output: scripts/catalog/out/Marmara-Haven-Villa-<lang>.pdf (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { out, SITE, YEAR, PHONE, EMAIL, WHATSAPP, loadTs, loadDict, lookup, esc, ltr, placeKey, num, photo, qrSvg, brand, pageHtml, renderPdfs } from "./lib.mjs";

const SLUG = "marmara-haven-villa";
const IMG = (name) => `/images/projects/${SLUG}/${name}.jpg`;

// Catalogue-only words (no dictionary key on the site).
const STR = {
  ar: {
    signature: "من تطوير حضارة العقارية",
    brochure: "كتيّب الفيلا",
    glance: "الفيلا في أرقام",
    overview: "نظرة على الفيلا",
    floor: "الطابق",
    gross: "المساحة الإجمالية",
    net: "المساحة الصافية",
    inside: "من الداخل",
    insideSub: "مساحات واسعة وإضاءة طبيعية وتشطيبات من مواد عالية الجودة",
    outside: "الحديقة والمسبح",
    features: "مزايا الفيلا",
    location: "الموقع وما حوله",
    locationSub: "بيوكجكمجة، على الجانب الأوروبي من إسطنبول، قرب ساحل بحر مرمرة",
    viewing: "احجز معاينتك الخاصة",
    price: "السعر",
    scanVideo: "شاهد جولة الفيديو وصفحة الفيلا",
    scanWa: "تواصل معنا عبر واتساب",
    contact: "تواصل معنا",
    phone: "الهاتف وواتساب",
    email: "البريد الإلكتروني",
    address: "المكتب",
    hours: "ساعات العمل",
    note: "المعلومات والمساحات مؤكَّدة من فريق حضارة، والسعر قابل للتغيير. الصور من الفيلا نفسها."
  },
  en: {
    signature: "Developed by HADARA Real Estate",
    brochure: "Villa brochure",
    glance: "The villa at a glance",
    overview: "The villa",
    floor: "Level",
    gross: "Gross area",
    net: "Net area",
    inside: "Inside the villa",
    insideSub: "Generous spaces, natural light and finishes in high-quality materials",
    outside: "Garden & pool",
    features: "Villa features",
    location: "Location & surroundings",
    locationSub: "Büyükçekmece, on Istanbul's European side, close to the Sea of Marmara coast",
    viewing: "Book your private viewing",
    price: "Price",
    scanVideo: "Watch the video tour and the villa page",
    scanWa: "Chat with us on WhatsApp",
    contact: "Contact us",
    phone: "Phone & WhatsApp",
    email: "Email",
    address: "Office",
    hours: "Office hours",
    note: "Information and areas confirmed by the HADARA team; the price may change. Photos show the villa itself."
  }
};

// Photos for each level, in the order of project.floorPlan (the level's own photo first).
const LEVEL_PHOTOS = [["basement-room"], ["living-sea", "kitchen-island"], ["bedroom-sea", "master-bedroom"], ["attic", "rooftop"]];

function build(lang, project, icons, dict) {
  const s = STR[lang];
  const t = lookup(dict);
  const rtl = lang === "ar";
  const c = t(`projectsData.${SLUG}`);
  const latin = dict.__en.projectsData[SLUG].name;
  const place = (d) => t(`places.${placeKey(d)}`) || d;
  const where = `${place(project.district)}${rtl ? "، " : ", "}${place(project.city)}`;
  const statLabel = (k) => t(`common.statLabels.${k}`) || k;
  const pageUrl = `${SITE}${lang === "en" ? "" : "/" + lang}/projects/${SLUG}?utm_source=catalog&utm_medium=print&utm_campaign=villa-brochure-${YEAR}`;
  const waUrl = `${WHATSAPP}?text=${encodeURIComponent(t("projectDetail.whatsappMessage").replace("{name}", c.name))}`;
  // Page numbers are filled in once the pages are in order (see the end of build()).
  const pno = (light) => `<span class="pno${light ? " pno--light" : ""}">@@PNO@@</span>`;
  const head = () => `<div class="head">${brand("dark")}${pno()}</div>`;

  const cover = `
  <section class="page vcover">
    <div class="vcover__panel">
      ${brand("light")}
      <div class="vcover__body">
        <p class="eyebrow">${esc(s.signature)}</p>
        <h1>${esc(c.name)}</h1>
        ${rtl ? `<p class="latin latin--light" lang="en" dir="ltr">${esc(latin)}</p>` : ""}
        <div class="rule"></div>
        <p class="vcover__tag">${esc(c.tagline)}</p>
      </div>
      <p class="vcover__foot">${esc(where)} · ${ltr("www.hadararealestate.com")}</p>
    </div>
    <div class="vcover__photo"><img src="${photo(IMG("dusk-pool"), 1800)}" alt=""></div>
  </section>`;

  const glanceStats = [
    ...project.stats.map((x) => [x.value, statLabel(x.labelKey)]),
    ["26 m²", t("projectDetail.amenities.privatePool")]
  ];
  const glance = `
  <section class="page vfull">
    <img class="bg" src="${photo(IMG("drone-front"), 2400)}" alt="">
    <div class="vfull__shade"></div>
    <div class="vfull__body">
      <p class="eyebrow">${esc(s.glance)}</p>
      <p class="vfull__lead">${esc(c.shortDescription)}</p>
      <div class="vstrip">${glanceStats.map(([v, l]) => `<div><b>${ltr(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
    </div>
    ${pno(true)}
  </section>`;

  const overview = `
  <section class="page vsplit">
    <div class="vsplit__text">
      ${head()}
      <p class="eyebrow">${esc(s.overview)}</p>
      <h2>${esc(c.tagline)}</h2>
      <p class="vlong">${esc(c.longDescription)}</p>
    </div>
    <div class="vsplit__photo"><img src="${photo(IMG("sunset"), 1400)}" alt=""></div>
  </section>`;

  const levels = (project.floorPlan || [])
    .map((f, i) => ({ ...f, name: c.floorPlan[i].name, features: c.floorPlan[i].features, i }))
    .filter((f) => f.gross);
  const levelPage = (f) => {
    const pics = LEVEL_PHOTOS[f.i] || [];
    return `
  <section class="page vlevel${pics.length === 1 ? " vlevel--one" : ""}">
    <div class="vlevel__photos">${pics.map((p) => `<img src="${photo(IMG(p), 1400)}" alt="">`).join("")}</div>
    <div class="vlevel__text">
      ${head()}
      <span class="vlevel__no">${num(f.i + 1)}</span>
      <p class="eyebrow">${esc(s.floor)} ${ltr(num(f.i + 1))} / ${ltr("04")}</p>
      <h2>${esc(f.name)}</h2>
      <div class="vareas">
        <div><b>${ltr(f.gross)}</b><span>${esc(s.gross)}</span></div>
        <div><b>${ltr(f.net)}</b><span>${esc(s.net)}</span></div>
      </div>
      <ul class="vlist">${f.features.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>
  </section>`;
  };

  const roof = c.floorPlan[4];
  const rooftop = roof
    ? `
  <section class="page vfull vfull--roof">
    <img class="bg" src="${photo(IMG("terrace"), 2400)}" alt="" style="object-position: center 68%">
    <div class="vfull__shade"></div>
    <div class="vfull__body">
      <p class="eyebrow">${esc(c.floorPlan[3].name)}</p>
      <h2>${esc(roof.name)}</h2>
      <div class="rule"></div>
      <ul class="vlist vlist--light">${roof.features.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>
    ${pno(true)}
  </section>`
    : "";

  const gallery = (title, sub, names, cls) => `
  <section class="page vgal ${cls}">
    ${head()}
    <div class="vgal__title"><p class="eyebrow">${esc(title)}</p>${sub ? `<h2>${esc(sub)}</h2>` : ""}</div>
    <div class="vgal__grid">${names.map((n) => `<img src="${photo(IMG(n), 1200)}" alt="">`).join("")}</div>
  </section>`;
  const inside = gallery(s.inside, s.insideSub, ["entrance", "living-fireplace", "kitchen", "hall", "bedroom-2", "living-room"], "vgal--six");
  const outside = gallery(s.outside, c.highlights[3], ["garden-wide", "private-pool", "pool-deck", "balcony-pool", "side-entrance"], "vgal--five");

  const features = `
  <section class="page vsplit vsplit--rev">
    <div class="vsplit__photo"><img src="${photo(IMG("aerial-top"), 1400)}" alt=""></div>
    <div class="vsplit__text">
      ${head()}
      <p class="eyebrow">${esc(s.features)}</p>
      <h2>${esc(t("projectDetail.amenitiesTitle"))}</h2>
      <div class="vfeat">${(project.amenities || [])
        .map((k) => `<div><span class="ico">${icons.amenityIcon(k)}</span><b>${esc(t(`projectDetail.amenities.${k}`))}</b></div>`)
        .join("")}</div>
    </div>
  </section>`;

  const v = project.verified;
  const vlabels = t("projectDetail.verified.labels");
  const updated = new Intl.DateTimeFormat(rtl ? "ar-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v.updated));
  const verified = `
  <section class="page vver">
    ${head()}
    <div class="vver__top">
      <div><p class="eyebrow">${esc(t("projectDetail.verified.badge"))}</p><h2>${esc(t("projectDetail.verified.title"))}</h2><p class="lead">${esc(t("projectDetail.verified.subtitle"))}</p></div>
      <span class="vver__date">${esc(t("projectDetail.verified.updated").replace("{date}", updated))}</span>
    </div>
    <div class="vver__grid">${v.items
      .map((k) => `<div><span>${esc(vlabels[k])}</span><b>${esc(c.verified[k])}</b></div>`)
      .join("")}</div>
    <p class="small">${esc(t("projectDetail.verified.note"))}</p>
  </section>`;

  const location = `
  <section class="page vsplit">
    <div class="vsplit__text">
      ${head()}
      <p class="eyebrow">${esc(s.location)}</p>
      <h2>${esc(where)}</h2>
      <p class="lead">${esc(s.locationSub)}</p>
      <div class="vnear">${c.nearby.map((x) => `<div><b>${ltr(x.time)}</b><span>${esc(x.place)}</span></div>`).join("")}</div>
    </div>
    <div class="vsplit__photo"><img src="${photo(IMG("drone"), 1600)}" alt=""></div>
  </section>`;

  const priceText = project.price === "on-request" ? t("projectDetail.priceOnRequest") : project.price;
  const viewing = `
  <section class="page vview">
    <div class="vview__photo"><img src="${photo(IMG("living-sea"), 1400)}" alt=""></div>
    <div class="vview__text">
      ${head()}
      <p class="eyebrow">${esc(s.viewing)}</p>
      <h2>${esc(c.videoTitle)}</h2>
      <p class="lead">${esc(c.videoText)}</p>
      <div class="vprice"><span>${esc(s.price)}</span><b>${ltr(priceText)}</b><p>${esc(t("projectDetail.priceNote"))}</p></div>
      <div class="qrs qrs--dark">
        <div class="qr">${qrSvg(pageUrl, "25mm")}<span>${esc(s.scanVideo)}</span></div>
        <div class="qr">${qrSvg(waUrl, "25mm")}<span>${esc(s.scanWa)}</span></div>
      </div>
    </div>
  </section>`;

  const back = `
  <section class="page back">
    <img class="bg" src="${photo(IMG("dusk-pool"), 2400)}" alt="">
    <div class="shade shade--full"></div>
    <div class="back__body">
      ${brand("light")}
      <h2>${esc(s.contact)}</h2>
      <p class="sub">${esc(c.name)} · ${esc(where)}</p>
      <dl>
        <div><dt>${esc(s.phone)}</dt><dd>${ltr(PHONE)}</dd></div>
        <div><dt>${esc(s.email)}</dt><dd>${ltr(EMAIL)}</dd></div>
        <div><dt>${esc(s.address)}</dt><dd>${esc(t("contact.address"))}</dd></div>
        <div><dt>${esc(s.hours)}</dt><dd>${esc(t("contact.hoursText"))}</dd></div>
      </dl>
      <p class="note">${esc(s.note)}</p>
    </div>
  </section>`;

  const body = [cover, glance, overview, ...levels.map(levelPage), rooftop, inside, outside, features, verified, location, viewing, back]
    .filter(Boolean)
    .map((html, i) => html.replace("@@PNO@@", num(i + 1)))
    .join("\n");
  return pageHtml(lang, `${latin} — HADARA Real Estate`, body, ["catalog.css", "villa.css"]);
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["ar", "en"];
const { projects } = await loadTs("src/data/projects.ts");
const icons = await loadTs("src/components/amenityIcons.ts");
const project = projects.find((p) => p.slug === SLUG);
const en = loadDict("en");
const pairs = [];
for (const lang of langs) {
  const dict = loadDict(lang);
  dict.__en = en;
  const file = path.join(out, `villa-${lang}.html`);
  fs.writeFileSync(file, build(lang, project, icons, dict));
  pairs.push([file, path.join(out, `Marmara-Haven-Villa-${lang}.pdf`)]);
}
await renderPdfs(pairs);
