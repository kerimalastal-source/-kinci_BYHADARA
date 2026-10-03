// The morning visitor report (owner's request, 2026-10-02, the same as HADARA
// Hospitality's src/lib/visit-report.ts): a second Telegram message after the 9 AM summary
// (api/daily.ts) that reads every visit of the last 24 hours (api/_lib/visitInsights.ts):
// how many were people, unsure or automated, and for each likely person where they came
// from, on what device, what they looked at, how interested they seem and what they are
// probably after. Data: visit_report() (supabase/migrations/0018).
import { escapeHtml } from "./telegram.js";
import { isDataCenterTown } from "./visitBots.js";
import {
  classifyVisit,
  deviceLabel,
  INTENT_LABEL,
  pageName,
  visitIntent,
  type EngagementFacts,
  type IntentLevel,
  type PageFacts,
  type Verdict,
  type VisitFacts
} from "./visitInsights.js";

/** One row of visit_report(). */
export interface ReportRow {
  session_id: string;
  started: number;
  campaign: string | null;
  device: string | null;
  profile: { os: string | null; browser: string | null; tz: string | null; screen: string | null; webdriver: boolean | null } | null;
  pages: PageFacts[];
  engagement: EngagementFacts[];
  actions: { action: string; target: string | null }[];
  landing: { path: string; locale: string | null; referrer: string | null; country: string | null; city: string | null } | null;
  seconds: number | null;
}

export interface ReadVisit {
  row: ReportRow;
  facts: VisitFacts;
  verdict: Verdict;
  reasons: string[];
  level: IntentLevel;
  prediction: string;
}

const BURST_SECONDS = 10;

/**
 * Classifies each visit. A new tab opened from the site (its first referrer is one of our
 * pages) isn't a new visitor and is left out, as in the live alerts; data-center towns and
 * several visits opening the same first page at once count as automated.
 */
export function readVisits(rows: ReportRow[]): ReadVisit[] {
  const visits = rows.filter((r) => r.landing && r.pages?.length && !(r.landing.referrer ?? "").startsWith("/"));
  const byLanding = new Map<string, ReportRow[]>();
  for (const r of visits) {
    const list = byLanding.get(r.landing!.path) ?? [];
    list.push(r);
    byLanding.set(r.landing!.path, list);
  }
  const burst = new Set<string>();
  for (const list of byLanding.values()) {
    list.sort((a, b) => a.started - b.started);
    list.forEach((r, i) => {
      const near = (o: ReportRow | undefined) => o && Math.abs(o.started - r.started) <= BURST_SECONDS;
      if (near(list[i - 1]) || near(list[i + 1])) burst.add(r.session_id);
    });
  }
  return visits.map((row) => {
    const landing = row.landing!;
    const contacted = row.actions?.some((a) => ["whatsapp", "call", "email", "interested", "form_sent", "tour_link"].includes(a.action));
    const automated = contacted ? null : isDataCenterTown(landing) ? "data-center town" : burst.has(row.session_id) ? "same-page burst" : null;
    const facts: VisitFacts = {
      city: landing.city,
      country: landing.country,
      referrer: landing.referrer,
      campaign: row.campaign,
      device: row.device,
      os: row.profile?.os ?? null,
      browser: row.profile?.browser ?? null,
      tz: row.profile?.tz ?? null,
      screen: row.profile?.screen ?? null,
      webdriver: row.profile?.webdriver ?? null,
      pages: row.pages,
      engagement: row.engagement ?? [],
      actions: row.actions ?? [],
      automated
    };
    const result = classifyVisit(facts);
    // A visit with no engagement report never got past "pending".
    const verdict: Verdict = result.verdict === "pending" ? "unsure" : result.verdict;
    const intent = visitIntent(facts, verdict);
    return { row, facts, verdict, reasons: result.reasons, level: intent.level, prediction: intent.prediction };
  });
}

const LEVEL_RANK: Record<IntentLevel, number> = { high: 0, medium: 1, low: 2 };

