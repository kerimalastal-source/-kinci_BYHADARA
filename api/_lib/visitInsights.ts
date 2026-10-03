// Reading a visit (owner's request, 2026-10-02, the same as HADARA Hospitality's
// src/lib/visit-insights.ts): is it a person, how interested does it look, and what is it
// probably after. Used by the live Telegram alert (api/_lib/visitRecord.ts, api/track.ts)
// and the morning visitor report (api/_lib/visitReport.ts). Plain functions over what the
// anonymous tracking saves (pages, device, engagement, button presses), so they're tested
// without a database. Nothing here identifies a person.
import { PROJECT_NAMES } from "./projectNames.js";

// ── System and browser from the user agent ──────────────────────────────────────────────
// Only these two labels are saved (visitor_profiles), never the user agent itself.

export function parseUserAgent(ua: string | null | undefined): { os: string | null; browser: string | null } {
  const s = ua ?? "";
  const os = /iPhone|iPad|iPod/.test(s)
    ? "iOS"
    : /Android/.test(s)
      ? "Android"
      : /Windows/.test(s)
        ? "Windows"
        : /CrOS/.test(s)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/.test(s)
            ? "macOS"
            : /Linux/.test(s)
              ? "Linux"
              : null;
  const browser = /Instagram/.test(s)
    ? "Instagram"
    : /FBAN|FBAV|FB_IAB|FBIOS/.test(s)
      ? "Facebook"
      : /LinkedInApp/.test(s)
        ? "LinkedIn"
        : /musical_ly|BytedanceWebview|TikTok/i.test(s)
          ? "TikTok"
          : /Snapchat/.test(s)
            ? "Snapchat"
            : /Edg(e|A|iOS)?\//.test(s)
              ? "Edge"
              : /OPR\/|Opera/.test(s)
                ? "Opera"
                : /SamsungBrowser/.test(s)
                  ? "Samsung Internet"
                  : /YaBrowser/.test(s)
                    ? "Yandex"
                    : /Firefox|FxiOS/.test(s)
                      ? "Firefox"
                      : /Chrome|CriOS|Chromium/.test(s)
                        ? "Chrome"
                        : /Safari/.test(s)
                          ? "Safari"
                          : null;
  return { os, browser };
}

const DEVICE_AR: Record<string, string> = { mobile: "📱 جوال", tablet: "📱 جهاز لوحي", desktop: "💻 حاسوب" };

