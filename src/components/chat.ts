import { t, tRaw, link, getProjectContent, placeLine, onLocaleChange, locales, intlTag } from "../i18n";
import { lookup } from "../i18n/dictionaries";
import { getProjectBySlug, getSortedProjects, type Project, type Residence } from "../data/projects";
import { projectStatusLabel } from "./projectCard";
import { WHATSAPP_NUMBER, WHATSAPP_ICON } from "./floatingButtons";
import { HEART_ICON, isFavorite } from "./favorites";
import { escapeHtml, isolateNumbers } from "../utils/html";
import { toWesternDigits } from "../utils/numbers";
import { placeKey } from "../utils/place";
import { consultancyPath, parseRoute, splitLocale } from "../seo/routes";
import { videoTourHref, VIDEO_TOUR_ICON } from "./videoTourInvite";
import { photoAttrs } from "../utils/responsiveImage";
import {
  hasLiveChat,
  liveDetails,
  liveMessages,
  liveUnread,
  markLiveSeen,
  onLiveChange,
  sendLive,
  setLiveDetails,
  skipLiveDetails,
  startLivePolling,
  type LiveMessage,
  type SendResult
} from "./liveChat";

/**
 * Guided chat assistant: answers from the site's own data (projects, citizenship, contact)
 * in every language, and hands anything it can't answer to the team on WhatsApp.
 * The conversation is stored as locale-free entries so it re-renders in a new language.
 */

type Filter = "all" | "new" | "ready" | "villas";
type Topic = "greeting" | "menu" | "citizenship" | "design" | "tour" | "contact" | "thanks";
/** Questions about one project, answered from its own data. */
type InfoTopic = "delivery" | "units" | "location" | "amenities" | "citizenship" | "legal" | "price" | "tour";

type Entry =
  | { from: "user"; text: string }
  | { from: "user"; key: string; slug?: string }
  | { from: "bot"; kind: Topic }
  | { from: "bot"; kind: "here"; slug: string }
  | { from: "bot"; kind: "info"; slug: string; topic: InfoTopic }
  | { from: "bot"; kind: "fallback"; query: string }
  | { from: "bot"; kind: "projects"; filter: Filter; intro?: "price" | "matched" | "district"; slugs?: string[] }
  | { from: "bot"; kind: "project"; slug: string };

const STORE_KEY = "hadara-chat";
/** "live" while the visitor is talking with the team (liveChat.ts), else the assistant. */
const MODE_KEY = "hadara-chat-mode";
const SEEN_KEY = "hadara-chat-seen";
const MOBILE = "(max-width: 640px)";

export const CHAT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.9-.8L3 20.5l1.4-4.2A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke-width="2.6"/></svg>`;
const CLOSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const RESTART_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;
const SEND_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>`;

let entries: Entry[] = load();
let mode: "bot" | "live" = loadMode();
/** The last send's problem, shown under the conversation until the next send. */
let liveNotice: SendResult | null = null;

function loadMode(): "bot" | "live" {
  try {
    return sessionStorage.getItem(MODE_KEY) === "live" ? "live" : "bot";
  } catch {
    return "bot";
  }
}

function setMode(next: "bot" | "live"): void {
  mode = next;
  try {
    sessionStorage.setItem(MODE_KEY, next);
  } catch {
    // storage unavailable
  }
}
let panel: HTMLElement | null = null;
let open = false;
let typing = false;

function load(): Entry[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Entry[];
  } catch {
    // storage unavailable or corrupt
  }
  return [];
}

function save(): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(entries.slice(-40)));
  } catch {
    // storage unavailable
  }
}

function wasSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/* ---------- Understanding free text ---------- */