function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["ar"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const place = (f: VisitFacts) => escapeHtml([f.city, countryName(f.country ?? null)].filter(Boolean).join("، ") || "مكان غير معروف");

function source(f: VisitFacts): string {
  if (f.campaign) return `إعلان (${escapeHtml(f.campaign.slice(0, 60))})`;
  return f.referrer ? escapeHtml(f.referrer) : "دخول مباشر";
}

/** "صفحة واحدة", "صفحتان", "3 صفحات", "12 صفحة". */
export function pagesCount(n: number): string {
  if (n === 1) return "صفحة واحدة";
  if (n === 2) return "صفحتان";
  if (n <= 10) return `${n} صفحات`;
  return `${n} صفحة`;
}

function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} ثانية`;
  const m = Math.round(seconds / 60);
  if (m === 1) return "دقيقة";
  if (m === 2) return "دقيقتان";
  return m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
}

const time = (unix: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(new Date(unix * 1000));

/** Distinct pages in order (a reload shows once), long routes cut in the middle. */
function route(pages: PageFacts[], max: number): string {
  const names = pages.map((p) => pageName(p.path)).filter((name, i, all) => i === 0 || name !== all[i - 1]);
  const shown = names.length > max ? [...names.slice(0, max - 2), "…", ...names.slice(-1)] : names;
  return shown.map((n) => escapeHtml(n)).join(" ← ");
}

const ACTION_SHORT: Record<string, string> = {
  whatsapp: "واتساب",
  call: "اتصال",
  email: "بريد",
  interested: "مهتم",
  favorite: "حفظ",
  video_play: "فيديو",
  map_open: "خريطة",
  chat_open: "دردشة",
  tour_link: "جولة فيديو",
  form_start: "بدأ نموذجاً",
  form_sent: "أرسل نموذجاً"
};

function details(f: VisitFacts): string | null {
  const parts: string[] = [];
  const engagement = f.engagement ?? [];
  if (engagement.length) {
    const scroll = engagement.reduce((n, e) => Math.max(n, e.scroll || 0), 0);
    const input = engagement.reduce((n, e) => n + (e.interactions || 0), 0);
    parts.push(`تمرير ${scroll}% · تفاعل ${input} ث`);
  }
  const actions = [...new Set((f.actions ?? []).map((a) => ACTION_SHORT[a.action] ?? a.action))];
  if (actions.length) parts.push(`نقرات: ${actions.join("، ")}`);
  return parts.length ? parts.join(" · ") : null;
}

function entry(r: ReadVisit, n: number, routeMax: number): string {
  const f = r.facts;
  const span = f.pages.length ? f.pages[f.pages.length - 1].at : 0;
  const device = deviceLabel(f);
  const more = details(f);
  return [
    `${n}. ${INTENT_LABEL[r.level]} · ${time(r.row.started)} · ${place(f)}`,
    `   ↩️ ${source(f)}${device ? ` · ${escapeHtml(device)}` : ""}`,
    `   📄 ${pagesCount(f.pages.length)} · ${duration(span)}${more ? ` · ${more}` : ""}`,
    `   🧭 ${route(f.pages, routeMax)}`,
    `   🔮 ${escapeHtml(r.prediction)}`
  ].join("\n");
}

function shortEntry(r: ReadVisit): string {
  const why = r.reasons.length ? ` — ${escapeHtml(r.reasons.join("، "))}` : "";
  return `• ${time(r.row.started)} · ${place(r.facts)} · ${pagesCount(r.facts.pages.length)}${why}`;
}

/** The report text; Telegram refuses messages over 4096 characters, so lists shrink until it fits. */
export function visitReportMessage(read: ReadVisit[], statsUrl: string): string {
  for (const [people, unsure, routeMax] of [[15, 6, 8], [12, 4, 6], [8, 3, 5], [5, 2, 4], [3, 0, 3]] as const) {
    const text = buildReport(read, statsUrl, people, unsure, routeMax);
    if (text.length <= 4000) return text;
  }
  return buildReport(read, statsUrl, 1, 0, 2).slice(0, 4000);
}

function buildReport(read: ReadVisit[], statsUrl: string, maxPeople: number, maxUnsure: number, routeMax: number): string {
  const people = read
    .filter((r) => r.verdict === "real")
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.facts.pages.length - a.facts.pages.length || b.row.started - a.row.started);
  const unsure = read.filter((r) => r.verdict === "unsure").sort((a, b) => b.row.started - a.row.started);
  const bots = read.filter((r) => r.verdict === "bot");
  const high = people.filter((r) => r.level === "high").length;

  const parts = [
    "📊 <b>حضارة للعقار — تحليل زوار آخر 24 ساعة</b>",
    `الزيارات ${read.length}: 🟢 حقيقية ${people.length} · 🟡 غير مؤكدة ${unsure.length} · 🔴 آلية ${bots.length}`
  ];
  if (high) parts.push(`🔥 زيارات باهتمام عالٍ: ${high}`);
  parts.push("");

  if (people.length) {
    parts.push("🟢 <b>الزيارات الحقيقية على الأرجح:</b>");
    people.slice(0, maxPeople).forEach((r, i) => parts.push(entry(r, i + 1, routeMax)));
    if (people.length > maxPeople) parts.push(`… و${people.length - maxPeople} زيارات أخرى باهتمام أقل`);
  } else {
    parts.push("لا زيارات حقيقية مؤكدة في آخر 24 ساعة.");
  }
  if (unsure.length && maxUnsure) {
    parts.push("", "🟡 <b>غير مؤكدة:</b>", ...unsure.slice(0, maxUnsure).map(shortEntry));
    if (unsure.length > maxUnsure) parts.push(`… و${unsure.length - maxUnsure} غيرها`);
  }
  if (bots.length) parts.push("", `🔴 الزيارات الآلية (${bots.length}) لا تظهر في التنبيهات ولا تحتاج متابعة.`);
  parts.push("", `🔗 <a href="${escapeHtml(statsUrl)}">الإحصاءات</a>`);
  return parts.join("\n");
}
