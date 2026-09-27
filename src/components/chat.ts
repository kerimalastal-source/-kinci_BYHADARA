import { t, tRaw, link, getProjectContent, placeLine, onLocaleChange, locales } from "../i18n";
import { lookup } from "../i18n/dictionaries";
import { getProjectBySlug, getSortedProjects, type Project } from "../data/projects";
import { projectStatusLabel } from "./projectCard";
import { WHATSAPP_NUMBER, WHATSAPP_ICON } from "./floatingButtons";
import { HEART_ICON, isFavorite } from "./favorites";
import { escapeHtml } from "../utils/html";
import { toWesternDigits } from "../utils/numbers";
import { placeKey } from "../utils/place";

/**
 * Guided chat assistant: answers from the site's own data (projects, citizenship, contact)
 * in every language, and hands anything it can't answer to the team on WhatsApp.
 * The conversation is stored as locale-free entries so it re-renders in a new language.
 */

type Filter = "all" | "new" | "ready" | "villas";
type Topic = "greeting" | "citizenship" | "contact" | "thanks";

type Entry =
  | { from: "user"; text: string }
  | { from: "user"; key: string }
  | { from: "bot"; kind: Topic }
  | { from: "bot"; kind: "fallback"; query: string }
  | { from: "bot"; kind: "projects"; filter: Filter; intro?: "price" | "matched" | "district"; slugs?: string[] }
  | { from: "bot"; kind: "project"; slug: string };

const STORE_KEY = "hadara-chat";
const SEEN_KEY = "hadara-chat-seen";
const MOBILE = "(max-width: 640px)";

export const CHAT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.9-.8L3 20.5l1.4-4.2A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke-width="2.6"/></svg>`;
const CLOSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const RESTART_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;
const SEND_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>`;

let entries: Entry[] = load();
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
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const tokens = (text: string) => normalize(text).split(" ").filter(Boolean);

/** Words shared by many project names; they never pick a project on their own. */
const GENERIC = new Set(["lotus", "لوتس", "лотос", "villa", "فيلا", "вилла", "the", "de", "la"]);

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
    // A district name inside a project name ("Beylikdüzü Living") only breaks ties.
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
  citizenship: ["citizen", "passport", "nationality", "جنسيه", "جواز", "citoyen", "nationalite", "passeport", "граждан", "паспорт"],
  contact: ["contact", "call", "phone", "whatsapp", "speak", "agent", "advisor", "تواصل", "اتصل", "اتصال", "هاتف", "تلفون", "تليفون", "رقمكم", "واتس", "موظف", "مستشار", "appel", "telephone", "conseill", "связ", "позвон", "телефон", "ватсап", "менеджер"],
  price: ["price", "cost", "how much", "budget", "سعر", "اسعار", "ثمن", "بكم", "تكلف", "ميزاني", "prix", "cout", "combien", "tarif", "цен", "стоим", "сколько", "бюджет"],
  villas: ["villa", "فيلا", "فلل", "فيلل", "вилл"],
  new: ["new", "launch", "off plan", "offplan", "under construction", "جديد", "اطلاق", "قيد الانشاء", "على المخطط", "nouveau", "neuf", "lancement", "construction", "нов", "строящ"],
  ready: ["ready", "move in", "completed", "جاهز", "مكتمل", "منجز", "فوري", "pret", "livre", "termine", "готов", "сдан"],
  projects: ["project", "detail", "info", "option", "available", "apartment", "flat", "property", "properties", "home", "house", "deliver", "handover", "مشروع", "مشاريع", "تفاصيل", "معلومات", "عقار", "شقق", "شقه", "متاح", "بيت", "منزل", "تسليم", "projet", "appartement", "maison", "bien", "livraison", "проект", "подроб", "квартир", "информац", "дом", "сдач", "срок"],
  thanks: ["thank", "thx", "شكرا", "مشكور", "يعطيك", "تسلم", "merci", "спасибо", "благодар"],
  greeting: ["hello", "hi", "hey", "مرحبا", "اهلا", "السلام", "سلام", "هلا", "مساء", "صباح", "bonjour", "salut", "bonsoir", "привет", "здравств", "добрый"]
};

/** Latin keywords match at the start of a word ("citizen" finds "citizenship"); others anywhere (Arabic prefixes like "بال"). */
function has(q: string, group: keyof typeof KEYWORDS): boolean {
  const padded = ` ${q}`;
  return KEYWORDS[group].some((kw) => {
    if (!/^[a-z ]+$/.test(kw)) return q.includes(kw);
    // Very short greetings must be whole words ("hi" is not "history").
    return kw.length <= 3 ? ` ${q} `.includes(` ${kw} `) : padded.includes(` ${kw}`);
  });
}