/** Lower-case, accent- and hamza-free form with Western digits, so "Beylikdüzü", "beylikduzu" and "أسعار"/"اسعار" match. */
function normalize(text: string): string {
  return toWesternDigits(text)
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    // Persian ی / ک are the same letters as Arabic ي / ك for matching.
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const tokens = (text: string) => normalize(text).split(" ").filter(Boolean);

/** Words shared by many project names; they never pick a project on their own. */
const GENERIC = new Set(["lotus", "لوتس", "лотос", "villa", "فيلا", "вилла", "the", "de", "la", "لوتوس", "ویلا", "ویلای"].map(normalize));

interface IndexedProject {
  project: Project;
  names: string[];
  words: Set<string>;
  district: Set<string>;
}

let index: IndexedProject[] | null = null;

function projectIndex(): IndexedProject[] {
  if (index) return index;
  const districtWords = new Set<string>();
  const base = getSortedProjects().map((project) => {
    const names = locales.map((l) => normalize(String(lookup(l, `projectsData.${project.slug}.name`) ?? ""))).filter(Boolean);
    const district = new Set(
      locales.flatMap((l) => tokens(String(lookup(l, `places.${placeKey(project.district)}`) ?? project.district))).concat(tokens(project.district))
    );
    district.forEach((w) => districtWords.add(w));
    return { project, names, district };
  });
  index = base.map((p) => ({
    ...p,
    // A district name inside a project name ("Lotus Manzara Beylikdüzü") only breaks ties.
    words: new Set(p.names.flatMap((n) => n.split(" ")).filter((w) => !GENERIC.has(w) && !districtWords.has(w) && (w.length > 1 || /\d/.test(w))))
  }));
  return index;
}

/** Projects the text names: the best-scoring ones, or none. */
function matchProjects(text: string): string[] {
  const q = normalize(text);
  const qWords = new Set(q.split(" "));
  const padded = ` ${q} `;
  const scored = projectIndex().map(({ project, names, words, district }) => {
    let score = 0;
    for (const name of names) if (padded.includes(` ${name} `)) score = Math.max(score, 100 + name.length);
    for (const w of words) if (qWords.has(w)) score += 10;
    if (score > 0) for (const w of district) if (qWords.has(w)) score += 1;
    return { slug: project.slug, score };
  });
  const best = Math.max(...scored.map((s) => s.score));
  return best > 0 ? scored.filter((s) => s.score === best).map((s) => s.slug) : [];
}

/** Projects in a district the text names (e.g. "Şişli", "بيليكدوزو"). */
function matchDistrict(text: string): string[] {
  const qWords = new Set(tokens(text));
  return projectIndex()
    .filter(({ district }) => [...district].some((w) => w.length > 2 && qWords.has(w)))
    .map(({ project }) => project.slug);
}

const KEYWORDS: Record<string, string[]> = {
  citizenship: ["شهروندی", "تابعیت", "پاسپورت", "گذرنامه", "citizen", "passport", "nationality", "جنسيه", "جواز", "citoyen", "nationalite", "passeport", "граждан", "паспорт"],
  design: ["طراحی", "معماری", "مهندسی", "دکوراسیون", "بازسازی", "نوسازی", "design", "architect", "engineer", "interior", "render", "renovat", "redesign", "3d", "تصميم", "معماري", "عماره", "هندس", "ديكور", "داخلي", "ترميم", "conception", "ingenier", "interieur", "renovation", "архитект", "проектирован", "дизайн", "интерьер", "инженер", "ремонт", "реконструк"],
  contact: ["تماس", "تلفن", "شماره", "واتساپ", "مشاور", "کارشناس", "صحبت", "contact", "call", "phone", "whatsapp", "speak", "agent", "advisor", "تواصل", "اتصل", "اتصال", "هاتف", "تلفون", "تليفون", "رقمكم", "واتس", "موظف", "مستشار", "appel", "telephone", "conseill", "связ", "позвон", "телефон", "ватсап", "менеджер"],
  price: ["قیمت", "هزینه", "چقدر", "بودجه", "مبلغ", "price", "cost", "how much", "budget", "سعر", "اسعار", "ثمن", "بكم", "تكلف", "ميزاني", "prix", "cout", "combien", "tarif", "цен", "стоим", "сколько", "бюджет"],
  villas: ["ویلا", "villa", "فيلا", "فلل", "فيلل", "вилл"],
  new: ["جدید", "پیش فروش", "در حال ساخت", "new", "launch", "off plan", "offplan", "under construction", "جديد", "اطلاق", "قيد الانشاء", "على المخطط", "nouveau", "neuf", "lancement", "construction", "нов", "строящ"],
  ready: ["آماده", "تکمیل", "تحویل فوری", "ready", "move in", "completed", "جاهز", "مكتمل", "منجز", "فوري", "pret", "livre", "termine", "готов", "сдан"],
  projects: ["پروژه", "جزئیات", "اطلاعات", "آپارتمان", "ملک", "خانه", "project", "detail", "info", "option", "available", "apartment", "flat", "property", "properties", "home", "house", "deliver", "handover", "مشروع", "مشاريع", "تفاصيل", "معلومات", "عقار", "شقق", "شقه", "متاح", "بيت", "منزل", "تسليم", "projet", "appartement", "maison", "bien", "livraison", "проект", "подроб", "квартир", "информац", "дом", "сдач", "срок"],
  tour: ["ویدیو", "ویدئو", "بازدید", "video", "tour", "zoom", "facetime", "فيديو", "جولة", "جوله", "زوم", "vidéo", "visite", "видео", "тур", "экскурс"],
  thanks: ["ممنون", "مرسی", "سپاس", "متشکر", "thank", "thx", "شكرا", "مشكور", "يعطيك", "تسلم", "merci", "спасибо", "благодар"],
  greeting: ["سلام", "درود", "وقت بخیر", "روز بخیر", "hello", "hi", "hey", "مرحبا", "اهلا", "السلام", "سلام", "هلا", "مساء", "صباح", "bonjour", "salut", "bonsoir", "привет", "здравств", "добрый"]
};

/** What a question about one project is about ("when is it ready?" on a project page). */
const TOPIC_KEYWORDS: Record<Exclude<InfoTopic, "citizenship" | "price" | "tour">, string[]> = {
  legal: ["طابو", "مجوز", "پایان کار", "مدارک", "قانونی", "زلزله", "وام", "deed", "tapu", "title", "permit", "iskan", "document", "legal", "licen", "earthquake", "lien", "mortgage", "طابو", "سند", "ملكيه", "رخصه", "ترخيص", "اسكان", "وثائق", "مستندات", "اوراق", "قانوني", "زلزال", "رهن", "titre", "permis", "sism", "hypothe", "тапу", "документ", "разрешен", "землетр", "ипотек", "залог"],
  delivery: ["تحویل", "چه زمانی", "کی آماده", "تکمیل", "deliver", "handover", "ready", "when", "complet", "finish", "تسليم", "استلام", "جاهز", "متى", "امتى", "اكتمال", "livraison", "livre", "pret", "quand", "сдач", "готов", "когда", "срок"],
  units: ["واحد", "خواب", "اتاق", "متراژ", "انواع", "unit", "layout", "room", "bedroom", "size", "sqm", "m2", "floor plan", "type", "وحد", "غرف", "غرفه", "مساح", "متر", "نوع", "انواع", "مخطط", "piece", "chambre", "surface", "superficie", "typolog", "планиров", "комнат", "площад", "метр", "тип"],
  location: ["کجا", "موقعیت", "آدرس", "نشانی", "فاصله", "فرودگاه", "ساحل", "نزدیک", "where", "location", "address", "far", "distance", "airport", "metro", "beach", "near", "map", "وين", "اين", "موقع", "مكان", "عنوان", "بعيد", "قريب", "مطار", "مترو", "خريطه", "emplacement", "adresse", "aeroport", "proche", "carte", "где", "располож", "адрес", "аэропорт", "метро", "рядом", "карт"],
  amenities: ["امکانات", "استخر", "باشگاه", "پارکینگ", "نگهبانی", "امنیت", "باغ", "سونا", "amenit", "facilit", "pool", "gym", "fitness", "parking", "security", "garden", "sauna", "مرافق", "مسبح", "مسابح", "جيم", "رياضه", "موقف", "مراب", "حراسه", "حديقه", "ساونا", "piscine", "sport", "securite", "jardin", "equipement", "бассейн", "спортзал", "фитнес", "парков", "охран", "инфраструкт"]
};

/** Asking about other or all projects, not the one in view. */
const GENERAL_WORDS = ["projects", "other", "another", "all", "مشاريع", "اخرى", "ثاني", "كل", "projets", "autre", "tous", "проекты", "друг", "все", "پروژه ها", "دیگر", "همه"];

/** Latin keywords match at the start of a word ("citizen" finds "citizenship"); others anywhere (Arabic prefixes like "بال"). */
function has(q: string, group: keyof typeof KEYWORDS): boolean {
  return matches(q, KEYWORDS[group]);
}

function matches(q: string, words: string[]): boolean {
  const padded = ` ${q}`;
  // Keywords are compared in the same normalized form as the question ("وثائق" → "وثايق").
  return words.map(normalize).some((kw) => {
    if (!/^[a-z ]+$/.test(kw)) return q.includes(kw);
    // Very short greetings must be whole words ("hi" is not "history").
    return kw.length <= 3 ? ` ${q} `.includes(` ${kw} `) : padded.includes(` ${kw}`);
  });
}

function detectTopic(q: string): InfoTopic | undefined {
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) if (matches(q, words)) return topic as InfoTopic;
  if (has(q, "citizenship")) return "citizenship";
  if (has(q, "price")) return "price";
  if (has(q, "tour")) return "tour";
  return undefined;
}

