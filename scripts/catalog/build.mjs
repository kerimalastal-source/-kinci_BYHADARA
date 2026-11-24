// Builds the HADARA Real Estate project catalogue as print-ready PDFs (A4 landscape),
// one per site language (ar, en, fa, fr, ru, de), from the site's own data:
//
//   node scripts/catalog/build.mjs [ar|en|fa|fr|ru|de ...]   (default: all six)
//
// Every fact comes from src/data/projects.ts and src/i18n/<lang>.json, so the catalogue
// stays in line with the website. Sold-out projects are left out and no prices are
// printed (prices change; the back page says they are on request). Photos are resized to
// JPEG by scripts/catalog/photos.py (Pillow; set PYTHON if python3 has no Pillow).
// Output: scripts/catalog/out/HADARA-Real-Estate-Catalogue-<lang>.pdf (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { out, SITE, YEAR, PHONE, EMAIL, WHATSAPP, loadTs, loadDict, lookup, esc, ltr, placeKey, isRtl, num, photo, qrSvg, brand, pageHtml, renderPdfs, PDF_SUFFIX } from "./lib.mjs";

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
  },
  fa: {
    title: "پروژه‌های ما در استانبول",
    subtitle: "کاتالوگ پروژه‌ها",
    partner: "شریک توسعه و بازاریابی املاک در استانبول",
    about: "درباره ما",
    index: "پروژه‌ها",
    indexSub: "گزیده‌ای از برجسته‌ترین پروژه‌های مسکونی استانبول، در هر دو سوی شهر",
    sectionA: "پروژه‌های تازه عرضه‌شده و در حال ساخت",
    sectionASub: "طرح‌های پرداخت منعطف در پروژه‌های منتخب، با خانه‌هایی که در سال‌های آینده تحویل می‌شوند",
    sectionB: "آماده سکونت",
    sectionBSub: "مجتمع‌های تکمیل‌شده و ویلاهای آماده، با واحدهایی که هم‌اکنون قابل خرید هستند",
    projectsWord: "پروژه",
    signature: "ساخته‌شده توسط حضارا",
    layouts: "انواع واحدها",
    scan: "برای جزئیات و تصاویر پروژه، کد را اسکن کنید",
    page: "صفحه",
    services: "خدمات ما",
    citizenship: "شهروندی ترکیه از طریق خرید ملک",
    contact: "تماس با ما",
    contactSub: "تیم ما با کمال میل در انتخاب پروژه مناسب و هماهنگی بازدید در استانبول یا تور ویدیویی خصوصی به شما کمک می‌کند.",
    phone: "تلفن و واتساپ",
    email: "ایمیل",
    address: "دفتر",
    hours: "ساعات کاری",
    web: "وب‌سایت",
    scanWa: "واتساپ",
    scanWeb: "همه پروژه‌ها",
    note: "اطلاعات و تصاویر از سازندگان گرفته شده و ممکن است تغییر کند؛ برخی تصاویر طرح‌های معماری هستند. قیمت‌ها در صورت درخواست.",
    citizenshipNote: "شرایط طبق قانون فعلی است و ممکن است تغییر کند.",
    edition: `نسخه ${YEAR}`
  },
  fr: {
    title: "Nos projets à Istanbul",
    subtitle: "Catalogue des projets",
    partner: "Partenaire de développement et de commercialisation immobilière à Istanbul",
    about: "À propos",
    index: "Les projets",
    indexSub: "Une sélection des principaux projets résidentiels d'Istanbul, des deux côtés de la ville",
    sectionA: "Nouveaux lancements et projets en construction",
    sectionASub: "Des plans de paiement flexibles sur une sélection de projets, avec des logements livrés au cours des prochaines années",
    sectionB: "Prêts à habiter",
    sectionBSub: "Résidences achevées et villas terminées, avec des logements disponibles dès maintenant",
    projectsWord: "projets",
    signature: "Développé par HADARA",
    layouts: "Types de logements",
    scan: "Scannez pour voir les détails et les photos du projet",
    page: "Page",
    services: "Ce que nous vous offrons",
    citizenship: "La citoyenneté turque par l'immobilier",
    contact: "Contactez-nous",
    contactSub: "Notre équipe vous aidera volontiers à choisir le bon projet et à organiser une visite à Istanbul ou une visite vidéo privée.",
    phone: "Téléphone et WhatsApp",
    email: "E-mail",
    address: "Bureau",
    hours: "Horaires",
    web: "Site web",
    scanWa: "WhatsApp",
    scanWeb: "Tous les projets",
    note: "Les informations et les images proviennent des promoteurs et peuvent changer ; certaines images sont des perspectives de conception. Prix sur demande.",
    citizenshipNote: "Conditions selon la loi en vigueur, susceptibles de changer.",
    edition: `Édition ${YEAR}`
  },
  ru: {
    title: "Наши проекты в Стамбуле",
    subtitle: "Каталог проектов",
    partner: "Партнёр по девелопменту и маркетингу недвижимости в Стамбуле",
    about: "О нас",
    index: "Проекты",
    indexSub: "Подборка ведущих жилых проектов Стамбула на обеих сторонах города",
    sectionA: "Новые проекты и строящиеся объекты",
    sectionASub: "Гибкие планы оплаты в избранных проектах и дома со сдачей в ближайшие годы",
    sectionB: "Готовы к заселению",
    sectionBSub: "Завершённые комплексы и готовые виллы с квартирами, доступными уже сейчас",
    projectsWord: "проектов",
    signature: "Девелопер — HADARA",
    layouts: "Типы квартир",
    scan: "Отсканируйте, чтобы увидеть детали и фото проекта",
    page: "Стр.",
    services: "Что мы предлагаем",
    citizenship: "Гражданство Турции через недвижимость",
    contact: "Свяжитесь с нами",
    contactSub: "Наша команда с радостью поможет выбрать подходящий проект и организует просмотр в Стамбуле или частный видеотур.",
    phone: "Телефон и WhatsApp",
    email: "Эл. почта",
    address: "Офис",
    hours: "Часы работы",
    web: "Сайт",
    scanWa: "WhatsApp",
    scanWeb: "Все проекты",
    note: "Информация и изображения предоставлены застройщиками и могут меняться; часть изображений — визуализации. Цены по запросу.",
    citizenshipNote: "Условия согласно действующему законодательству и могут измениться.",
    edition: `Издание ${YEAR}`
  },
  de: {
    title: "Unsere Projekte in Istanbul",
    subtitle: "Projektkatalog",
    partner: "Partner für Immobilienentwicklung und -vermarktung in Istanbul",
    about: "Über uns",
    index: "Die Projekte",
    indexSub: "Eine Auswahl der führenden Wohnprojekte Istanbuls, auf beiden Seiten der Stadt",
    sectionA: "Neue Projekte und Projekte im Bau",
    sectionASub: "Flexible Zahlungspläne bei ausgewählten Projekten, mit Übergabe der Wohnungen in den kommenden Jahren",
    sectionB: "Bezugsfertig",
    sectionBSub: "Fertiggestellte Wohnanlagen und Villen, mit sofort verfügbaren Wohnungen",
    projectsWord: "Projekte",
    signature: "Entwickelt von HADARA",
    layouts: "Wohnungstypen",
    scan: "Scannen Sie für Details und Fotos des Projekts",
    page: "Seite",
    services: "Was wir Ihnen bieten",
    citizenship: "Türkische Staatsbürgerschaft durch Immobilien",
    contact: "Kontakt",
    contactSub: "Unser Team hilft Ihnen gern, das passende Projekt zu finden, und organisiert eine Besichtigung in Istanbul oder eine private Videobesichtigung.",
    phone: "Telefon & WhatsApp",
    email: "E-Mail",
    address: "Büro",
    hours: "Öffnungszeiten",
    web: "Website",
    scanWa: "WhatsApp",
    scanWeb: "Alle Projekte",
    note: "Angaben und Bilder stammen von den Bauträgern und können sich ändern; einige Bilder sind Visualisierungen. Preise auf Anfrage.",
    citizenshipNote: "Bedingungen nach aktueller Rechtslage, Änderungen vorbehalten.",
    edition: `Ausgabe ${YEAR}`
  }
};

function build(lang, mod, dict) {
  const s = STR[lang];
  const t = lookup(dict);
  const rtl = isRtl(lang);
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
    const latin = lang === "en" || dict.__en.projectsData[p.slug].name === c.name ? "" : dict.__en.projectsData[p.slug].name;
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

  return pageHtml(lang, `HADARA Real Estate — ${s.subtitle}`, body, ["catalog.css"]);
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STR);
const mod = await loadTs("src/data/projects.ts");
const en = loadDict("en");
const pairs = [];
for (const lang of langs) {
  const dict = loadDict(lang);
  dict.__en = en;
  const file = path.join(out, `catalogue-${lang}.html`);
  fs.writeFileSync(file, build(lang, mod, dict));
  pairs.push([file, path.join(out, `HADARA-Real-Estate-Catalogue-${lang}${PDF_SUFFIX}.pdf`)]);
}
await renderPdfs(pairs);