function reply(text: string): Entry {
  const q = normalize(text);
  const named = matchProjects(text);
  if (named.length === 1) return { from: "bot", kind: "project", slug: named[0] };
  if (named.length > 1) return { from: "bot", kind: "projects", filter: "all", intro: "matched", slugs: named };
  if (has(q, "citizenship")) return { from: "bot", kind: "citizenship" };
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
      <img src="${p.coverImage.src}" alt="" width="56" height="56" loading="lazy" />
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
      <img class="chat-card__img" src="${p.coverImage.src}" alt="${p.coverImage.alt}" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
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
      ${save}
      <button type="button" class="chat-action chat-action--ghost" data-chat-filter="all">${t("chat.actions.more")}</button>
    </div>`;
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

function renderContact(): string {
  return `
    <p>${t("chat.contactText")}</p>
    <div class="chat-actions">
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waHello"))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("floatingActions.whatsapp")}</a>
      <a class="chat-action" href="tel:+${WHATSAPP_NUMBER}"><span dir="ltr">+90 531 930 92 14</span></a>
      <a class="chat-action" href="${link("/contact")}">${t("chat.actions.form")}</a>
    </div>`;
}

function renderFallback(query: string): string {
  return `
    <p>${t("chat.fallback")}</p>
    <div class="chat-actions">
      <a class="chat-action chat-action--wa" href="${whatsappHref(t("chat.waQuestion", { q: query }))}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("chat.actions.askTeam")}</a>
    </div>`;
}

function renderBot(entry: Extract<Entry, { from: "bot" }>): string {
  switch (entry.kind) {
    case "projects":
      return renderProjects(entry);
    case "project":
      return renderProject(entry.slug);
    case "citizenship":
      return renderCitizenship();
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

const MENU = ["projects", "price", "citizenship", "contact"] as const;

function renderMenu(): string {
  return `<div class="chat-quick" role="group" aria-label="${t("chat.quickLabel")}">${MENU.map(
    (m) => `<button type="button" class="chat-quick__btn" data-chat-menu="${m}">${t(`chat.menu.${m}`)}</button>`
  ).join("")}</div>`;
}

function renderEntry(entry: Entry): string {
  if (entry.from === "user") {
    const text = "key" in entry ? t(entry.key) : escapeHtml(entry.text);
    return `<div class="chat-msg chat-msg--user"><div class="chat-bubble">${text}</div></div>`;
  }
  return `<div class="chat-msg chat-msg--bot"><div class="chat-bubble">${renderBot(entry)}</div></div>`;
}

function renderLog(): void {
  if (!panel) return;
  const log = panel.querySelector<HTMLElement>(".chat__log")!;
  const last = entries[entries.length - 1];
  // The main menu follows every answer except project lists, which carry their own choices.
  const menu = !typing && last?.from === "bot" && last.kind !== "projects" ? renderMenu() : "";
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
        <strong class="chat__title">${t("chat.title")}</strong>
        <span class="chat__status"><span class="chat__dot" aria-hidden="true"></span>${t("chat.status")}</span>
      </div>
      <button type="button" class="chat__icon-btn" data-chat-restart aria-label="${t("chat.restart")}" title="${t("chat.restart")}">${RESTART_ICON}</button>
      <button type="button" class="chat__icon-btn" data-chat-close aria-label="${t("chat.close")}" title="${t("chat.close")}">${CLOSE_ICON}</button>
    </header>
    <div class="chat__log" aria-live="polite"></div>
    <form class="chat__form" novalidate>
      <input class="chat__input" type="text" name="q" autocomplete="off" enterkeyhint="send" maxlength="300" placeholder="${t("chat.placeholder")}" aria-label="${t("chat.placeholder")}" />
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
    btn.classList.toggle("is-new", !wasSeen());
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
  if (!entries.length) entries.push({ from: "bot", kind: "greeting" });
  open = true;
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage unavailable
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
  panel.classList.remove("is-open");
  document.body.classList.remove("chat-open");
  const el = panel;
  window.setTimeout(() => {
    if (!open) el.hidden = true;
  }, reducedMotion() ? 0 : 200);
  syncBubble();
  if (returnFocus) document.querySelector<HTMLElement>("[data-chat-toggle]")?.focus();
}

function wirePanel(el: HTMLElement): void {
  el.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el.querySelector<HTMLInputElement>(".chat__input")!;
    const text = input.value.trim();
    if (!text || typing) return;
    input.value = "";
    push({ from: "user", text }, reply(text));
  });

  el.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("[data-chat-close]")) return closeChat();
    if (target.closest("[data-chat-restart]")) {
      entries = [{ from: "bot", kind: "greeting" }];
      save();
      renderLog();
      return;
    }
    if (typing) return;
    const menu = target.closest<HTMLElement>("[data-chat-menu]")?.dataset.chatMenu;
    if (menu) {
      const answer: Entry =
        menu === "projects"
          ? { from: "bot", kind: "projects", filter: "all" }
          : menu === "price"
            ? { from: "bot", kind: "projects", filter: "all", intro: "price" }
            : { from: "bot", kind: menu as Topic };
      return push({ from: "user", key: `chat.menu.${menu}` }, answer);
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
  return `<button type="button" class="floating-actions__btn floating-actions__btn--chat${wasSeen() ? "" : " is-new"}" data-chat-toggle aria-controls="chat-panel" aria-expanded="${open}" aria-label="${t("chat.bubble")}" title="${t("chat.bubble")}">${CHAT_ICON}</button>`;
}

export function initChat(): void {
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