function reply(text: string): Entry {
  const q = normalize(text);
  const named = matchProjects(text);
  const topic = detectTopic(q);
  if (named.length === 1) return topic ? { from: "bot", kind: "info", slug: named[0], topic } : { from: "bot", kind: "project", slug: named[0] };
  // "When is it ready?" about the project on screen, or the one just discussed.
  const context = contextSlug();
  if (!named.length && context && topic && !matches(q, GENERAL_WORDS)) return { from: "bot", kind: "info", slug: context, topic };
  if (named.length > 1) return { from: "bot", kind: "projects", filter: "all", intro: "matched", slugs: named };
  if (has(q, "citizenship")) return { from: "bot", kind: "citizenship" };
  if (has(q, "design")) return { from: "bot", kind: "design" };
  if (has(q, "tour")) return { from: "bot", kind: "tour" };
  if (has(q, "villas")) return { from: "bot", kind: "projects", filter: "villas" };
  const inDistrict = matchDistrict(text);
  if (inDistrict.length === 1) return { from: "bot", kind: "project", slug: inDistrict[0] };
  if (inDistrict.length) return { from: "bot", kind: "projects", filter: "all", intro: "district", slugs: inDistrict };
  if (has(q, "price")) return { from: "bot", kind: "projects", filter: "all", intro: "price" };
  if (has(q, "contact")) return { from: "bot", kind: "contact" };
  if (has(q, "new")) return { from: "bot", kind: "projects", filter: "new" };
  if (has(q, "ready")) return { from: "bot", kind: "projects", filter: "ready" };
  if (has(q, "projects")) return { from: "bot", kind: "projects", filter: "all" };
  if (has(q, "thanks")) return { from: "bot", kind: "thanks" };
  if (has(q, "greeting")) return { from: "bot", kind: "greeting" };
  return { from: "bot", kind: "fallback", query: text.slice(0, 300) };
}

/** The project whose page is open, if any. */
function pageProject(): string | undefined {
  const route = parseRoute(splitLocale(window.location.pathname).path);
  return route.name === "project" && getProjectBySlug(route.slug) ? route.slug : undefined;
}

/** The project the last answer was about. */
function lastProjectSlug(): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.from === "bot" && "slug" in e) return e.slug;
    if (e.from === "bot") return undefined;
  }
  return undefined;
}

const contextSlug = () => pageProject() ?? lastProjectSlug();

/* ---------- Rendering ---------- */

const whatsappHref = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
const projectUrl = (slug: string) => `${window.location.origin}${link(`/projects/${slug}`)}`;

function isVillaProject(p: Project): boolean {
  return p.slug.includes("villa") || !!p.residences?.some((r) => r.kind === "villa");
}

function filterProjects(filter: Filter): Project[] {
  const all = getSortedProjects();
  switch (filter) {
    case "new":
      return all.filter((p) => p.status !== "delivered");
    case "ready":
      return all.filter((p) => p.status === "delivered" && !p.soldOut);
    case "villas":
      return all.filter(isVillaProject);
    default:
      // Sold-out projects stay reachable, listed last.
      return [...all.filter((p) => !p.soldOut), ...all.filter((p) => p.soldOut)];
  }
}

function statusLine(p: Project): string {
  if (p.soldOut) return t("common.soldOut");
  return p.unitsAvailable ? `${projectStatusLabel(p.status)} · ${t("common.unitsAvailable")}` : projectStatusLabel(p.status);
}

function renderProjectOption(p: Project): string {
  const content = getProjectContent(p.slug);
  return `
    <button type="button" class="chat-option${p.soldOut ? " is-sold" : ""}" data-chat-project="${p.slug}">
      <img ${photoAttrs(p.coverImage, "56px")} alt="" width="56" height="56" loading="lazy" />
      <span class="chat-option__text">
        <strong>${content.name}</strong>
        <span>${placeLine(p.district, p.city)}</span>
        <span class="chat-option__status${p.soldOut ? " is-sold" : p.unitsAvailable || p.status !== "delivered" ? " is-live" : ""}">${statusLine(p)}</span>
      </span>
    </button>`;
}

function renderProjects(entry: Extract<Entry, { kind: "projects" }>): string {
  const list = entry.slugs
    ? entry.slugs.map((s) => getProjectBySlug(s)).filter((p): p is Project => !!p)
    : filterProjects(entry.filter).filter((p) => entry.intro !== "price" || !p.soldOut);
  const intro = entry.intro ? t(`chat.intro.${entry.intro}`) : t(`chat.projectsIntro.${entry.filter}`);
  const filters = entry.slugs
    ? ""
    : `<div class="chat-filters" role="group">${(["all", "new", "ready", "villas"] as Filter[])
        .map((f) => `<button type="button" class="chat-filter" data-chat-filter="${f}" aria-pressed="${f === entry.filter}">${t(`chat.filters.${f}`)}</button>`)
        .join("")}</div>`;
  return `<p>${intro}</p>${filters}<div class="chat-options">${list.map(renderProjectOption).join("")}</div>`;
}