/** "📱 جوال · iOS · Instagram", or null when nothing is known. */
export function deviceLabel(f: { device?: string | null; os?: string | null; browser?: string | null }): string | null {
  const parts = [f.device ? DEVICE_AR[f.device] : null, f.os, f.browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ── Time zone against country ───────────────────────────────────────────────────────────
// The browser's time zone should sit in the same part of the world as the country read
// from the IP address. A mismatch hints at a VPN or a server, so it only counts a little.

const AMERICAS =
  "US CA MX GT BZ SV HN NI CR PA CU JM HT DO PR BS BB TT AG DM GD KN LC VC CO VE GY SR GF EC PE BR BO PY CL AR UY AW CW BQ SX MF BL GP MQ KY VG VI TC BM AI MS PM GL";
const AFRICA =
  "DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH RE YT";
const EUROPE =
  "AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GI GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO SM RS SK SI ES SE CH UA GB VA GG JE IM FO AX";
const OCEANIA = "AU NZ FJ PG SB VU NC PF WS TO KI TV NR FM MH PW GU MP AS CK NU";
const BOTH: Record<string, string[]> = {
  TR: ["Europe", "Asia"], RU: ["Europe", "Asia"], KZ: ["Asia", "Europe"], GE: ["Asia", "Europe"],
  AZ: ["Asia", "Europe"], AM: ["Asia", "Europe"], CY: ["Asia", "Europe"], US: ["America", "Pacific"],
  ES: ["Europe", "Africa", "Atlantic"], PT: ["Europe", "Atlantic"], GB: ["Europe", "Atlantic"]
};
const AREAS = new Map<string, string[]>();
for (const [list, area] of [
  [AMERICAS, ["America"]],
  [AFRICA, ["Africa", "Indian"]],
  [EUROPE, ["Europe", "Atlantic"]],
  [OCEANIA, ["Australia", "Pacific"]]
] as const) {
  for (const code of list.split(" ")) AREAS.set(code, [...area]);
}
const JUDGED_AREAS = new Set(["Africa", "America", "Asia", "Europe", "Australia", "Pacific"]);

/** The time zone is in another part of the world than the country, or null when it can't be judged. */
export function timeZoneMismatch(tz: string | null | undefined, country: string | null | undefined): boolean | null {
  if (!tz || !country) return null;
  const area = tz.split("/")[0];
  if (!JUDGED_AREAS.has(area)) return null;
  const code = country.toUpperCase();
  return !(BOTH[code] ?? AREAS.get(code) ?? ["Asia"]).includes(area);
}

const isUtcZone = (tz: string | null | undefined) => Boolean(tz && /^(Etc\/)?(UTC|GMT|Universal|Zulu)$/i.test(tz));

// ── Is it a person? ─────────────────────────────────────────────────────────────────────

export interface PageFacts {
  path: string;
  /** Seconds since the visit's first page. */
  at: number;
}

export interface EngagementFacts {
  path: string | null;
  active: number;
  scroll: number;
  interactions: number;
}

export interface VisitFacts {
  city?: string | null;
  country?: string | null;
  referrer?: string | null;
  campaign?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  tz?: string | null;
  screen?: string | null;
  webdriver?: boolean | null;
  pages: PageFacts[];
  engagement?: EngagementFacts[];
  /** Button presses and forms (visitor_actions): whatsapp, call, email, interested, form_sent, video_play... */
  actions?: { action: string; target: string | null }[];
  /** A data-center town or a same-page burst (api/_lib/visitBots.ts). */
  automated?: string | null;
}

export type Verdict = "real" | "unsure" | "bot" | "pending";

export interface VerdictResult {
  verdict: Verdict;
  /** Short Arabic reasons, strongest first. */
  reasons: string[];
}

/** Presses that only a person interested in buying makes. */
const CONTACT_ACTIONS = new Set(["whatsapp", "call", "email", "interested", "form_sent", "tour_link"]);
/** Presses that show a person looking closely. */
const LOOK_ACTIONS = new Set(["video_play", "map_open", "favorite", "chat_open", "form_start"]);

const actionsOf = (f: VisitFacts) => f.actions ?? [];
const engagementOf = (f: VisitFacts) => f.engagement ?? [];

/** Weighs the signals: automation, a server-like setup or robotic timing, against presses, input, reading and scrolling. */
export function classifyVisit(f: VisitFacts): VerdictResult {
  const bot: [number, string][] = [];
  const human: [number, string][] = [];
  const actions = actionsOf(f);
  const engagement = engagementOf(f);

  const contacted = actions.some((a) => CONTACT_ACTIONS.has(a.action));
  if (actions.some((a) => a.action === "form_sent")) human.push([10, "أرسل نموذجاً"]);
  else if (contacted) human.push([6, "نقر على وسيلة تواصل"]);
  if (actions.some((a) => LOOK_ACTIONS.has(a.action))) human.push([3, "شاهد الفيديو أو فتح الخريطة أو حفظ مشروعاً"]);

  if (f.webdriver) bot.push([5, "متصفح مُدار آلياً"]);
  else if (f.automated) bot.push([5, f.automated === "data-center town" ? "من مدينة مراكز بيانات" : "ضمن دفعة زيارات متزامنة"]);
  if (f.screen === "800x600") bot.push([1.5, "شاشة بمقاس افتراضي للخوادم"]);
  if (isUtcZone(f.tz)) bot.push([1.5, "منطقة زمنية UTC"]);
  else if (timeZoneMismatch(f.tz, f.country)) bot.push([1, "المنطقة الزمنية لا تطابق البلد"]);
  if (f.device === "desktop" && f.os === "Linux") bot.push([0.5, "حاسوب Linux"]);

  const pages = f.pages;
  const gaps = pages.slice(1).map((p, i) => p.at - pages[i].at);
  if (gaps.length >= 2 && gaps.every((g) => g < 2)) bot.push([3, "تنقّل سريع جداً بين الصفحات"]);

  const interactions = engagement.reduce((n, e) => n + (e.interactions || 0), 0);
  const active = engagement.reduce((n, e) => n + (e.active || 0), 0);
  const scroll = engagement.reduce((n, e) => Math.max(n, e.scroll || 0), 0);
  const reported = engagement.length > 0;
  if (interactions >= 3) human.push([2.5, "تفاعل باللمس أو الفأرة"]);
  else if (interactions >= 1) human.push([1.5, "تفاعل محدود"]);
  if (scroll >= 50) human.push([1, `مرّر حتى ${Math.round(scroll)}%`]);
  if (active >= 20) human.push([1, "قضى وقتاً في القراءة"]);
  if (gaps.some((g) => g >= 5 && g <= 1800)) human.push([1, "تنقّل طبيعي بين الصفحات"]);
  if (f.campaign || (f.referrer && !f.referrer.startsWith("/"))) human.push([0.5, "جاء من بحث أو إعلان أو موقع آخر"]);
  if (reported && interactions === 0 && active < 5 && pages.length === 1 && !actions.length) bot.push([1, "لا تفاعل ومغادرة فورية"]);

  const b = bot.reduce((n, [w]) => n + w, 0);
  const h = human.reduce((n, [w]) => n + w, 0);
  const byWeight = (list: [number, string][]) => [...list].sort((x, y) => y[0] - x[0]).map(([, r]) => r);

  let verdict: Verdict;
  if (contacted) verdict = "real";
  else if (b >= 3 && h < 3) verdict = "bot";
  else if (h >= 2.5 && b <= 1.5) verdict = "real";
  else if (!reported && !actions.length && b < 1.5 && pages.length === 1) verdict = "pending";
  else verdict = "unsure";

  const reasons = verdict === "bot" ? byWeight(bot) : verdict === "real" ? byWeight(human) : [...byWeight(bot), ...byWeight(human)];
  return { verdict, reasons: reasons.slice(0, 3) };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  real: "🟢 حقيقي على الأرجح",
  unsure: "🟡 غير مؤكد",
  bot: "🔴 آلي على الأرجح",
  pending: "⏳ جارٍ التقييم…"
};

/** The alert line: "🧠 التقييم: 🟢 حقيقي على الأرجح (…)". */
export function verdictLine(result: VerdictResult): string {
  const why = result.verdict === "pending" || !result.reasons.length ? "" : ` (${result.reasons.join("، ")})`;
  return `🧠 التقييم: ${VERDICT_LABEL[result.verdict]}${why}`;
}

// ── What are they after? ────────────────────────────────────────────────────────────────

export type IntentLevel = "high" | "medium" | "low";
export const INTENT_LABEL: Record<IntentLevel, string> = { high: "🔥 اهتمام عالٍ", medium: "🙂 اهتمام متوسط", low: "▫️ اهتمام منخفض" };

const REQUEST_NAMES: Record<string, string> = {
  "/contact": "التواصل",
  "/engineering-architecture/request-consultation": "طلب استشارة التصميم الهندسي",
  "/property-request": "طلب عقار مخصص",
  "/video-tour": "حجز الجولة عبر الفيديو"
};
const PAGE_NAMES: Record<string, string> = {
  "/": "الرئيسية",
  "/projects": "المشاريع",
  "/about": "من نحن",
  "/citizenship": "الجنسية التركية",
  "/blog": "المدونة",
  "/faq": "الأسئلة الشائعة",
  "/resale": "إعادة البيع",
  "/privacy": "سياسة الخصوصية",
  "/property-laws": "قوانين العقار",
  "/engineering-architecture": "الاستشارات الهندسية",
  "/engineering-architecture/services": "خدمات التصميم",
  "/engineering-architecture/portfolio": "معرض الأعمال",
  "/engineering-architecture/how-we-work": "منهجية العمل",
  ...REQUEST_NAMES
};

/** Path without the language prefix, query or trailing slash: "/ar/contact/" -> "/contact". */
export function basePath(path: string): string {
  return path.split(/[?#]/)[0].replace(/^\/(?:ar|fa|fr|ru)(?=\/|$)/, "").replace(/\/$/, "") || "/";
}

const projectSlug = (path: string) => basePath(path).match(/^\/projects\/([a-z0-9-]+)$/)?.[1] ?? null;
const projectName = (slug: string) => PROJECT_NAMES[slug]?.ar ?? slug;

/** A page's Arabic name: "الرئيسية", the project's Arabic name, "مقال", "عقار إعادة بيع". */
export function pageName(path: string): string {
  const base = basePath(path);
  if (PAGE_NAMES[base]) return PAGE_NAMES[base];
  const slug = projectSlug(path);
  if (slug) return projectName(slug);
  if (/^\/blog\/[^/]+$/.test(base)) return "مقال";
  if (/^\/resale\/[^/]+$/.test(base)) return "عقار إعادة بيع";
  return `‎${base}`;
}

export interface IntentResult {
  level: IntentLevel;
  /** Arabic names of the projects the visit looked at, most looked at first. */
  projects: string[];
  /** One Arabic sentence: what they are probably after, and what to do. */
  prediction: string;
}

const ACTION_NAMES: Record<string, string> = {
  whatsapp: "واتساب",
  call: "الاتصال",
  email: "البريد",
  interested: "«أنا مهتم»",
  tour_link: "حجز جولة الفيديو",
  form_sent: "إرسال نموذج"
};

export function visitIntent(f: VisitFacts, verdict: Verdict): IntentResult {
  const actions = actionsOf(f);
  const counts = new Map<string, number>();
  const add = (slug: string | null | undefined, weight: number) => {
    if (slug && /^[a-z0-9-]+$/.test(slug)) counts.set(slug, (counts.get(slug) ?? 0) + weight);
  };
  for (const p of f.pages) add(projectSlug(p.path), 1);
  for (const a of actions) if (a.target && a.target !== "contact" && !a.target.includes("form")) add(a.target, 2);
  const projects = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => projectName(slug));
  const projectPages = new Set(f.pages.map((p) => projectSlug(p.path)).filter(Boolean)).size;
  const requestPage = f.pages.map((p) => basePath(p.path)).find((p) => REQUEST_NAMES[p]);
  const looked = actions.filter((a) => LOOK_ACTIONS.has(a.action));
  const contacts = actions.filter((a) => CONTACT_ACTIONS.has(a.action));
  const span = f.pages.length ? f.pages[f.pages.length - 1].at - f.pages[0].at : 0;
  const topic = projects.length ? projects.slice(0, 2).join(" و") : "";

  let level: IntentLevel = "low";
  if (contacts.length || (requestPage && projectPages >= 1)) level = "high";
  else if (requestPage || looked.length || projectPages >= 2 || (f.pages.length >= 3 && span >= 60)) level = "medium";

  let prediction: string;
  if (verdict === "bot") prediction = "زيارة آلية على الأرجح، ولا تحتاج متابعة.";
  else if (contacts.some((a) => a.action === "form_sent")) prediction = `أرسل نموذجاً${topic ? ` ويهتم بـ ${topic}` : ""}؛ المهم الرد عليه سريعاً.`;
  else if (contacts.length) {
    const via = [...new Set(contacts.map((a) => ACTION_NAMES[a.action] ?? a.action))].join(" و");
    prediction = `نقر على ${via}${topic ? ` بخصوص ${topic}` : ""}؛ قد يتواصل مباشرةً، فراقب الرسائل.`;
  } else if (level === "high") prediction = `مهتم بـ ${topic || "مشاريعنا"} ووصل إلى صفحة ${REQUEST_NAMES[requestPage!]} دون أن يرسل؛ قد يعود لإكماله.`;
  else if (looked.length && topic) prediction = `يدرس ${topic} عن قرب (فيديو أو خريطة أو حفظ)؛ مرشح جيد للتواصل.`;
  else if (requestPage) prediction = `فتح صفحة ${REQUEST_NAMES[requestPage]} دون أن يرسل؛ ربما يقارن قبل التواصل.`;
  else if (projectPages >= 2) prediction = `يقارن بين ${topic}؛ اهتمام أولي جيد.`;
  else if (projectPages === 1) prediction = `اطّلع على مشروع ${topic}؛ اهتمام أولي.`;
  else if (f.pages.some((p) => /^\/(blog|citizenship|property-laws)/.test(basePath(p.path)))) prediction = "يقرأ المحتوى التعريفي؛ باحث عن معلومات أكثر منه مشترٍ حالياً.";
  else if (f.pages.length === 1) prediction = "زيارة قصيرة لصفحة واحدة؛ اهتمام منخفض على الأرجح.";
  else prediction = "يتعرّف على الشركة بشكل عام؛ لا مؤشر واضح على طلب قريب.";
  if (verdict === "unsure" && !contacts.length) prediction += " (التقييم غير مؤكد)";

  return { level, projects, prediction };
}

/** The alert's two extra lines: the device (when known) and the verdict. */
export function alertInsightLines(f: VisitFacts, escape: (s: string) => string): string[] {
  const device = deviceLabel(f);
  return [...(device ? [`🖥️ الجهاز: ${escape(device)}`] : []), verdictLine(classifyVisit(f))];
}

/** visit_insight() (supabase/migrations/0018), as the database returns it. */
export interface Insight {
  device: string | null;
  profile: { os: string | null; browser: string | null; tz: string | null; screen: string | null; webdriver: boolean | null } | null;
  pages: PageFacts[];
  engagement: EngagementFacts[];
  actions: { action: string; target: string | null }[];
  landing: { path: string; locale: string | null; referrer: string | null; country: string | null; city: string | null } | null;
  seconds: number | null;
  message_id: number | null;
}

/** What classifyVisit() reads, from visit_insight(). */
export function insightFacts(i: Insight, campaign: string | null = null): VisitFacts {
  return {
    city: i.landing?.city ?? null,
    country: i.landing?.country ?? null,
    referrer: i.landing?.referrer ?? null,
    campaign,
    device: i.device,
    os: i.profile?.os ?? null,
    browser: i.profile?.browser ?? null,
    tz: i.profile?.tz ?? null,
    screen: i.profile?.screen ?? null,
    webdriver: i.profile?.webdriver ?? null,
    pages: i.pages ?? [],
    engagement: i.engagement ?? [],
    actions: i.actions ?? []
  };
}