function renderProject(slug: string): string {
  const p = getProjectBySlug(slug);
  if (!p) return `<p>${t("chat.fallback")}</p>`;
  const content = getProjectContent(slug);
  const delivery = p.stats.find((s) => s.labelKey === "delivery");
  const facts: { label: string; value: string; ltr?: boolean }[] = [{ label: t("common.status"), value: statusLine(p) }];
  if (delivery) facts.push({ label: t("common.statLabels.delivery"), value: delivery.value, ltr: true });
  else if (p.timeline) facts.push({ label: t("common.timeline"), value: p.timeline, ltr: true });
  for (const s of p.stats.filter((s) => s.labelKey !== "delivery").slice(0, 3)) {
    facts.push({ label: t(`common.statLabels.${s.labelKey}`), value: s.value, ltr: true });
  }
  if (p.price) {
    facts.push(
      p.price === "on-request"
        ? { label: t("projectDetail.priceLabel"), value: t("projectDetail.priceOnRequest") }
        : { label: t("projectDetail.priceLabel"), value: p.price, ltr: true }
    );
  }

  const primary = p.soldOut
    ? `<a class="chat-action chat-action--wa" href="${whatsappHref(`${t("chat.waSimilar", { name: content.name })}\n${projectUrl(slug)}`)}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.similar")}</a>
       <button type="button" class="chat-action" data-chat-filter="ready">${t("chat.actions.available")}</button>`
    : `<a class="chat-action chat-action--wa" href="${whatsappHref(`${t("chat.waPrice", { name: content.name })}\n${projectUrl(slug)}`)}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.price")}</a>`;
  const save = p.soldOut
    ? ""
    : `<button type="button" class="chat-action chat-action--fav" data-fav="${slug}" aria-pressed="${isFavorite(slug)}" aria-label="${t(isFavorite(slug) ? "favorites.remove" : "favorites.add", { name: content.name })}">${HEART_ICON}<span class="chat-action__off">${t("chat.actions.save")}</span><span class="chat-action__on">${t("chat.actions.saved")}</span></button>`;

  return `
    <p>${t("chat.projectIntro", { name: content.name })}</p>
    <article class="chat-card">
      <img class="chat-card__img" ${photoAttrs(p.coverImage, "(max-width: 640px) 100vw, 360px")} alt="${p.coverImage.alt}" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
      <div class="chat-card__body">
        <h3 class="chat-card__title">${content.name}</h3>
        <p class="chat-card__place">${placeLine(p.district, p.city)}</p>
        <p class="chat-card__tagline">${content.tagline}</p>
        <dl class="chat-card__facts">
          ${facts.map((f) => `<div><dt>${f.label}</dt><dd${f.ltr ? ' dir="ltr"' : ""}>${f.value}</dd></div>`).join("")}
        </dl>
        ${p.soldOut ? `<p class="chat-card__note">${t("chat.soldOutNote")}</p>` : ""}
      </div>
    </article>
    <div class="chat-actions">
      ${primary}
      <a class="chat-action" href="${link(`/projects/${slug}`)}">${t("chat.actions.details")}</a>
      ${p.soldOut ? "" : `<a class="chat-action chat-action--tour" href="${videoTourHref([slug])}">${VIDEO_TOUR_ICON}${t("videoTour.chat.bookProject")}</a>`}
      ${save}
      <button type="button" class="chat-action chat-action--ghost" data-chat-filter="all">${t("chat.actions.more")}</button>
    </div>`;
}

function residenceTitle(r: Residence): string {
  if (r.kind === "office") return t(r.layout === "open" ? "projectDetail.officeOpen" : "projectDetail.officeClosed");
  return t(r.kind === "villa" ? "projectDetail.residenceVilla" : "projectDetail.residenceApartment", { layout: `<bdi dir="ltr">${r.layout}</bdi>` });
}

/** Keeps a Latin term in brackets, e.g. "(Müstakil Tapu)", in reading order inside Arabic text. */
const isolateTerms = (text: string) => text.replace(/\(([^()]*[A-Za-z][^()]*)\)/g, '(<bdi dir="ltr">$1</bdi>)');

function verifiedDate(updated: string): string {
  const [y, m, d] = updated.split("-").map(Number);
  return new Intl.DateTimeFormat(intlTag(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** Topics the chat can answer for a project, in chip order. */
function projectTopics(p: Project): InfoTopic[] {
  const topics: InfoTopic[] = ["delivery", "units", "location"];
  if (p.amenities?.length) topics.push("amenities");
  topics.push("citizenship");
  if (p.verified) topics.push("legal");
  if (!p.soldOut) topics.push("price", "tour");
  return topics;
}

const factList = (rows: [string, string][]) =>
  `<dl class="chat-card__facts chat-card__facts--plain">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

function renderHere(slug: string): string {
  const p = getProjectBySlug(slug);
  if (!p) return `<p>${t("chat.greeting")}</p>`;
  const name = getProjectContent(slug).name;
  return `
    <div class="chat-here">
      <img ${photoAttrs(p.coverImage, "52px")} alt="" width="52" height="52" />
      <span class="chat-option__text">
        <strong>${name}</strong>
        <span>${placeLine(p.district, p.city)}</span>
        <span class="chat-option__status${p.soldOut ? " is-sold" : " is-live"}">${statusLine(p)}</span>
      </span>
    </div>
    <p>${t("chat.here", { name })}</p>`;
}

/** One question about one project, answered only from the site's data. */
function renderInfo(slug: string, topic: InfoTopic): string {
  const p = getProjectBySlug(slug);
  if (!p) return `<p>${t("chat.fallback")}</p>`;
  const content = getProjectContent(slug);
  const name = content.name;
  const url = projectUrl(slug);
  const askHref = whatsappHref(`${t("chat.waAsk", { name })}\n${url}`);
  const ask = `<a class="chat-action chat-action--wa" href="${askHref}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.info.ask")}</a>`;
  const head = `<p class="chat-bot__subtitle">${name} · ${t(`chat.topics.${topic}`)}</p>`;
  let body = "";
  let actions = "";

  switch (topic) {
    case "delivery": {
      const year = p.stats.find((s) => s.labelKey === "delivery")?.value;
      if (p.soldOut) body = `<p>${t("chat.info.soldOut", { name })}</p>`;
      else if (p.status === "delivered") {
        body = `<p>${t("chat.info.readyNow", { name })}</p>`;
        if (p.timeline) body += `<p>${t("common.timeline")}: <bdi dir="ltr">${p.timeline}</bdi></p>`;
        if (p.unitsAvailable) body += `<p>${t("chat.info.available")}</p>`;
      } else if (year) body = `<p>${t("chat.info.deliveryYear", { name, year: `<bdi dir="ltr">${year}</bdi>` })}</p>`;
      else body = `<p>${t("chat.info.deliveryAsk", { name })}</p>`;
      actions = ask;
      break;
    }
    case "units": {
      if (p.residences?.length) {
        body = `<p>${t("chat.info.unitsIntro", { name })}</p>${factList(
          p.residences.map((r) => [
            `${residenceTitle(r)}${r.variant ? ` · ${t("projectDetail.residenceVariant", { variant: r.variant })}` : ""}`,
            `<bdi dir="ltr">${r.gross}</bdi> <small>${t("projectDetail.grossAreaLabel")}</small>`
          ])
        )}`;
      } else if (p.floorPlan?.length && content.floorPlan?.length) {
        body = `<p>${t("chat.info.floorsIntro", { name })}</p>${factList(
          p.floorPlan.map((f, i) => [content.floorPlan![i]?.name ?? "", `<bdi dir="ltr">${f.gross}</bdi> <small>${t("projectDetail.grossAreaLabel")}</small>`])
        )}`;
      } else body = `<p>${t("chat.info.unitsAsk")}</p>`;
      const figures = p.stats.filter((s) => s.labelKey !== "delivery").slice(0, 4);
      if (figures.length) body += factList(figures.map((s) => [t(`common.statLabels.${s.labelKey}`), `<bdi dir="ltr">${s.value}</bdi>`]));
      actions = `${ask}<a class="chat-action" href="${link(`/projects/${slug}`)}">${t("chat.actions.details")}</a>`;
      break;
    }
    case "location": {
      body = `<p>${t("chat.info.locationIntro", { name, place: placeLine(p.district, p.city) })}</p>`;
      const nearby = content.nearby ?? [];
      if (nearby.length) {
        body += `<p class="chat-bot__subtitle">${t("chat.info.nearby")}</p><ul class="chat-list">${nearby
          .slice(0, 6)
          .map((n) => `<li>${n.place}${n.time ? ` · <bdi dir="ltr">${n.time}</bdi>` : ""}</li>`)
          .join("")}</ul>`;
      }
      actions =
        pageProject() === slug
          ? `<button type="button" class="chat-action" data-chat-scroll="project-location">${t("chat.info.seeMap")}</button>${ask}`
          : `<a class="chat-action" href="${link(`/projects/${slug}`)}">${t("chat.info.seeMap")}</a>${ask}`;
      break;
    }
    case "amenities": {
      body = `<p>${t("chat.info.amenitiesIntro", { name })}</p><ul class="chat-list chat-list--cols">${(p.amenities ?? [])
        .map((a) => `<li>${t(`projectDetail.amenities.${a}`)}</li>`)
        .join("")}</ul>`;
      actions = ask;
      break;
    }
    case "citizenship": {
      const confirmed = p.verified?.items.includes("citizenship") ? content.verified?.citizenship : undefined;
      body = confirmed
        ? `<p>${t("chat.info.citizenshipConfirmed", { name })}</p>${factList([[t("projectDetail.verified.labels.citizenship"), isolateTerms(confirmed)]])}<p class="chat-card__note">${t("chat.info.verifiedOn", { date: verifiedDate(p.verified!.updated) })}</p>`
        : `<p>${t("chat.info.citizenshipGeneric", { name })}</p>`;
      actions = `${ask}<a class="chat-action" href="${link("/citizenship")}">${t("chat.actions.guide")}</a>`;
      break;
    }
    case "legal": {
      const values = content.verified ?? {};
      const items = p.verified?.items.filter((k) => values[k]) ?? [];
      if (p.verified && items.length) {
        body = `<p>${t("chat.info.legalIntro", { name })}</p>${factList(
          items.map((k) => [isolateTerms(t(`projectDetail.verified.labels.${k}`)), isolateTerms(values[k])])
        )}<p class="chat-card__note">${t("chat.info.verifiedOn", { date: verifiedDate(p.verified.updated) })}</p>`;
      } else body = `<p>${t("chat.info.legalNone", { name })}</p>`;
      const docsHref = whatsappHref(`${t("projectDetail.verified.documentsMessage", { name })}\n${url}`);
      actions = `<a class="chat-action chat-action--wa" href="${docsHref}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("projectDetail.verified.documentsButton")}</a>`;
      break;
    }
    case "price": {
      body = `<p>${
        p.price === "on-request"
          ? t("chat.info.priceOnRequest", { name })
          : p.price
            ? t("chat.info.priceKnown", { name, price: `<bdi dir="ltr">${p.price}</bdi>` })
            : t("chat.info.priceText", { name })
      }</p>`;
      actions = p.soldOut
        ? `<a class="chat-action chat-action--wa" href="${whatsappHref(`${t("chat.waSimilar", { name })}\n${url}`)}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.similar")}</a>`
        : `<a class="chat-action chat-action--wa" href="${whatsappHref(`${t("chat.waPrice", { name })}\n${url}`)}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.price")}</a>`;
      break;
    }
    case "tour": {
      body = `<p>${t("videoTour.chat.text")}</p>`;
      actions = p.soldOut ? ask : `<a class="chat-action chat-action--tour" href="${videoTourHref([slug])}">${VIDEO_TOUR_ICON}${t("videoTour.chat.bookProject")}</a>`;
      break;
    }
  }
  return `${head}${body}<div class="chat-actions">${actions}</div>`;
}

function renderCitizenship(): string {
  const benefits = tRaw<string[]>("citizenship.benefits").slice(0, 3);
  return `
    <p>${t("citizenship.introText")}</p>
    <p class="chat-bot__subtitle">${t("chat.benefitsTitle")}</p>
    <ul class="chat-list">${benefits.map((b) => `<li>${b}</li>`).join("")}</ul>
    <div class="chat-actions">
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waCitizenship"))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.advisor")}</a>
      <a class="chat-action" href="${link("/citizenship")}">${t("chat.actions.guide")}</a>
    </div>`;
}

/** HADARA's architecture, interior design and engineering consultancy service. */
function renderDesign(): string {
  const services = tRaw<{ title: string }[]>("consultancy.services");
  return `
    <p>${t("chat.designText")}</p>
    <ul class="chat-list">${services.map((s) => `<li>${s.title}</li>`).join("")}</ul>
    <div class="chat-actions">
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waDesign"))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.advisor")}</a>
      <a class="chat-action" href="${link(consultancyPath("services"))}">${t("chat.actions.designServices")}</a>
      <a class="chat-action" href="${link(consultancyPath("consultation"))}">${t("chat.actions.consult")}</a>
    </div>`;
}

/** The private video tour, with a link to book it. */
function renderTour(): string {
  return `
    <p>${t("videoTour.chat.text")}</p>
    <div class="chat-actions">
      <a class="chat-action chat-action--tour" href="${videoTourHref()}">${VIDEO_TOUR_ICON}${t("videoTour.chat.book")}</a>
      <a class="chat-action" href="${link("/video-tour")}">${t("videoTour.home.more")}</a>
    </div>`;
}

function renderContact(): string {
  return `
    <p>${t("chat.contactText")}</p>
    <div class="chat-actions">
      <button type="button" class="chat-action chat-action--live" data-chat-live>${CHAT_ICON}${t("live.start")}</button>
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waHello"))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("floatingActions.whatsapp")}</a>
      <a class="chat-action" href="tel:+${WHATSAPP_NUMBER}"><span dir="ltr">+90 531 930 92 14</span></a>
      <a class="chat-action" href="${link("/contact")}">${t("chat.actions.form")}</a>
    </div>`;
}

function renderFallback(query: string): string {
  return `
    <p>${t("chat.fallback")}</p>
    <div class="chat-actions">
      <button type="button" class="chat-action chat-action--live" data-chat-live-send="${escapeHtml(query)}">${CHAT_ICON}${t("live.askHere")}</button>
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waQuestion", { q: query }))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.askTeam")}</a>
    </div>`;
}

function renderBot(entry: Extract<Entry, { from: "bot" }>): string {
  switch (entry.kind) {
    case "projects":
      return renderProjects(entry);
    case "project":
      return renderProject(entry.slug);
    case "here":
      return renderHere(entry.slug);
    case "info":
      return renderInfo(entry.slug, entry.topic);
    case "menu":
      return `<p>${t("chat.menuPrompt")}</p>`;
    case "citizenship":
      return renderCitizenship();
    case "design":
      return renderDesign();
    case "tour":
      return renderTour();
    case "contact":
      return renderContact();
    case "fallback":
      return renderFallback(entry.query);
    case "thanks":
      return `<p>${t("chat.thanks")}</p>`;
    default:
      return `<p>${t("chat.greeting")}</p>`;
  }
}

const MENU = ["projects", "price", "tour", "design", "citizenship", "contact"] as const;
/** Dictionary key of a quick-menu button (the video tour keeps its texts together under videoTour.*). */
const menuKey = (m: string) => (m === "tour" ? "videoTour.chat.menu" : `chat.menu.${m}`);

function renderMenu(): string {
  // On a project page, the general menu starts with a way back to that project.
  const here = pageProject();
  const about = here
    ? `<button type="button" class="chat-quick__btn chat-quick__btn--project" data-chat-about="${here}">${t("chat.aboutProject", { name: getProjectContent(here).name })}</button>`
    : "";
  return `<div class="chat-quick" role="group" aria-label="${t("chat.quickLabel")}">${about}${MENU.map(
    (m) => `<button type="button" class="chat-quick__btn" data-chat-menu="${m}">${t(menuKey(m))}</button>`
  ).join("")}</div>`;
}

/** Questions about one project, then a way to the other topics. */
function renderProjectMenu(slug: string, answered?: InfoTopic): string {
  const p = getProjectBySlug(slug);
  if (!p) return renderMenu();
  return `<div class="chat-quick" role="group" aria-label="${t("chat.quickLabel")}">${projectTopics(p)
    .filter((topic) => topic !== answered)
    .map((topic) => `<button type="button" class="chat-quick__btn chat-quick__btn--project" data-chat-topic="${topic}" data-slug="${slug}">${t(`chat.topics.${topic}`)}</button>`)
    .join("")}<button type="button" class="chat-quick__btn" data-chat-menu="menu">${t("chat.otherTopics")}</button></div>`;
}

function renderEntry(entry: Entry): string {
  if (entry.from === "user") {
    const text =
      "key" in entry ? t(entry.key, entry.slug ? { name: getProjectContent(entry.slug).name } : undefined) : escapeHtml(entry.text);
    return `<div class="chat-msg chat-msg--user"><div class="chat-bubble">${text}</div></div>`;
  }
  return `<div class="chat-msg chat-msg--bot"><div class="chat-bubble">${renderBot(entry)}</div></div>`;
}

/* ---------- Live chat with the team ---------- */

const ISTANBUL_OFFSET_MS = 3 * 3_600_000;
/** The team answers between 9:00 and 18:00 Istanbul time, every day. */
const officeOpen = () => {
  const hour = new Date(Date.now() + ISTANBUL_OFFSET_MS).getUTCHours();
  return hour >= 9 && hour < 18;
};
const clock = (iso: string) => new Intl.DateTimeFormat(intlTag(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(Date.parse(iso));

/** Message text, with phone numbers kept left-to-right inside Arabic / Persian sentences. */
const liveText = (body: string) =>
  `<span class="chat-live__text" dir="auto">${isolateNumbers(escapeHtml(body))}</span>`;

function renderLiveMessage(m: LiveMessage): string {
  if (m.sender === "team") {
    return `<div class="chat-msg chat-msg--bot"><div class="chat-bubble chat-bubble--team">
      <span class="chat-live__who">${t("live.team")} · <span dir="ltr">${clock(m.at)}</span></span>
      ${liveText(m.body)}</div></div>`;
  }
  const state = m.failed
    ? `<button type="button" class="chat-live__retry" data-live-retry="${m.id}">${t("live.retry")}</button>`
    : m.id < 0
      ? `<span class="chat-live__state">${t("live.sending")}</span>`
      : `<span class="chat-live__state" dir="ltr">${clock(m.at)} ✓</span>`;
  return `<div class="chat-msg chat-msg--user${m.id < 0 && !m.failed ? " is-pending" : ""}"><div class="chat-bubble">${liveText(m.body)}${state}</div></div>`;
}

function renderLiveLog(): string {
  const messages = liveMessages();
  const last = messages[messages.length - 1];
  const waiting = last?.sender === "visitor" && last.id > 0;
  const details = liveDetails();
  const intro = `<div class="chat-live__intro"><p><strong>${t("live.introTitle")}</strong></p><p>${t("live.intro")}</p>${
    officeOpen() ? "" : `<p class="chat-live__off">${t("live.offHours")}</p>`
  }</div>`;
  const notice = liveNotice
    ? `<p class="chat-live__notice" role="alert">${t(liveNotice === "limit" ? "live.errorLimit" : liveNotice === "unavailable" ? "live.errorUnavailable" : "live.errorSend")}
        <a href="${whatsappHref(t("chat.waHello"))}" target="_blank" rel="noopener">${t("live.whatsapp")}</a></p>`
    : "";
  const delivered = waiting ? `<p class="chat-live__delivered">${t("live.delivered")}</p>` : "";
  const ask =
    hasLiveChat() && !details.done
      ? `<form class="chat-live__details" data-live-details novalidate>
          <p>${t("live.detailsText")}</p>
          <input type="text" name="name" autocomplete="name" maxlength="120" placeholder="${t("live.namePlaceholder")}" aria-label="${t("live.namePlaceholder")}" />
          <input type="text" name="contact" autocomplete="tel" maxlength="160" dir="auto" placeholder="${t("live.contactPlaceholder")}" aria-label="${t("live.contactPlaceholder")}" />
          <div class="chat-live__details-actions">
            <button type="submit" class="chat-action chat-action--live">${t("live.detailsSave")}</button>
            <button type="button" class="chat-live__skip" data-live-skip>${t("live.detailsSkip")}</button>
          </div>
        </form>`
      : "";
  return intro + messages.map(renderLiveMessage).join("") + delivered + notice + ask;
}

function renderLog(): void {
  if (!panel) return;
  const log = panel.querySelector<HTMLElement>(".chat__log")!;
  if (mode === "live") {
    log.innerHTML = renderLiveLog();
    return;
  }
  const last = entries[entries.length - 1];
  // The main menu follows every answer except project lists, which carry their own choices.
  let menu = "";
  if (!typing && last?.from === "bot" && last.kind !== "projects") {
    menu =
      last.kind === "here" || last.kind === "project"
        ? renderProjectMenu(last.slug)
        : last.kind === "info"
          ? renderProjectMenu(last.slug, last.topic)
          : renderMenu();
  }
  log.innerHTML =
    entries.map(renderEntry).join("") +
    (typing ? `<div class="chat-msg chat-msg--bot"><div class="chat-bubble chat-typing" aria-label="${t("chat.typing")}"><span></span><span></span><span></span></div></div>` : "") +
    menu;
}

/** Scrolls so the start of the newest answer is visible (long answers are read top-down). */
function scrollToLatest(): void {
  const log = panel?.querySelector<HTMLElement>(".chat__log");
  if (!log) return;
  const msgs = log.querySelectorAll<HTMLElement>(".chat-msg");
  const lastMsg = msgs[msgs.length - 1];
  if (!lastMsg) return;
  const lastUser = [...msgs].reverse().find((m) => m.classList.contains("chat-msg--user"));
  const anchor = lastUser && lastMsg !== lastUser ? lastUser : lastMsg;
  log.scrollTo({ top: Math.max(0, anchor.offsetTop - 12), behavior: "smooth" });
}

function renderPanelChrome(): void {
  if (!panel) return;
  panel.setAttribute("aria-label", t("chat.title"));
  panel.innerHTML = `
    <header class="chat__head">
      <span class="chat__avatar" aria-hidden="true"><img src="/favicon-32.png" alt="" width="28" height="28" /></span>
      <div class="chat__who">
        <strong class="chat__title">${t(mode === "live" ? "live.title" : "chat.title")}</strong>
        <span class="chat__status"><span class="chat__dot" aria-hidden="true"></span>${t(mode === "live" ? "live.status" : "chat.status")}</span>
      </div>
      ${
        mode === "live"
          ? `<button type="button" class="chat__back" data-chat-bot>${t("live.back")}</button>`
          : `<button type="button" class="chat__icon-btn" data-chat-restart aria-label="${t("chat.restart")}" title="${t("chat.restart")}">${RESTART_ICON}</button>`
      }
      <button type="button" class="chat__icon-btn" data-chat-close aria-label="${t("chat.close")}" title="${t("chat.close")}">${CLOSE_ICON}</button>
    </header>
    <div class="chat__log" aria-live="polite"></div>
    <form class="chat__form" novalidate>
      <input class="chat__input" type="text" name="q" autocomplete="off" enterkeyhint="send" maxlength="${mode === "live" ? 2000 : 300}" placeholder="${t(mode === "live" ? "live.placeholder" : "chat.placeholder")}" aria-label="${t(mode === "live" ? "live.placeholder" : "chat.placeholder")}" />
      <button class="chat__send" type="submit" aria-label="${t("chat.send")}">${SEND_ICON}</button>
    </form>`;
  renderLog();
}

/* ---------- Behaviour ---------- */

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function push(user: Entry, answer: Entry): void {
  entries.push(user);
  typing = true;
  save();
  renderLog();
  scrollToLatest();
  window.setTimeout(
    () => {
      typing = false;
      entries.push(answer);
      save();
      renderLog();
      scrollToLatest();
    },
    reducedMotion() ? 0 : 550
  );
}

function syncBubble(): void {
  document.querySelectorAll<HTMLElement>("[data-chat-toggle]").forEach((btn) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("is-new", !wasSeen() || liveUnread() > 0);
  });
}

function openChat(): void {
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "chat";
    panel.id = "chat-panel";
    panel.setAttribute("role", "dialog");
    document.body.append(panel);
    wirePanel(panel);
  }
  // On a project page the chat starts with that project, unless it's already the subject.
  const here = pageProject();
  if (!entries.length) entries.push(here ? { from: "bot", kind: "here", slug: here } : { from: "bot", kind: "greeting" });
  else if (here && lastProjectSlug() !== here) {
    entries.push({ from: "bot", kind: "here", slug: here });
    save();
  }
  open = true;
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage unavailable
  }
  if (mode === "live") {
    markLiveSeen();
    startLivePolling(true);
  }
  renderPanelChrome();
  panel.hidden = false;
  requestAnimationFrame(() => panel?.classList.add("is-open"));
  document.body.classList.add("chat-open");
  syncBubble();
  const log = panel.querySelector<HTMLElement>(".chat__log")!;
  log.scrollTop = log.scrollHeight;
  // On phones the keyboard would cover the answers; focus it only on larger screens.
  if (!window.matchMedia(MOBILE).matches) panel.querySelector<HTMLInputElement>(".chat__input")?.focus();
  else panel.querySelector<HTMLElement>("[data-chat-close]")?.focus();
}

function closeChat(returnFocus = true): void {
  if (!panel || !open) return;
  open = false;
  startLivePolling(false);
  panel.classList.remove("is-open");
  document.body.classList.remove("chat-open");
  const el = panel;
  window.setTimeout(() => {
    if (!open) el.hidden = true;
  }, reducedMotion() ? 0 : 200);
  syncBubble();
  if (returnFocus) document.querySelector<HTMLElement>("[data-chat-toggle]")?.focus();
}

/** Switches the panel to the conversation with the team (sending `question` if given). */
function enterLive(question?: string): void {
  setMode("live");
  liveNotice = null;
  markLiveSeen();
  startLivePolling(true);
  renderPanelChrome();
  if (question) void liveSend(question);
  if (!window.matchMedia(MOBILE).matches) panel?.querySelector<HTMLInputElement>(".chat__input")?.focus();
}

async function liveSend(text: string, retryOf?: number): Promise<void> {
  liveNotice = null;
  const result = await sendLive(text, retryOf);
  liveNotice = result === "ok" ? null : result;
  if (panel && mode === "live") {
    renderLog();
    const log = panel.querySelector<HTMLElement>(".chat__log");
    if (log) log.scrollTop = log.scrollHeight;
  }
}

function wirePanel(el: HTMLElement): void {
  el.addEventListener("submit", (e) => {
    e.preventDefault();
    const details = (e.target as Element).closest<HTMLFormElement>("[data-live-details]");
    if (details) {
      const data = new FormData(details);
      const name = String(data.get("name") ?? "").trim();
      const contact = String(data.get("contact") ?? "").trim();
      if (!name && !contact) return skipLiveDetails();
      void setLiveDetails(name, contact, t("live.detailsNote", { name: name || "—", contact: contact ? contact.replace(/ /g, "\u00a0") : "—" }));
      return;
    }
    const input = el.querySelector<HTMLInputElement>(".chat__input")!;
    const text = input.value.trim();
    if (!text) return;
    if (mode === "live") {
      input.value = "";
      void liveSend(text);
      return;
    }
    if (typing) return;
    input.value = "";
    push({ from: "user", text }, reply(text));
  });

  el.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("[data-chat-close]")) return closeChat();
    if (target.closest("[data-chat-bot]")) {
      setMode("bot");
      renderPanelChrome();
      return;
    }
    const liveSendBtn = target.closest<HTMLElement>("[data-chat-live-send]");
    if (liveSendBtn || target.closest("[data-chat-live]")) {
      enterLive(liveSendBtn?.dataset.chatLiveSend);
      return;
    }
    const retry = target.closest<HTMLElement>("[data-live-retry]");
    if (retry) {
      const failed = liveMessages().find((m) => m.id === Number(retry.dataset.liveRetry));
      if (failed) void liveSend(failed.body, failed.id);
      return;
    }
    if (target.closest("[data-live-skip]")) return skipLiveDetails();
    if (target.closest("[data-chat-restart]")) {
      const here = pageProject();
      entries = [here ? { from: "bot", kind: "here", slug: here } : { from: "bot", kind: "greeting" }];
      save();
      renderLog();
      return;
    }
    if (typing) return;
    const topicBtn = target.closest<HTMLElement>("[data-chat-topic]");
    if (topicBtn) {
      const topic = topicBtn.dataset.chatTopic as InfoTopic;
      const topicSlug = topicBtn.dataset.slug!;
      return push({ from: "user", key: `chat.topics.${topic}` }, { from: "bot", kind: "info", slug: topicSlug, topic });
    }
    const about = target.closest<HTMLElement>("[data-chat-about]")?.dataset.chatAbout;
    if (about) return push({ from: "user", key: "chat.aboutProject", slug: about }, { from: "bot", kind: "here", slug: about });
    const scrollTo = target.closest<HTMLElement>("[data-chat-scroll]")?.dataset.chatScroll;
    if (scrollTo) {
      if (window.matchMedia(MOBILE).matches) closeChat(false);
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      return;
    }
    const menu = target.closest<HTMLElement>("[data-chat-menu]")?.dataset.chatMenu;
    if (menu === "menu") return push({ from: "user", key: "chat.otherTopics" }, { from: "bot", kind: "menu" });
    if (menu) {
      const answer: Entry =
        menu === "projects"
          ? { from: "bot", kind: "projects", filter: "all" }
          : menu === "price"
            ? { from: "bot", kind: "projects", filter: "all", intro: "price" }
            : { from: "bot", kind: menu as Topic };
      return push({ from: "user", key: menuKey(menu) }, answer);
    }
    const filter = target.closest<HTMLElement>("[data-chat-filter]")?.dataset.chatFilter as Filter | undefined;
    if (filter) return push({ from: "user", key: `chat.filters.${filter}` }, { from: "bot", kind: "projects", filter });
    const slug = target.closest<HTMLElement>("[data-chat-project]")?.dataset.chatProject;
    if (slug) return push({ from: "user", key: `projectsData.${slug}.name` }, { from: "bot", kind: "project", slug });
    // A page link inside the chat: on phones the chat covers the page, so step aside.
    const anchor = target.closest<HTMLAnchorElement>("a[href^='/']");
    if (anchor && window.matchMedia(MOBILE).matches) closeChat(false);
  });
}

/** Chat bubble for the floating actions column. */
export function chatBubble(): string {
  return `<button type="button" class="floating-actions__btn floating-actions__btn--chat${wasSeen() && !liveUnread() ? "" : " is-new"}" data-chat-toggle aria-controls="chat-panel" aria-expanded="${open}" aria-label="${t("chat.bubble")}" title="${t("chat.bubble")}">${CHAT_ICON}</button>`;
}

export function initChat(): void {
  // A reply from the team: repaint the open conversation, or light the bubble's dot.
  onLiveChange(() => {
    if (panel && open && mode === "live") {
      markLiveSeen();
      const log = panel.querySelector<HTMLElement>(".chat__log")!;
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      renderLog();
      if (atBottom) log.scrollTop = log.scrollHeight;
    }
    syncBubble();
  });
  if (hasLiveChat()) startLivePolling(false);
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-chat-toggle]")) return;
    if (open) closeChat();
    else openChat();
  });
  document.addEventListener("keydown", (e) => {
    // Search and lightbox overlays handle their own Escape first.
    if (e.key === "Escape" && open && !document.querySelector(".search-overlay, .lightbox")) closeChat();
  });
  onLocaleChange(() => {
    if (panel && open) renderPanelChrome();
  });
}
